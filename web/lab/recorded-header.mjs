// The recording reader owns recorded metadata even while its view is hidden.
// View navigation restores this latest projection, never stale rendered text.
let latest=null;
const $=id=>document.getElementById(id),text=(id,value)=>{$(id).textContent=value;};
export function updateRecordedMetadata(view){
  const {state,fresh,interrupted,busy,id}=view;
  latest={engine:state?`Recorded ${state.engine} / benchmark`:'Recorded SQLite / benchmark',
    stage:state?(fresh?'':'Last confirmed · ')+state.stage.replaceAll('_',' '):busy?'Reading status':'Status unavailable',
    confirmed:!!state&&fresh&&!interrupted&&state.stage!=='verification_failed',failed:state?.stage==='verification_failed'};
  text('run-id',state?.run_id||id||'No run identifier');
  text('run-stage',state?state.stage+(fresh?'':' · last confirmed'):'Unavailable');
  text('fixture',state?`${state.seed||'Unnamed fixture'} · ${state.seed_rows.toLocaleString('en-US')} seeded rows`:'Unavailable');
  if(document.body.dataset.view!=='recovery')showRecordedHeader();
}
export function showRecordedHeader(){
  if(!latest)return;
  text('engine',latest.engine);text('stage',latest.stage);
  $('stage').dataset.confirmed=String(latest.confirmed);$('stage').dataset.failed=String(latest.failed);
}
