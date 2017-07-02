import { DragoniteSocket } from './Socket'
import { Sender } from './Sender'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { Receiver } from './Receiver'
import { RTTController } from './RTT'
import * as UDP from 'dgram'
import { autobind } from 'core-decorators'

@autobind
export class DragoniteClientSocket extends DragoniteSocket {
  udp: UDP.Socket
  constructor (remoteHost: string, remotePort: number) {
    super(remoteHost, remotePort)

    this.sender = new Sender(this)
    this.receiver = new Receiver(this)
    this.acker = new ACKer(this)
    this.resender = new Resender(this)
    this.rtt = new RTTController(this)

    this.udp = UDP.createSocket('udp4')
    this.udp.on('error', (error) => {
      console.log(`client error:\n${error.stack}`)
    })
    this.udp.on('message', (buffer, rinfo) => {
      this.receiver.handleMessage(buffer)
    })
    this.sender.sendRaw = (buffer: Buffer) => {
      this.udp.send(buffer, this.remotePort, this.remoteHost)
    }
    this.udp.bind()

    this.start()
  }
  destroy () {
    if (this.isAlive) {
      this.isAlive = false
      this.sender.destroy()
      this.resender.destroy()
      this.acker.destroy()
      this.udp.close()
    }
  }
}
