import {publicationBase} from './public-reader.js';
import {normalize, validRunId} from './model.js';

export function parseSelection(hash) {
  const params=new URLSearchParams(hash.replace(/^#/,'')), id=params.get('run');
  return {id:validRunId(id)?id:null,invalid:!!id&&!validRunId(id),
    interrupted:hash==='#creating'||params.has('pending'),hash};
}
export function validContext(value) {
  if(value?.source_origin!==publicationBase || !validRunId(value?.run_id))throw new Error('The recording configuration is invalid.');
  return value;
}

// Read-only lifecycle, separate from the original operation controller. The hash
// (including an inherited pending marker) is never reconciled or cleared here.
export function createReader({fetcher,location,history,render}) {
  let context=null,state=null,busy=false,error='',fresh=false,sequence=0,identity=null;
  const emit=()=>render({state,busy,error,fresh,context,...parseSelection(location.hash)});
  async function read(path) {
    const response=await fetcher(path,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error'});
    let value;try{value=await response.json();}catch{throw new Error('The status response could not be read.');}
    if(!response.ok)throw new Error(value.error||`Status read failed (${response.status}).`);
    return value;
  }
  async function refresh() {
    const ticket=++sequence, selection=parseSelection(location.hash);
    if(identity!==selection.id){state=null;identity=selection.id;}
    busy=true;fresh=false;error='';emit();
    try {
      if(!context)context=validContext(await read('/review/selected/context.json'));
      if(ticket!==sequence)return;
      if(selection.invalid)throw new Error('This link contains an invalid run identifier. Open Run details to inspect the existing flow.');
      if(!selection.id){busy=false;emit();return;}
      const next=normalize(await read('/api/runs/'+selection.id),selection.id);
      if(ticket!==sequence)return;
      state=next;fresh=true;
    }catch(problem){if(ticket!==sequence)return;error=problem.message||'The status read failed.';}
    finally{if(ticket===sequence){busy=false;emit();}}
  }
  async function start() {
    emit();
    try {
      context=validContext(await read('/review/selected/context.json'));
      const selection=parseSelection(location.hash),params=new URLSearchParams(location.hash.replace(/^#/,''));
      if(!location.hash||(!selection.id&&!selection.invalid&&!selection.interrupted&&params.get('view')==='recovery')){
        params.set('run',context.run_id);history.replaceState(null,'',location.pathname+'#'+params);
      }
      await refresh();
    }catch(problem){error=problem.message;emit();}
  }
  return {start,refresh};
}
