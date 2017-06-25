import { autobind } from 'core-decorators'
import * as UDP from 'dgram'
import { Limiter, Sender } from './Sender'
import { Receiver } from './Receiver'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { RTTController } from './RTT'
import { socketParams } from './Paramaters'
import { Duplex, Readable, Transform, Writable } from 'stream'

@autobind
export class DragoniteClient {
  remoteHost: string
  remotePort: number
  socket: UDP.Socket

  sender: Sender
  receiver: Receiver
  acker: ACKer
  resender: Resender
  rtt: RTTController

  reader: DirectStream = new DirectStream()
  writer: DirectStream = new DirectStream()

  sendSeq: number = 0
  sendSpeed: number = 1 / 20

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

    setTimeout(() => {
      this.reader.on('data', chunk => {
        console.log(chunk)
      })
    }, 5000)

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
  async sendAsync (buffer: Buffer) {
    await this.sender.sendDataMessage(buffer)
  }
}

class DirectStream extends Transform {
  _transform (chunk: any, encoding: string, callback: Function) {
    callback(null, chunk)
  }
}

// const cli = new DragoniteClient('toby.moe', 9225)
// setTimeout(() => {
//   cli.sendAsync(Buffer.alloc(22222222, 'a')).then(() => {})
// }, 1000)

// setTimeout(() => {
//   const s = new DirectStream()
//   s.on('data', chunk => {
//     console.log(chunk.toString())
//   })
//   s.write('asdf')
// }, 1000)

const limiter = new Limiter()
limiter.setAction((obj) => {
  console.log(obj)
})
limiter.play()