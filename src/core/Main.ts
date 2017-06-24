import { autobind } from 'core-decorators'
import * as UDP from 'dgram'
import { Sender } from './Sender'
import { Receiver } from './Receiver'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { RTTController } from './RTT'
import { socketParams } from './Paramaters'

@autobind
export class DragoniteClient {
  sendSeq: number = 0
  remoteHost: string
  remotePort: number
  socket: UDP.Socket

  sender: Sender
  receiver: Receiver
  acker: ACKer
  resender: Resender
  rtt: RTTController

  constructor (host: string, port: number) {
    this.remoteHost = host
    this.remotePort = port

    this.socket = UDP.createSocket('udp4')
    this.socket.on('error', this.onError)
    this.socket.on('message', this.onReceive)
    this.socket.on('listening', this.onListening)
    this.socket.bind()

    this.sender = new Sender(this)
    this.receiver = new Receiver(this)
    this.acker = new ACKer(this)
    this.resender = new Resender(this, socketParams.resendMinDelayMS, socketParams.ackIntervalMS)
    this.rtt = new RTTController(this)

    this.aliveDetect()
  }
  aliveDetect () {
    setInterval(() => {
      this.sender.sendHeartbeatMessage()
    }, 1000)
  }
  onError (error: Error) {
    console.log(`client error:\n${error.stack}`)
  }
  onReceive (buffer: Buffer, rinfo: UDP.RemoteInfo) {
    this.receiver.handleMessage(buffer, rinfo)
  }
  onListening () {
    const address = this.socket.address()
    console.log(`client listening ${address.address}:${address.port}`)
  }
}

new DragoniteClient('toby.moe', 5233)
