export interface SocketParameters {
  packetSize: number
  autoSplit: boolean
  maxPacketBufferSize: number
  windowMultiplier: number
  ackIntervalMS: number
  resendMinDelayMS: number
  heartbeatIntervalSec: number
  receiveTimeoutSec: number
}

export const socketParams: SocketParameters = {
  packetSize: 1300,
  autoSplit: true,
  maxPacketBufferSize: 0,
  windowMultiplier: 2,
  ackIntervalMS: 10,
  resendMinDelayMS: 50,
  heartbeatIntervalSec: 5,
  receiveTimeoutSec: 10
}
