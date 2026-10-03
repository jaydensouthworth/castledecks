export class MemoryStorage{constructor(){this.data=new Map();this.writes=0;}getItem(key){return this.data.get(key)??null;}setItem(key,value){this.data.set(key,String(value));this.writes++;}removeItem(key){this.data.delete(key);}}
/** Shared by separate store instances to model the same-origin Web Locks API. */
export class TestLocks{
 constructor(){this.busy=false;this.requests=0;this.pauseNext=false;this.release=null;}
 async request(name,options,callback){
  this.requests++;await Promise.resolve();
  if(this.busy)return callback(null);
  this.busy=true;
  try{if(this.pauseNext){this.pauseNext=false;await new Promise(resolve=>this.release=()=>{this.release=null;resolve();});}return await callback({name,mode:'exclusive'});}finally{this.busy=false;}
 }
}
export async function settle(){for(let i=0;i<60;i++)await Promise.resolve();}
