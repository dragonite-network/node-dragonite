export interface SocketParameters {
  packetSize: number
  autoSplit: boolean
  maxPacketBufferSize: number
  aggressiveWindowMultiplier: number
  passiveWindowMultiplier: number
  ackIntervalMS: number
  resendMinDelayMS: number
  heartbeatIntervalSec: number
  receiveTimeoutSec: number
}

export const socketParams: SocketParameters = {
  packetSize: 1300,
  autoSplit: true,
  maxPacketBufferSize: 0,
  aggressiveWindowMultiplier: 2,
  passiveWindowMultiplier: 5,
  ackIntervalMS: 10,
  resendMinDelayMS: 50,
  heartbeatIntervalSec: 5,
  receiveTimeoutSec: 10
}
