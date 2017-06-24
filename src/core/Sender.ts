import { HeartbeatMessage, ReliableMessage } from './Messages'
import { DragoniteClient } from './Main'

export class Sender {
  dgn: DragoniteClient
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
  }
  sendRaw (buffer: Buffer) {
    this.dgn.socket.send(buffer, this.dgn.remotePort, this.dgn.remoteHost)
  }
  sendReliableMessage (buffer: Buffer) {
    ReliableMessage.setSequence(buffer, this.dgn.sendSeq)
    this.dgn.sendSeq++
    this.sendRaw(buffer)
    this.dgn.resender.addMessage(buffer)
  }
  sendHeartbeatMessage () {
    this.sendReliableMessage(HeartbeatMessage.create())
  }
}
