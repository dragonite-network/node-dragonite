import { DEV_RTT_MULT, MAX_FAST_RESEND_COUNT, MAX_SLOW_RESEND_MULT } from './constants'
import { DragoniteClient } from './Main'
import { IReliableMessage, Message, ReliableMessage } from './Messages'
import Timer = NodeJS.Timer

export interface ResendInfo {
  isExists: boolean
  isResent: boolean
  RTT: number
}

export class ResendItem {
  resender: Resender
  sequence: number
  buffer: Buffer
  startTime: number = Date.now()
  sendCount: number = 0
  timer: Timer
  constructor (buffer: Buffer) {
    this.buffer = buffer
    this.sequence = ReliableMessage.getSequence(buffer)
  }
  bind (resender: Resender) {
    this.resender = resender
    return this
  }
  send () {
    this.timer = setTimeout(() => {
      this.resender.dgn.sender.sendRaw(this.buffer)
      this.sendCount++
      this.send()
    }, this.resender.getNextSendDelay(this.sendCount))
  }
}

export class Resender {
  dgn: DragoniteClient
  totalMessageCount = 0
  resendList: ResendItem[] = []
  ackDelayCompensation = 0
  minResendMS = 0
  constructor (dgn: DragoniteClient, minResendMS: number, ackDelayCompensation: number) {
    this.dgn = dgn
    this.minResendMS = minResendMS
    this.ackDelayCompensation = ackDelayCompensation
  }
  addMessage (buffer: Buffer) {
    this.totalMessageCount++
    const resendItem = new ResendItem(buffer).bind(this)
    this.resendList.push(resendItem)
  }
  getNextSendDelay (count = 0, timeOffset = 0): number {
    const resendMult = count <= MAX_FAST_RESEND_COUNT ? 1
      : Math.min(count - MAX_FAST_RESEND_COUNT + 1, MAX_SLOW_RESEND_MULT)
    const dRTT = Math.max(DEV_RTT_MULT * this.dgn.rtt.devRTT, this.ackDelayCompensation)
    let delay = (this.dgn.rtt.estimatedRTT + dRTT) * resendMult
    if (delay < this.minResendMS) {
      delay = this.minResendMS
    }
    return delay + timeOffset
  }
  removeMessage (sequence: number): ResendInfo {
    const rs = this.resendList.filter(r => r.sequence === sequence)
    if (rs.length > 0) {
      const r = rs[0]
      this.resendList.splice(this.resendList.indexOf(r), 1)
      const ri: ResendInfo = {
        isExists: true,
        isResent: r.sendCount > 0,
        RTT:  Date.now() - r.startTime
      }
      clearTimeout(r.timer)
      return ri
    }
  }
}
