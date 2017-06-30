import { DragoniteClientSocket } from './ClientSocket'
import { DragoniteServer } from './Server'
import { DragoniteServerSocket } from './ServerSocket'

const srv = new DragoniteServer('localhost', 43210)
srv.eventEmitter.on('connection', (conn: DragoniteServerSocket) => {
  console.log('server: accepted conn', conn.remoteHost, conn.remotePort)
  conn.stream.on('data', chunk => {
    console.log('server', conn.remotePort, 'received', chunk.toString())
  })
})

const cli = new DragoniteClientSocket('localhost', 43210)
cli.eventEmitter.on('connect', () => {
  console.log('client 1: connected')
  cli.stream.write('Hello World! From Cli-1')
})

const cli2 = new DragoniteClientSocket('localhost', 43210)
cli2.eventEmitter.on('connect', () => {
  console.log('client 2: connected')
  cli2.stream.write(Buffer.alloc(10000000, 99))
})
