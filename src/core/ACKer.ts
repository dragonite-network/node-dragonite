import { socketParams } from './Paramaters'
import { ACKMessage } from './Messages'
import { DragoniteClient } from './Main'

export class ACKer {
  dgn: DragoniteClient
  ackList: number[] = []
  acceptedSeqChanged: boolean = false
  maxSeqCount: number = Math.floor((socketParams.packetSize - ACKMessage.headerSize) / 4)
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
    this.sendACK()
  }
  sendACK () {
    setInterval(() => {
      const seqList: number[] = []
      if (this.ackList.length === 0 && this.acceptedSeqChanged) {
        this.acceptedSeqChanged = false
        const buf = ACKMessage.create(this.dgn.receiver.acceptedSeq, [])
        this.dgn.sender.sendRaw(buf)
      } else {
        while (this.ackList.length > 0) {
          while (seqList.length < this.maxSeqCount && this.ackList.length > 0) {
            seqList.push(this.ackList.shift())
          }
          const buf = ACKMessage.create(this.dgn.receiver.acceptedSeq, seqList)
          this.dgn.sender.sendRaw(buf)
        }
      }
    }, socketParams.ackIntervalMS)
  }
  addACK (sequence: number) {
    if (!this.ackList.includes(sequence)) {
      this.ackList.push(sequence)
    }
  }
}
