import net from 'net'
import child_process from 'child_process'
import EventEmitter from 'events';
import { Message } from '../types/core';
import Logger from '../misc/logger.js';
import { cwd } from 'process';


export default class Handler {
   #logger: Logger;
   #raw: string;
   #product: Array<unknown>;

   #IPCServer: net.Server | null;
   /**
    * Keeps the progress of the workers in check. Triggers an @event when all jobs have completed.
    */
   #workers: Array<unknown>;
   #IPCServerPort: number;

   /**
    * Record of all worker to launch by this handler.
    */
   static workers = {
      work_01: "worker-01",
   }
   #event:EventEmitter;

   constructor ( args: Message ) {

      this.#logger = new Logger(`${args}-handler`, 'session')

      this.#IPCServer = null
      this.#IPCServerPort = 8080

      this.#event = new EventEmitter()

      this.#raw = args
      this.#workers = []
      this.#product = []

   }

   private setup () {

      this.#IPCServer = net.createServer((connection) => { 
         this.#logger.info('Client connected.');
         this.#workers.push(connection)

         /**
          * Sends the args to each script.
          */
         const workerConfig = {
            args: this.#raw,
            port: this.#IPCServerPort,
            logger: this.#logger
         }
         connection.write(JSON.stringify(workerConfig));
         connection.pipe(connection);
 
         /**
          * Captures the return of each script.
          */
         connection.on('data', (data) => { 
            this.#product.push(JSON.parse(data.toString()))
            this.#logger.info('Received return.')
         }); 
         connection.on('close',  () => { 
            this.#logger.warn('Client closed.')

         }); 
         connection.on('error', (error) => { 
            this.#logger.error(`Error: ${error}.`)
         });
         
         connection.on('end', () => {
            this.#logger.info('Client disconnected');
            this.#workers = <Array<net.Socket>>this.#workers.filter((worker) => worker !== connection)

            if (this.#workers.length ===0) {
               /**
                * Close the communication. No longer needed.
                */
               this.#IPCServer!.close()

            }
         });  
      });

      this.#IPCServer.listen(this.#IPCServerPort, () => { 
         this.#logger.info(`Handler listening at ${this.#IPCServerPort}`)
      });

      this.#IPCServer.on('close', () =>{
         /**
          * Notify that all workers are done.
          */
         this.#event.emit('done')
      })


      return this
   }

   public async perform () {

      this.setup()

      /**
       * Spawn workers as child processes.
       * @todo This does not spawn the child process ?!
       */
      this.#IPCServer?.on('listening', ()=>{
         for (const worker of Object.values(Handler.workers)) {
            this.#logger.info(`> node ${cwd()}\\scripts\\${worker}.js`)
            child_process.spawn('node', [`..\\scripts\\${worker}.js`])
         }

      })

      /**
       * Trap the most important in a promise to await. Will this work? We will see.
       */
      return new Promise((resolve)=>{
         /**
          * Runs when all workers are done.
          */
         this.#event.on('done', () =>{
            resolve(this.#product)
         })

      })
     
   }

}
