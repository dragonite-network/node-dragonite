import { RateLimiter } from 'limiter'

type LimiterAction = (object: any) => void

export class Limiter<ObjectType extends Object> {
  rl: RateLimiter
  objects: ObjectType[] = []
  // callbacks: Map<ObjectType, Function> = new Map()
  action: LimiterAction
  running: boolean = true
  constructor (speed: number) {
    this.rl = new RateLimiter(speed, 1000)
    this.play()
  }
  setAction (action: LimiterAction) {
    this.action = action
  }
  put (...objects: ObjectType[]) {
    this.objects.push(...objects)
    // this.callbacks.set(this.objects[this.objects.length - 1], Function)
  }
  // putAsync (...objects: ObjectType[]): Promise<{}> {
  //   return new Promise((resolve, reject) => {
  //     this.put(objects, () => {
  //       resolve()
  //     })
  //   })
  // }
  play () {
    this.rl.removeTokens(1, (error, _) => {
      if (error) {
        console.log(error)
      }
      if (this.running) {
        if (this.action && this.objects.length > 0) {
          const obj = this.objects.shift()
          this.action(obj)
          // if (this.callbacks.has(obj)) {
          //   this.callbacks.get(obj)()
          //   this.callbacks.delete(obj)
          // }
        }
        this.play()
      }
    })
  }
  pause () {
    this.running = false
  }
  resume () {
    this.running = true
    this.play()
  }
}
