import { autobind } from 'core-decorators'
import { Sender } from './Sender'
import { Receiver } from './Receiver'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { RTTController } from './RTT'
import { SocketParameters, socketParams } from './Paramaters'
import { Duplex } from 'stream'
import { EventEmitter } from 'events'
import { CLOSE_WAIT_RTT_MULT, MIN_CLOSE_WAIT_MS } from './Constants'

export const SocketEvent = {
  Close: 'close',
  Connect: 'connect',
  Data: 'data',
  Drain: 'drain',
  End: 'end',
  Error: 'error',
  Lookup: 'lookup',
  Timeout: 'timeout'
}

@autobind
export abstract class DragoniteSocket {
  remoteHost: string
  remotePort: number

  socketParams: SocketParameters = socketParams

  sender: Sender
  receiver: Receiver
  acker: ACKer
  resender: Resender
  rtt: RTTController

  stream: Duplex = new Duplex()
  eventEmitter: EventEmitter = new EventEmitter()

  isConnected: boolean = false
  isAlive: boolean = false

  constructor (host: string, port: number) {
    this.remoteHost = host
    this.remotePort = port
  }
  setConnected () {
    if (!this.isConnected) {
      this.eventEmitter.emit('connect')
      this.isConnected = true
      this.isAlive = true
    }
  }
  start () {
    this.sender.aliveDetect()
  }
  on (event: string, listener: (...args: any[]) => void) {
    if ([SocketEvent.Close, SocketEvent.Data, SocketEvent.Drain, SocketEvent.End].includes(event)) {
      this.stream.on(event, listener)
    } else {
      this.eventEmitter.on(event, listener)
    }
  }
  write (chunk: any, cb?: Function) {
    this.stream.write(chunk, cb)
  }
  abstract destroy (): void
  close () {
    this.sender.sendCloseMessage()
    const waitTime = Math.max(this.rtt.estimatedRTT * CLOSE_WAIT_RTT_MULT, MIN_CLOSE_WAIT_MS)
    setTimeout(() => {
      this.destroy()
    }, waitTime)
  }
}
