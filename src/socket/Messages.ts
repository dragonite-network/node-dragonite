import { PROTOCOL_VERSION } from './Constants'

export enum MessageType {
  Data = 0,
  Close = 1,
  Ack = 2,
  Heartbeat = 3
}

export const reliableTypes = [
  MessageType.Data,
  MessageType.Close,
  MessageType.Heartbeat
]

export interface IMessage {
  version: number,
  type: MessageType,
}

export interface IReliableMessage extends IMessage {
  sequence?: number
}

export const Message = {
  getHeader (buffer: Buffer): IMessage {
    return {
      version: buffer.readInt8(0),
      type: buffer.readInt8(1),
      ...buffer.readInt8(1) !== MessageType.Ack ? { sequence: buffer.readInt32BE(2) } : {}
    }
  }
}

export const ReliableMessage = {
  getHeader (buffer: Buffer): IReliableMessage {
    return {
      version: buffer.readInt8(0),
      type: buffer.readInt8(1),
      sequence: buffer.readInt32BE(2)
    }
  },
  setSequence (buffer: Buffer, sequence: number) {
    buffer.writeInt32BE(sequence, 2)
  },
  getSequence (buffer: Buffer): number {
    return buffer.readInt32BE(2)
  },
  check (type: MessageType): boolean {
    return reliableTypes.includes(type)
  }
}

export interface IDataMessage extends IReliableMessage {
  data: Buffer
}

export const DataMessage = {
  parse (buffer: Buffer): IDataMessage {
    return {
      ...ReliableMessage.getHeader(buffer),
      data: buffer.slice(8)
    }
  },
  create (data: Buffer): Buffer {
    const buffer = Buffer.alloc(8 + data.length)
    buffer.writeInt8(PROTOCOL_VERSION, 0)
    buffer.writeInt8(MessageType.Data, 1)
    buffer.writeInt16BE(data.length, 6)
    buffer.fill(data, 8)
    return buffer
  },
  headerSize: 8
}

export interface ICloseMessage extends IReliableMessage {
  status: number
}

export const CloseMessage = {
  parse (buffer: Buffer): ICloseMessage {
    return {
      ...ReliableMessage.getHeader(buffer),
      status: buffer.readInt16BE(6)
    }
  },
  create (status: number): Buffer {
    const buffer = Buffer.alloc(8)
    buffer.writeInt8(PROTOCOL_VERSION, 0)
    buffer.writeInt8(MessageType.Close, 1)
    buffer.writeInt16BE(status, 6)
    return buffer
  }
}

export interface IACKMessage extends IMessage {
  consumedSeq: number
  seqList: number[]
}

export const ACKMessage = {
  parse (buffer: Buffer): IACKMessage {
    return {
      ...Message.getHeader(buffer),
      consumedSeq: buffer.readInt32BE(2),
      seqList: [...new Array(buffer.readInt16BE(6)).keys()].map(i => buffer.readInt32BE(8 + i * 4))
    }
  },
  create (receivedSeq: number, seqList: number[]): Buffer {
    const buffer = Buffer.alloc(8 + seqList.length * 4)
    buffer.writeInt8(PROTOCOL_VERSION, 0)
    buffer.writeInt8(MessageType.Ack, 1)
    buffer.writeInt32BE(receivedSeq, 2)
    buffer.writeInt16BE(seqList.length, 6)
    seqList.forEach((sequence, i) => {
      buffer.writeInt32BE(sequence, 8 + i * 4)
    })
    return buffer
  },
  headerSize: 8
}

export interface IHeartbeatMessage extends IReliableMessage {}

export const HeartbeatMessage = {
  parse (buffer: Buffer): IReliableMessage {
    return ReliableMessage.getHeader(buffer)
  },
  create (): Buffer {
    const buffer = Buffer.alloc(6)
    buffer.writeInt8(PROTOCOL_VERSION, 0)
    buffer.writeInt8(MessageType.Heartbeat, 1)
    return buffer
  }
}
