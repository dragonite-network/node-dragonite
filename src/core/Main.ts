import { autobind } from 'core-decorators'
import * as UDP from 'dgram'
import { Sender } from './Sender'
import { Receiver } from './Receiver'
import { ACKer } from './ACKer'
import { Resender } from './Resender'
import { RTTController } from './RTT'
import { socketParams } from './Paramaters'
import { Duplex } from 'stream'

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

  stream: Duplex = new Duplex()
  // writer: Writable = new DirectStream()

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

    this.stream.on('data', chunk => {
      console.log('stream recv', chunk)
    })
    setTimeout(() => {
      this.stream.write(Buffer.alloc(1000, 'a'))
    }, 2000)

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

// class DirectStream extends Transform {
//   _transform (chunk: any, encoding: string, callback: Function) {
//     callback(null, chunk)
//   }
// }

new DragoniteClient('toby.moe', 9226)

// setTimeout(() => {
//   const s = new DirectStream()
//   s.on('data', chunk => {
//     console.log(chunk.toString())
//   })
//   s.write('asdf')
// }, 1000)

// const readable = new Readable()
// let a = 0
// readable._read = function () {
//   console.log('?')
//   if (!a) {
//     readable.push('a')
//     a++
//   }
// }
// readable.on('data', chunk => {
//   console.log(chunk)
// })
// readable.on('end', () => {
//   console.log('end')
// })
// setTimeout(() => {
//   a = 0
//   console.log('resume')
//   readable._read(0)
//   setTimeout(() => {}, 5000)
// }, 3000)
