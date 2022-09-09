import Handler from "./core/handler.js";

(async ()=>{
    console.log(await new Handler('hello').perform())
})()