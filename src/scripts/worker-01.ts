import net from 'net'
import EventEmitter from 'events';

import dotenv from 'dotenv';
import Logger from '../misc/logger.js';
import PATH from 'path';
dotenv.config({
   path: '../.env'
})

import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);


export default class Worker01 {
   #IPCClient: net.Socket | null;
   #IPCServerPort: any;
   #logger: any;
   #args: any;
   #event: EventEmitter;
   constructor (){

      this.#IPCClient = null

      this.#IPCServerPort = parseInt(process.env.IPC_PORT!)
      this.#logger = null
      this.#args = null
      this.#event = new EventEmitter()
      
   }

   private setup () {

      this.#IPCClient = new net.Socket().connect(8080, ()=>{

      });

      this.#IPCClient.on('connect', ()=>{
         this.#IPCClient!.on('data', async (data)=>{

            const {args, label, session} = JSON.parse(data.toString())
            console.log(JSON.stringify({
               args: args,
               label: label,
               session: session
            }))

            /**
             * Setting up the logger for this job.
             */
            this.#logger = new Logger(label, session)
            this.#logger.label = Job01.name

            this.#args = args

            this.#event.emit('received')
 
         });


      this.#IPCClient!.on('end', ()=>{ 
         //this.#logger.info('Disconnected from handler.');
      });

      this.#event.on('received', ()=>{
         const result = {
            source: PATH.basename(__filename).split('.')[0],
            product: new Job01(this.#args, this.#logger).do()
         }
            /**
             * Sends the output back to the handler
             */
         this.#IPCClient!.write(JSON.stringify(result))
         this.#IPCClient!.end();
      })
      })

      

   }

   public work () {

      

      this.setup()


   }
}


export class Job01 {
   #logger: Logger;
   #args: unknown;
   constructor (args: unknown, logger: Logger){
      this.#logger = logger
      this.#args = args 
   }

   do(){
      this.#logger.info(`${this.#args}`)
      return 'haha'
   }
}

new Worker01().work()



