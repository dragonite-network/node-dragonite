import { DEV_RTT_MULT, MAX_FAST_RESEND_COUNT, MAX_SLOW_RESEND_MULT } from './constants'
import { DragoniteSocket } from './Socket'
import { ReliableMessage } from './Messages'
import Timer = NodeJS.Timer

export interface ResendInfo {
  isExists: boolean
  isResent?: boolean
  RTT?: number
}

export class ResendItem {
  resender: Resender
  sequence: number
  buffer: Buffer
  startTime: number = Date.now()
  sendCount: number = 1
  timer: Timer
  acked: boolean = false
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
      if (this.acked) { return }
      this.resender.socket.sender.sendRaw(this.buffer)
      this.sendCount++
      this.send()
    }, this.resender.getNextSendDelay(this.sendCount))
  }
  ack () {
    this.acked = true
  }
}

export class Resender {
  socket: DragoniteSocket
  totalMessageCount = 0
  resendList: ResendItem[] = []
  ackDelayCompensation = 0
  minResendMS = 0
  constructor (socket: DragoniteSocket, minResendMS: number, ackDelayCompensation: number) {
    this.socket = socket
    this.minResendMS = minResendMS
    this.ackDelayCompensation = ackDelayCompensation
  }
  addMessage (buffer: Buffer) {
    this.totalMessageCount++
    const resendItem = new ResendItem(buffer).bind(this)
    resendItem.send()
    this.resendList.push(resendItem)
    // console.log('prepare resend', resendItem.sequence)
  }
  getNextSendDelay (count: number = 0, timeOffset: number = 0): number {
    const resendMult = count <= MAX_FAST_RESEND_COUNT ? 1
      : Math.min(count - MAX_FAST_RESEND_COUNT + 1, MAX_SLOW_RESEND_MULT)
    const dRTT = Math.max(DEV_RTT_MULT * this.socket.rtt.devRTT, this.ackDelayCompensation)
    let delay = (this.socket.rtt.estimatedRTT + dRTT) * resendMult
    if (delay < this.minResendMS) {
      delay = this.minResendMS
    }
    return delay + timeOffset
  }
  removeMessage (sequence: number): ResendInfo {
    const rs = this.resendList.filter(r => r.sequence === sequence)
    if (rs.length > 0) {
      const r = rs[0]
      const resendInfo: ResendInfo = {
        isExists: true,
        isResent: r.sendCount > 0,
        RTT:  Date.now() - r.startTime
      }
      r.ack()
      return resendInfo
    } else {
      return {
        isExists: false
      }
    }
  }
}
