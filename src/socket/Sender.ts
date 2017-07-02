import { CloseMessage, DataMessage, HeartbeatMessage, ReliableMessage } from './Messages'
import { DragoniteSocket } from './Socket'
import { Limiter } from './Limiter'
import { autobind } from 'core-decorators'
import Timer = NodeJS.Timer

@autobind
export class Sender {
  socket: DragoniteSocket
  limiter: Limiter<Buffer>
  bufferSizePerMsg: number
  sendSeq: number = 0
  sendSpeed: number = 1 / 20
  sendRaw: (buffer: Buffer) => void
  aliveTimer: Timer
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
  aliveDetect () {
    this.aliveTimer = setInterval(() => {
      this.sendHeartbeatMessage()
    }, this.socket.socketParams.heartbeatIntervalSec * 1000)
  }
  sendReliableMessage (buffer: Buffer): number {
    ReliableMessage.setSequence(buffer, this.sendSeq)
    this.sendSeq++
    this.sendRaw(buffer)
    this.socket.resender.addMessage(buffer)
    return this.sendSeq
    // console.log(ReliableMessage.getSequence(buffer))
  }
  sendHeartbeatMessage () {
    const seq = this.sendReliableMessage(HeartbeatMessage.create())
    const timeout = setTimeout(() => {
      this.socket.destroy()
    }, 2 * this.socket.socketParams.heartbeatIntervalSec * 1000)
    this.socket.receiver.ackCallbacks.push({
      receiveSeq: seq,
      callback: () => {
        clearTimeout(timeout)
      }
    })
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
  sendCloseMessage () {
    const closeSeq = this.sendReliableMessage(CloseMessage.create(0))
    this.socket.receiver.ackCallbacks.push({
      receiveSeq: closeSeq,
      callback: this.socket.destroy
    })
  }
  writeStream (chunk: any, encoding: string, callback: Function) {
    this.sendDataMessage(Buffer.from(chunk)).then(() => {
      callback()
    })
  }
  destroy () {
    clearInterval(this.aliveTimer)
  }
}
