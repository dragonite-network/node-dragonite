import { DragoniteSocket, SocketEvent } from './Socket'
import { Sender } from './Sender'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { Receiver } from './Receiver'
import { RTTController } from './RTT'

export class DragoniteServerSocket extends DragoniteSocket {
  get connKey (): string {
    return getConnKey(this.remoteHost, this.remotePort)
  }
  constructor (remoteHost: string, remotePort: number) {
    super(remoteHost, remotePort)

    this.sender = new Sender(this)
    this.receiver = new Receiver(this)
    this.acker = new ACKer(this)
    this.resender = new Resender(this)
    this.rtt = new RTTController(this)
  }
  destroy () {
    if (this.isAlive) {
      this.isAlive = false
      this.sender.destroy()
      this.resender.destroy()
      this.acker.destroy()

      this.eventEmitter.emit(SocketEvent.Close)
    }
  }
}

export function getConnKey (host: string, port: number) {
  return host + ':' + port
}
