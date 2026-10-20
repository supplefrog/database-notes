// One in-flight command; reset terminates the worker and rejects stale promises.
export function createLabClient(makeWorker){
  let worker=null,pending=null,sequence=0;
  function reset(){sequence++;if(pending){const old=pending;pending=null;old.reject(new DOMException('Lab reset cancelled the previous operation.','AbortError'));}worker?.terminate();worker=null;}
  function request(action,args={}){
    if(pending)return Promise.reject(new Error('An operation is already running.'));
    if(!worker){worker=makeWorker();worker.onmessage=({data})=>{if(!pending||data.id!==pending.id)return;const current=pending;pending=null;data.error?current.reject(new Error(data.error)):current.resolve(data.result);};worker.onerror=()=>{if(pending){const current=pending;pending=null;current.reject(new Error('The SQLite worker could not load or stopped. Reset the lab to retry.'));}};}
    const id=++sequence;
    return new Promise((resolve,reject)=>{pending={id,resolve,reject};try{worker.postMessage({id,action,...args});}catch(e){pending=null;reject(e);}});
  }
  return {request,reset};
}
