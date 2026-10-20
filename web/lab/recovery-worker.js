// Classic worker keeps the SQLite build and all synthetic data away from the UI.
importScripts('./vendor/sql.js/sql-wasm.js');
let lab,working=false;
const ready=Promise.all([
  initSqlJs({locateFile:name=>new URL('./vendor/sql.js/'+name,self.location.href).href}),
  import('./recovery-engine.mjs'),
  fetch(new URL('./recovery-oracle.json',self.location.href)).then(r=>{if(!r.ok)throw new Error('Expected-state fixture could not be loaded.');return r.json();})
]).then(([SQL,{RecoveryLab},oracle])=>{lab=new RecoveryLab(SQL,oracle);});
self.onmessage=async({data})=>{
  const {id,action,mode,source,tenant}=data;
  if(working){self.postMessage({id,error:'Wait for the current SQLite operation to finish.'});return;}
  working=true;
  try{
    await ready;let result;
    switch(action){
      case 'start':result=lab.seed();break;
      case 'fault':result=lab.fault();break;
      case 'restore':result=lab.restore(mode);break;
      case 'verify':result=await lab.verify();break;
      case 'alter':result=lab.alter();break;
      case 'query':result=lab.query(source,tenant);break;
      default:throw new Error('Unsupported lab action.');
    }
    self.postMessage({id,result});
  }catch(e){self.postMessage({id,error:e.message||'SQLite operation failed.'});}
  finally{working=false;}
};
