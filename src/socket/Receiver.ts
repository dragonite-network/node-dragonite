import {
  ACKMessage, DataMessage, IACKMessage,
  Message,
  MessageType,
  ReliableMessage
} from './messages'
import { DragoniteSocket } from './Socket'
import { RemoteInfo } from 'dgram'
import { MIN_SEND_WINDOW } from './Constants'
import { autobind } from 'core-decorators'

interface ACKCallback {
  maxSeq: number,
  callback: Function
}

@autobind
export class Receiver {
  socket: DragoniteSocket
  remoteConsumedSeq: number = 0
  remoteAckedMaxSeq: number = 0
  receiveMap: Map<number, Buffer> = new Map()
  receivedSeq: number = 0
  receiveWindow: Buffer[] = []
  ackCallbacks: ACKCallback[] = []
  private _consumedSeq: number = 0
  get consumedSeq (): number { return this._consumedSeq }
  set consumedSeq (val: number) {
    this._consumedSeq = val
    this.socket.acker.consumedSeqChanged = true
  }
  constructor (socket: DragoniteSocket) {
    this.socket = socket
    this.socket.stream._read = this.streamRead
  }
  handleMessage (buffer: Buffer) {
    const type = Message.getHeader(buffer).type
    if (type === MessageType.Ack) {
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
      if (Message.getHeader(buffer).type === MessageType.Data) {
        this.receiveWindow.push(DataMessage.parse(buffer).data)
        this.streamRead()
      } else {
        this.consumedSeq++
      }
      this.receivedSeq++
    }
  }
  streamRead () {
    const buf = this.receiveWindow.shift()
    if (buf) {
      if (this.socket.stream.push(buf)) {
        this.consumedSeq++
      } else {
        this.receiveWindow.unshift(buf)
      }
    }
  }
  handleACKMessage (msg: IACKMessage) {
    this.socket.setConnected()
    if (msg.consumedSeq > this.remoteConsumedSeq) {
      this.remoteConsumedSeq = msg.consumedSeq
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
  getProperWindow (): number {
    const targetPPS = this.socket.sender.sendSpeed / this.socket.socketParams.packetSize
    const currentRTT = this.socket.rtt.estimatedRTT
    const wnd = Math.floor(targetPPS * (currentRTT / 1000) * this.socket.socketParams.windowMultiplier)
    return Math.max(wnd, MIN_SEND_WINDOW)
  }
  checkWindowAvailable (): boolean {
    const delta = this.socket.sender.sendSeq - this.remoteConsumedSeq
    return delta < this.getProperWindow()
  }
}
