import { DragoniteClientSocket } from './ClientSocket'
import { DragoniteServer, ServerEvent } from './Server'
import { DragoniteServerSocket } from './ServerSocket'
import { SocketEvent } from './Socket'

const srv = new DragoniteServer('localhost', 43210)
srv.on(ServerEvent.Connection, (conn: DragoniteServerSocket) => {
  console.log('server: accepted conn', conn.remoteHost, conn.remotePort)
  conn.on(SocketEvent.Data, chunk => {
    console.log('server', conn.remotePort, 'received', chunk.toString())
  })
  conn.on(SocketEvent.Close, () => {
    console.log('server', conn.remotePort, 'close')
  })
})

const cli = new DragoniteClientSocket('localhost', 43210)
cli.on(SocketEvent.Connect, () => {
  console.log('client 1: connected')
  cli.write('Hello World! From Cli-1')
})

const cli2 = new DragoniteClientSocket('localhost', 43210)
cli2.on(SocketEvent.Connect, () => {
  console.log('client 2: connected')
  cli2.write(Buffer.from('Hello'))
  setTimeout(() => {
    cli2.close()
  }, 1000)
})
