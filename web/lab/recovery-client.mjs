// One in-flight command. Failed bootstrap is retired so Start can retry fresh.
export function createLabClient(makeWorker){
  let worker=null,pending=null,sequence=0;
  function retire(target){if(worker!==target)return;worker=null;target?.terminate();}
  function fail(target,error){if(worker!==target)return;const current=pending;pending=null;retire(target);current?.reject(error);}
  function reset(){sequence++;const current=pending;pending=null;retire(worker);current?.reject(new DOMException('Lab reset cancelled the previous operation.','AbortError'));}
  function request(action,args={}){
    if(pending)return Promise.reject(new Error('An operation is already running.'));
    if(!worker){
      const target=worker=makeWorker();
      target.onmessage=({data})=>{
        if(worker!==target||!pending||data.id!==pending.id)return;
        const current=pending;pending=null;
        if(data.error){if(current.action==='start')retire(target);current.reject(new Error(data.error));}
        else current.resolve(data.result);
      };
      target.onerror=()=>fail(target,new Error('The SQLite worker could not load or stopped.'));
    }
    const id=++sequence,target=worker;
    return new Promise((resolve,reject)=>{pending={id,action,resolve,reject};try{target.postMessage({id,action,...args});}catch(e){fail(target,e);}});
  }
  return {request,reset};
}
