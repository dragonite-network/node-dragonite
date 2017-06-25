import {
  ACKMessage, CloseMessage, DataMessage, HeartbeatMessage, IACKMessage, ICloseMessage, IDataMessage, IHeartbeatMessage,
  IReliableMessage, Message,
  MessageType,
  ReliableMessage, reliableTypes
} from './messages'
import { DragoniteClient } from './Main'
import { RemoteInfo } from 'dgram'
import { socketParams } from './Paramaters'
import { MIN_SEND_WINDOW } from './Constants'

export class Receiver {
  dgn: DragoniteClient
  remoteAckedConsecutiveSeq: number = -1
  remoteAckedMaxSeq: number = -1
  receiveMap: Map<number, Buffer> = new Map()
  private _acceptedSeq: number = 0
  get acceptedSeq (): number { return this._acceptedSeq }
  set acceptedSeq (val: number) {
    this._acceptedSeq = val
    this.dgn.acker.acceptedSeqChanged = true
  }
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
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
    this.dgn.acker.addACK(sequence)
    this.receiveMap.set(sequence, buffer)

    while (this.receiveMap.has(this.acceptedSeq + 1)) {
      const buffer = this.receiveMap.get(this.acceptedSeq + 1)
      this.receiveMap.delete(this.acceptedSeq + 1)
      if (Message.getHeader(buffer).type === MessageType.DATA) {
        if (this.dgn.reader.write(DataMessage.parse(buffer).data)) {
          this.acceptedSeq++
        }
      } else {
        this.acceptedSeq++
      }
      console.log(this.acceptedSeq)
    }
  }
  handleACKMessage (msg: IACKMessage) {
    if (msg.acceptedSeq > this.remoteAckedConsecutiveSeq) {
      this.remoteAckedConsecutiveSeq = msg.acceptedSeq
    }
    msg.seqList.forEach(seq => {
      if (seq > this.remoteAckedMaxSeq) {
        this.remoteAckedMaxSeq = seq
      }
      this.dgn.rtt.pushResendInfo(this.dgn.resender.removeMessage(seq))
    })
  }
  getProperWindow (passive: boolean): number {
    const mult = passive ? socketParams.passiveWindowMultiplier : socketParams.aggressiveWindowMultiplier
    const targetPPS = this.dgn.sendSpeed / socketParams.packetSize
    const currentRTT = this.dgn.rtt.estimatedRTT
    const wnd = Math.floor(targetPPS * (currentRTT / 1000.0) * mult)
    return Math.max(wnd, MIN_SEND_WINDOW)
  }
  checkWindowAvailable (): boolean {
    const aggressiveDelta = this.dgn.sendSeq - this.remoteAckedMaxSeq
    const passiveDelta = this.dgn.sendSeq - this.remoteAckedConsecutiveSeq
    const aggressiveOK = aggressiveDelta < this.getProperWindow(false)
    const passiveOK = passiveDelta < this.getProperWindow(true)
    return aggressiveOK && passiveOK
  }
}
