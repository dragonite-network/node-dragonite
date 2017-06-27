import { DataMessage, HeartbeatMessage, ReliableMessage } from './Messages'
import { DragoniteSocket } from './Main'
import { Limiter } from './Limiter'
import { autobind } from 'core-decorators'

@autobind
export class Sender {
  socket: DragoniteSocket
  limiter: Limiter<Buffer>
  bufferSizePerMsg: number
  sendSeq: number = 0
  sendSpeed: number = 1 / 20
  constructor (socket: DragoniteSocket) {
    this.socket = socket
    this.bufferSizePerMsg = this.socket.socketParams.packetSize - DataMessage.headerSize

    this.limiter = new Limiter(50)
    this.limiter.play()
    this.limiter.setAction(buffer => {
      this.sendReliableMessage(buffer)
    })
    this.socket.stream._write = this.writeStream
  }
  sendRaw (buffer: Buffer) {
    this.socket.udp.send(buffer, this.socket.remotePort, this.socket.remoteHost)
  }
  sendReliableMessage (buffer: Buffer) {
    ReliableMessage.setSequence(buffer, this.sendSeq)
    this.sendSeq++
    this.sendRaw(buffer)
    this.socket.resender.addMessage(buffer)
    // console.log(ReliableMessage.getSequence(buffer))
  }
  sendHeartbeatMessage () {
    this.sendReliableMessage(HeartbeatMessage.create())
  }
  sendDataMessage (buffer: Buffer): Promise<{}> {
    const messages: Buffer[] = []
    if (buffer.length <= this.bufferSizePerMsg) {
      // await this.limitRate()
      messages.push(DataMessage.create(buffer))
    } else {
      let rangeStart = 0
      let rangeEnd = 0
      while (rangeEnd < buffer.length) {
        rangeStart = rangeEnd
        rangeEnd = rangeStart + this.bufferSizePerMsg
        if (rangeEnd > buffer.length) {
          rangeEnd = buffer.length
        }
        messages.push(DataMessage.create(buffer.slice(rangeStart, rangeEnd)))
        // await this.limitRate()
      }
    }

    const unsentSeq = this.sendSeq
    this.limiter.put(...messages)
    return new Promise((resolve, reject) => {
      this.socket.receiver.ackCallbacks.push({
        maxSeq: unsentSeq + messages.length - 1,
        callback: () => {
          resolve()
        }
      })
    })
  }
  writeStream (chunk: any, encoding: string, callback: Function) {
    this.sendDataMessage(Buffer.from(chunk)).then(() => {
      callback()
    })
  }
}
