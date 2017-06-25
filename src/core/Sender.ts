import { DataMessage, HeartbeatMessage, ReliableMessage } from './Messages'
import { DragoniteClient } from './Main'
import { RateLimiter } from 'limiter'
import { socketParams } from './Paramaters'

export class Sender {
  dgn: DragoniteClient
  limiter: RateLimiter
  bufferSizePerMsg: number = socketParams.packetSize - DataMessage.headerSize
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
    this.limiter = new RateLimiter(1, 20)
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
  async sendDataMessage (buffer: Buffer) {
    if (buffer.length <= this.bufferSizePerMsg) {
      // await this.limitRate()
      return this.sendReliableMessage(DataMessage.create(buffer))
    }
    let rangeStart = 0
    let rangeEnd = 0
    while (rangeEnd < buffer.length) {
      rangeStart = rangeEnd
      rangeEnd = rangeStart + this.bufferSizePerMsg
      if (rangeEnd > buffer.length) {
        rangeEnd = buffer.length
      }
      // await this.limitRate()
      this.sendReliableMessage(DataMessage.create(buffer.slice(rangeStart, rangeEnd)))
    }
  }
}

type LimiterAction = (object: any) => void
export class Limiter {
  rl: RateLimiter
  objects: any[]
  action: LimiterAction
  running: boolean
  constructor () {
    this.rl = new RateLimiter(1, 1)
    this.play()
  }
  setAction (action: LimiterAction) {
    this.action = action
  }
  put (objects: any[], callback: () => void) {
    this.objects.push(...objects)
  }
  play () {
    this.rl.removeTokens(1, (error, _) => {
      if (error) {
        console.log(error)
      }
      if (this.running) {
        if (this.action) {
          this.action(this.objects.shift)
        }
        this.play()
      }
    })
  }
  pause () {
    this.running = false
  }
  resume () {
    this.running = true
    this.play()
  }
}
