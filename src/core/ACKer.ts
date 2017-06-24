import { socketParams } from './Paramaters'
import { ACKMessage } from './Messages'
import { DragoniteClient } from './Main'

export class ACKer {
  dgn: DragoniteClient
  ackList: number[] = []
  receivedSeqChanged: boolean = false
  _receivedSeq: number = -1
  get receivedSeq (): number { return this._receivedSeq }
  set receivedSeq (val: number) {
    this._receivedSeq = val
    this.receivedSeqChanged = true
  }
  maxSeqCount: number = Math.floor((socketParams.packetSize - ACKMessage.headerSize) / 4)
  constructor (dgn: DragoniteClient) {
    this.dgn = dgn
    this.sendACK()
  }
  sendACK () {
    setInterval(() => {
      const seqList: number[] = []
      if (this.ackList.length === 0 && this.receivedSeqChanged) {
        this.receivedSeqChanged = false
        this.dgn.sender.sendRaw(ACKMessage.create(this.receivedSeq, []))
      } else {
        while (this.ackList.length > 0) {
          while (seqList.length < this.maxSeqCount && this.ackList.length > 0) {
            seqList.push(this.ackList.shift())
          }
          this.dgn.sender.sendRaw(ACKMessage.create(this.receivedSeq, seqList))
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
