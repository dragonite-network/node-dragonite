import { socketParams } from './Paramaters'
import { ACKMessage } from './Messages'
import { DragoniteSocket } from './Main'

export class ACKer {
  socket: DragoniteSocket
  ackList: number[] = []
  consumedSeqChanged: boolean = false
  maxSeqCount: number = Math.floor((socketParams.packetSize - ACKMessage.headerSize) / 4)
  constructor (socket: DragoniteSocket) {
    this.socket = socket
    this.sendACK()
  }
  sendACK () {
    setInterval(() => {
      const seqList: number[] = []
      if (this.ackList.length === 0 && this.consumedSeqChanged) {
        this.consumedSeqChanged = false
        const buf = ACKMessage.create(this.socket.receiver.consumedSeq, [])
        // console.log('send ack', this.socket.receiver.consumedSeq, [])
        this.socket.sender.sendRaw(buf)
      } else {
        while (this.ackList.length > 0) {
          while (seqList.length < this.maxSeqCount && this.ackList.length > 0) {
            seqList.push(this.ackList.shift())
          }
          const buf = ACKMessage.create(this.socket.receiver.consumedSeq, seqList)
          // console.log('send ack', this.socket.receiver.consumedSeq, seqList)
          this.socket.sender.sendRaw(buf)
        }
      }
    }, socketParams.ackIntervalMS)
  }
  addACK (sequence: number) {
    // console.log(sequence)
    if (!this.ackList.includes(sequence)) {
      this.ackList.push(sequence)
    }
  }
}
