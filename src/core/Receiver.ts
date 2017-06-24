import {
  ACKMessage, CloseMessage, DataMessage, HeartbeatMessage, IACKMessage, ICloseMessage, IDataMessage, IHeartbeatMessage,
  IReliableMessage, Message,
  MessageType,
  ReliableMessage
} from './messages'
import { DragoniteClient } from './Main'
import { RemoteInfo } from 'dgram'

export class Receiver {
  dgn: DragoniteClient
  remoteAckedConsecutiveSeq = -1
  remoteAckedMaxSeq = -1
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
  }
  handleMessage (buffer: Buffer, rinfo: RemoteInfo) {
    switch (Message.getHeader(buffer).type) {
      case MessageType.DATA:
        return this.handleDataMessage(DataMessage.parse(buffer))
      case MessageType.CLOSE:
        return this.handleCloseMessage(CloseMessage.parse(buffer))
      case MessageType.HEARTBEAT:
        return this.handleHeartbeatMessage(HeartbeatMessage.parse(buffer))
      case MessageType.ACK:
        return this.handleACKMessage(ACKMessage.parse(buffer))
    }
  }
  handleReliableMessage (msg: IReliableMessage) {
    this.dgn.acker.addACK(msg.sequence)
  }
  handleHeartbeatMessage (msg: IHeartbeatMessage) {
    this.handleReliableMessage(msg)
  }
  handleACKMessage (msg: IACKMessage) {
    if (msg.receiveSeq > this.remoteAckedConsecutiveSeq) {
      this.remoteAckedConsecutiveSeq = msg.receiveSeq
    }
    msg.seqList.forEach(seq => {
      if (seq > this.remoteAckedMaxSeq) {
        this.remoteAckedMaxSeq = seq
      }
      this.dgn.rtt.pushResendInfo(this.dgn.resender.removeMessage(seq))
    })
  }
  handleCloseMessage (msg: ICloseMessage) {
    this.handleReliableMessage(msg)
  }
  handleDataMessage (msg: IDataMessage) {
    this.handleReliableMessage(msg)
  }
}
