import {
  ACKMessage, DataMessage, IACKMessage,
  Message,
  MessageType,
  ReliableMessage
} from './messages'
import { DragoniteSocket } from './Main'
import { RemoteInfo } from 'dgram'
import { socketParams } from './Paramaters'
import { MIN_SEND_WINDOW } from './Constants'
import { autobind } from 'core-decorators'

interface ACKCallback {
  maxSeq: number,
  callback: Function
}

@autobind
export class Receiver {
  socket: DragoniteSocket
  remoteAckedConsecutiveSeq: number = 0
  remoteAckedMaxSeq: number = 0
  receiveMap: Map<number, Buffer> = new Map()
  receivedSeq: number = 0
  receiveWindow: Buffer[] = []
  ackCallbacks: ACKCallback[] = []
  private _acceptedSeq: number = 0
  get acceptedSeq (): number { return this._acceptedSeq }
  set acceptedSeq (val: number) {
    this._acceptedSeq = val
    this.socket.acker.acceptedSeqChanged = true
  }
  constructor (socket: DragoniteSocket) {
    this.socket = socket
    this.socket.stream._read = this.streamRead
  }
  handleMessage (buffer: Buffer, rinfo: RemoteInfo) {
    const type = Message.getHeader(buffer).type
    if (type === MessageType.ACK) {
      return this.handleACKMessage(ACKMessage.parse(buffer))
    }
    if (ReliableMessage.check(type)) {
      return this.handleReliableMessage(buffer)
    }
  }
  //        A
  // |~|~|~|~| |+|*|*|+| | |+| | | |+|
  //  0 1 2 3 4 5 6 7 8 9 A B C D E F
  handleReliableMessage (buffer: Buffer) {
    const { sequence } = ReliableMessage.getHeader(buffer)
    this.socket.acker.addACK(sequence)
    this.receiveMap.set(sequence, buffer)

    while (this.receiveMap.has(this.receivedSeq + 1)) {
      const buffer = this.receiveMap.get(this.receivedSeq + 1)
      this.receiveMap.delete(this.receivedSeq + 1)
      if (Message.getHeader(buffer).type === MessageType.DATA) {
        this.receiveWindow.push(DataMessage.parse(buffer).data)
        this.streamRead()
      } else {
        this.acceptedSeq++
      }
      this.receivedSeq++
    }
  }
  streamRead () {
    const buf = this.receiveWindow.shift()
    if (buf) {
      if (this.socket.stream.push(buf)) {
        this.acceptedSeq++
      } else {
        this.receiveWindow.unshift(buf)
      }
    }
  }
  handleACKMessage (msg: IACKMessage) {
    this.socket.setConnected()
    if (msg.acceptedSeq > this.remoteAckedConsecutiveSeq) {
      this.remoteAckedConsecutiveSeq = msg.acceptedSeq
    }
    msg.seqList.forEach(seq => {
      if (seq > this.remoteAckedMaxSeq) {
        this.remoteAckedMaxSeq = seq
      }
      this.socket.rtt.pushResendInfo(this.socket.resender.removeMessage(seq))
    })
    this.ackCallbacks.forEach(ac => {
      if (ac.maxSeq <= this.remoteAckedMaxSeq) {
        ac.callback()
      }
      this.ackCallbacks.splice(this.ackCallbacks.indexOf(ac), 1)
    })
    if (this.checkWindowAvailable()) {
      this.socket.sender.limiter.resume()
    } else {
      this.socket.sender.limiter.pause()
    }
  }
  getProperWindow (passive: boolean): number {
    const mult = passive ? socketParams.passiveWindowMultiplier : socketParams.aggressiveWindowMultiplier
    const targetPPS = this.socket.sender.sendSpeed / socketParams.packetSize
    const currentRTT = this.socket.rtt.estimatedRTT
    const wnd = Math.floor(targetPPS * (currentRTT / 1000.0) * mult)
    return Math.max(wnd, MIN_SEND_WINDOW)
  }
  checkWindowAvailable (): boolean {
    const aggressiveDelta = this.socket.sender.sendSeq - this.remoteAckedMaxSeq
    const passiveDelta = this.socket.sender.sendSeq - this.remoteAckedConsecutiveSeq
    const aggressiveOK = aggressiveDelta < this.getProperWindow(false)
    const passiveOK = passiveDelta < this.getProperWindow(true)
    return aggressiveOK && passiveOK
  }
}
