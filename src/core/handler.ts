import net from 'net'
import child_process, { ChildProcess, ChildProcessWithoutNullStreams } from 'child_process'
import EventEmitter from 'events';
import { Message } from '../types/core';
import Logger from '../misc/logger.js';
import { cwd } from 'process';


import dotenv from 'dotenv';
dotenv.config({
   path: '../.env'
})


export default class Handler {
   #logger: Logger;
   #raw: string;
   #product: Array<unknown>;

   #IPCServer: net.Server | null;
   /**
    * Keeps the progress of the workers in check. Triggers the @event 'done' when all jobs have completed.
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
   #children:{[index: string]: child_process.ChildProcess};

   constructor ( args: Message ) {

      this.#logger = new Logger(`${args}-handler`, 'session')

      this.#IPCServer = null

      this.#IPCServerPort = parseInt(process.env.IPC_PORT!)

      this.#event = new EventEmitter()

      this.#raw = args
      this.#workers = []
      this.#children = {}
      this.#product = []

   }

   private setup () {

      this.#IPCServer = net.createServer((connection) => { 
         
         this.#logger.info('Client connected.');
         this.#workers.push(connection)
         this.#logger.info(`Connected clients: ${this.#workers.length}`)

         /**
          * Sends the args to each script.
          */
         const workerConfig = {
            args: this.#raw,
            label: this.#logger.label ,
            session: this.#logger.session
         }
         const argsSent = connection.write(JSON.stringify(workerConfig));
         this.#logger.info(`Sending args to child: ${(argsSent? 'SUCCEEDED': 'FAILED')}.`)
         connection.pipe(connection);
 
         /**
          * Captures the return of each script.
          */
         connection.on('data', (data) => { 

            const { source, product } = JSON.parse(data.toString())
            this.#children[source].kill()

            this.#product.push(product)
            this.#logger.info('Received return.')
         }); 
         connection.on('close',  () => { 
            this.#logger.warn('Client closed.')
            this.#workers = <Array<net.Socket>>this.#workers.filter((worker) => worker !== connection)

            if (this.#workers.length ===0) {
               /**
                * Close the communication. No longer needed.
                */
               this.#IPCServer!.close()

            }

         }); 
         connection.on('error', (error) => { 
            this.#logger.error(`Error: ${error}.`)
         });
         
         connection.on('end', () => {
            this.#logger.info('Client disconnected');
            
         });  
      });

      this.#IPCServer.listen(this.#IPCServerPort, () => { 
         this.#logger.info(`Handler listening at ${this.#IPCServerPort}`)
      });

      this.#IPCServer.on('close', () =>{
         /**
          * Notify that all workers are done.
          */
         this.#logger.warn('Server shutting down ...')
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
            const child = child_process.spawn('node', [`scripts\\${worker}.js`])
            /**
             * Grabs the output to console of the child process.
             */
            child.stdout.on('data', (data)=>{
               console.log(data.toString().trim())
            })
            child.stdout.on("error", (data)=>{
               console.log(data.toString().trim())
            })

            this.#children[`${worker}`]= child

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
