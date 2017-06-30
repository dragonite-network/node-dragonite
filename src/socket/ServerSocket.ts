import { DragoniteSocket } from './Socket'
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

    this.sender = new Sender(this, 1000)
    this.receiver = new Receiver(this)
    this.acker = new ACKer(this)
    this.resender = new Resender(this, this.socketParams.resendMinDelayMS, this.socketParams.ackIntervalMS)
    this.rtt = new RTTController(this)
  }
}

export function getConnKey (host: string, port: number) {
  return host + ':' + port
}
