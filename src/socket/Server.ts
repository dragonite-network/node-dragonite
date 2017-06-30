import { DragoniteServerSocket, getConnKey } from './ServerSocket'
import * as UDP from 'dgram'
import { autobind } from 'core-decorators'
import { Message, ReliableMessage } from './Messages'
import { PROTOCOL_VERSION } from './Constants'
import { EventEmitter } from 'events'

export const ServerEvent = {
  Close: 'close',
  Connection: 'connection',
  Error: 'error',
  Listening: 'listening'
}

@autobind
export class DragoniteServer {
  udp: UDP.Socket
  connectionMap: Map<string, DragoniteServerSocket> = new Map()
  eventEmitter: EventEmitter = new EventEmitter()
  constructor (bindHost: string, bindPort: number) {
    this.udp = UDP.createSocket('udp4')
    this.udp.on('message', this.handleMessage)
    this.udp.bind(bindPort, bindHost)
  }
  handleMessage (buffer: Buffer, rinfo: UDP.RemoteInfo) {
    const connKey = getConnKey(rinfo.address, rinfo.port)
    if (this.connectionMap.has(connKey)) {
      this.connectionMap.get(connKey).receiver.handleMessage(buffer)
    } else if (Message.getHeader(buffer).version === PROTOCOL_VERSION
      && ReliableMessage.getSequence(buffer) === 0) {
      const connection = new DragoniteServerSocket(rinfo.address, rinfo.port)
      this.connectionMap.set(connKey, connection)
      connection.sender.sendRaw = (buffer: Buffer) => {
        this.udp.send(buffer, connection.remotePort, connection.remoteHost)
      }
      connection.start()

      connection.receiver.handleMessage(buffer)
      this.eventEmitter.emit('connection', connection)
    }
  }
  on (event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener)
  }
}
