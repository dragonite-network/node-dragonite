import { autobind } from 'core-decorators'
import * as UDP from 'dgram'
import { Sender } from './Sender'
import { Receiver } from './Receiver'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { RTTController } from './RTT'
import { SocketParameters, socketParams } from './Paramaters'
import { Duplex } from 'stream'
import { EventEmitter } from 'events'

@autobind
export class DragoniteSocket {
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

  constructor (host: string, port: number) {
    this.remoteHost = host
    this.remotePort = port

    // this.udp = UDP.createSocket('udp4')
    // this.udp.on('error', (error) => {
    //   console.log(`client error:\n${error.stack}`)
    // })
    // this.udp.on('message', (buffer, rinfo) => {
    //   this.receiver.handleMessage(buffer, rinfo)
    // })
    // this.udp.bind()
    //
    // this.sender = new Sender(this, 1000)
    // this.receiver = new Receiver(this)
    // this.acker = new ACKer(this)
    // this.resender = new Resender(this, this.socketParams.resendMinDelayMS, this.socketParams.ackIntervalMS)
    // this.rtt = new RTTController(this)
  }
  setConnected () {
    if (!this.isConnected) {
      this.eventEmitter.emit('connect')
      this.isConnected = true
    }
  }
  start () {
    this.sender.aliveDetect()
  }
}
