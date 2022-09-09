import net from 'net'
import { Message } from '../types/core';
import EventEmitter from 'events';


export default class Worker01 {
   #IPCClient: net.Socket | null;
   #IPCServerPort: any;
   #logger: any;
   #args: any;
   #event: EventEmitter;
   constructor (){

      this.#IPCClient = null
      this.#IPCServerPort = null
      this.#logger = null
      this.#args = null
      this.#event = new EventEmitter()
      
   }

   private setup () {

      this.#IPCClient = net.connect({port: this.#IPCServerPort}, ()=>{
         this.#logger.info('Connected to handler.');  
      });

      this.#IPCClient!.on('data', async (data)=>{

         const {args, port, logger} = JSON.parse(data.toString())
         console.log(args, port)
         this.#logger = logger
         this.#args = args
         this.#IPCServerPort = port

         this.#event.emit('received')
 
      });

   }

   public work () {

            this.#IPCClient!.on('end', ()=>{ 
         this.#logger.info('Disconnected from handler.');
      });

            this.#event.on('received', ()=>{
         const result = new Job01().do()
            /**
             * Sends the output back to the handler
             */
         this.#IPCClient!.write(JSON.stringify(result))
         this.#IPCClient!.end();
      })

      this.setup()


   }
}


export class Job01 {
   constructor (){}

   do(){
      return 'haha'
   }
}

console.log('hello')
new Worker01().work()



