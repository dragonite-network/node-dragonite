import { DataMessage, HeartbeatMessage, IDataMessage, ReliableMessage } from './Messages'
import { DragoniteClient } from './Main'
import { RateLimiter } from 'limiter'
import { socketParams } from './Paramaters'
import { Limiter } from './Limiter'
import { autobind } from 'core-decorators'

@autobind
export class Sender {
  dgn: DragoniteClient
  limiter: Limiter<Buffer>
  bufferSizePerMsg: number = socketParams.packetSize - DataMessage.headerSize
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
    this.limiter = new Limiter(50)
    this.limiter.play()
    this.limiter.setAction(buffer => {
      this.sendReliableMessage(buffer)
    })
    this.dgn.stream._write = this.writeStream
  }
  sendRaw (buffer: Buffer) {
    this.dgn.socket.send(buffer, this.dgn.remotePort, this.dgn.remoteHost)
  }
  sendReliableMessage (buffer: Buffer) {
    ReliableMessage.setSequence(buffer, this.dgn.sendSeq)
    this.dgn.sendSeq++
    this.sendRaw(buffer)
    this.dgn.resender.addMessage(buffer)
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

    const unsentSeq = this.dgn.sendSeq
    this.limiter.put(...messages)
    return new Promise((resolve, reject) => {
      this.dgn.receiver.ackCallbacks.push({
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
