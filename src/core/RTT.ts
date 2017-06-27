import {
  DEV_RTT_MULT,
  INIT_RTT,
  RTT_MAX_VARIATION,
  RTT_RESEND_CORRECTION_INTERVAL_MS,
  RTT_RESENDED_REFRESH_MAX_MULT,
  RTT_UPDATE_INTERVAL_MS
} from './Constants'
import { DragoniteSocket } from './Main'
import { ResendInfo } from './Resender'

export class RTTController {
  socket: DragoniteSocket
  estimatedRTTUpdateFactor: number = 0.125
  devRTTUpdateFactor: number = 0.25
  estimatedRTT: number = INIT_RTT
  devRTT: number = 0
  lastUpdate: number = 0
  continuousResendCount: number = 0
  constructor (socket: DragoniteSocket) {
    this.socket = socket
  }
  pushResendInfo (info: ResendInfo) {
    if (info.isExists) {
      const currentTime = Date.now()
      if (currentTime - this.lastUpdate >= RTT_UPDATE_INTERVAL_MS) {
        this.lastUpdate = currentTime
        if (!info.isResent) {
          this.continuousResendCount = 0
          const estimatedRTT = (1 - this.estimatedRTTUpdateFactor) * this.estimatedRTT + this.estimatedRTTUpdateFactor * info.RTT
          const devRTT = (1 - this.devRTTUpdateFactor) * this.devRTT + this.devRTTUpdateFactor * Math.abs(info.RTT - this.estimatedRTT)
          this.setRTTLimited(estimatedRTT, devRTT)
        } else {
          this.continuousResendCount++
          if (this.continuousResendCount > RTT_RESEND_CORRECTION_INTERVAL_MS / RTT_UPDATE_INTERVAL_MS) {
            const maxCRTT = this.estimatedRTT * RTT_RESENDED_REFRESH_MAX_MULT
            const tmpRTT = Math.min(info.RTT, maxCRTT)
            const estimatedRTT = (1 - this.estimatedRTTUpdateFactor) * this.estimatedRTT + this.estimatedRTTUpdateFactor * tmpRTT
            const devRTT = (1 - this.devRTTUpdateFactor) * this.devRTT + this.devRTTUpdateFactor * Math.abs(tmpRTT - this.estimatedRTT)
            this.setRTTLimited(estimatedRTT, devRTT)
            this.continuousResendCount = 0
          }
        }
      }
    }
  }
  setRTTLimited (estimatedRTT: number, devRTT: number) {
    let tempDevRTT = devRTT * DEV_RTT_MULT
    if (tempDevRTT > estimatedRTT && tempDevRTT > RTT_MAX_VARIATION) {
      tempDevRTT = estimatedRTT
    }
    tempDevRTT /= DEV_RTT_MULT
    this.setRTT(estimatedRTT, tempDevRTT)
  }
  setRTT (estimatedRTT: number, devRTT: number) {
    this.estimatedRTT = estimatedRTT
    this.devRTT = devRTT
  }
}
