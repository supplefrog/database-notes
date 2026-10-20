// Static recording transport: exact same-origin files, GET only, no API host.
export const publicationBase=new URL('./',import.meta.url).href.replace(/\/$/,'');
export const recordingId="6c084dc3622c4e96bd2038e5741e215a";
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
export async function recordingRequest(path,options={}) {
  if(options.method!==undefined&&options.method!=='GET'||options.body!==undefined)throw new Error('Published evidence is read-only.');
  if(path==='/review/selected/context.json')return json(200,{source_origin:publicationBase,run_id:recordingId});
  if(path!=='/api/runs/'+recordingId)return json(404,{error:'This run is not part of the published recording.'});
  return fetch(new URL('./recording.json',import.meta.url),{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',headers:{Accept:'application/json'}});
}
