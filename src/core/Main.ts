import { autobind } from 'core-decorators'
import * as UDP from 'dgram'
import { Sender } from './Sender'
import { Receiver } from './Receiver'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { RTTController } from './RTT'
import { socketParams } from './Paramaters'
import { Duplex } from 'stream'
import { EventEmitter } from 'events'

@autobind
export class DragoniteSocket {
  remoteHost: string
  remotePort: number
  socket: UDP.Socket

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

    this.socket = UDP.createSocket('udp4')
    this.socket.on('error', (error) => {
      console.log(`client error:\n${error.stack}`)
    })
    this.socket.on('message', (buffer, rinfo) => {
      this.receiver.handleMessage(buffer, rinfo)
    })
    this.socket.bind()

    this.sender = new Sender(this)
    this.receiver = new Receiver(this)
    this.acker = new ACKer(this)
    this.resender = new Resender(this, socketParams.resendMinDelayMS, socketParams.ackIntervalMS)
    this.rtt = new RTTController(this)

    // Debug
    this.stream.on('data', chunk => {
      console.log('stream recv', chunk)
    })
    this.eventEmitter.on('connect', () => {
      console.log('connected to echo server')
      this.stream.write(Buffer.alloc(1000, 'a'))
    })

    this.aliveDetect()
  }
  aliveDetect () {
    setInterval(() => {
      this.sender.sendHeartbeatMessage()
    }, 1000)
  }
  setConnected () {
    if (!this.isConnected) {
      this.eventEmitter.emit('connect')
      this.isConnected = true
    }
  }
}

new DragoniteSocket('toby.moe', 9226)
