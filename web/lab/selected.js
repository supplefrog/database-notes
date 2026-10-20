import {recordingRequest} from './public-reader.js';
import {benchmarkEqual,event,formatMs,ratio,QUERY} from './model.js';
import {INDEX_FIELDS,canExplainIndex,timingPairs,sharedScale} from './workbench-data.js';
import {createReader} from './selected-controller.js';
import {installDisclosures} from './selected-motion.js';
import {updateRecordedMetadata} from './recorded-header.mjs';

const $=id=>document.getElementById(id), text=(id,value)=>{$(id).textContent=value;};
const ui={run:null,signature:null,tab:'plans',source:'index',field:'tenant_id',pinned:null,hovered:null,focused:null,pairs:[],benchmark:null,supported:false};
const explanations={
  tenant_id:'Leading equality key: tenant_id = 7 selects the query’s tenant.',
  state:'Second equality key: state = “open”. No proportion of open rows is implied.',
  created_minute:'Descending timestamp supplies newest-first order after the equality keys.',
  id:'Descending incident ID breaks timestamp ties in the requested order.',
  severity:'Selected data is available in the index, completing coverage for this query.',
};
function planLines(b,key){return Array.isArray(b?.plan?.[key])?b.plan[key].filter(row=>typeof row?.detail==='string').map(row=>row.detail):[];}
function summary(b,key){
  const lines=planLines(b,key);
  if(key==='scan'&&lines.some(s=>/^SCAN incidents\b/i.test(s))&&lines.some(s=>/USE TEMP B-TREE FOR ORDER BY/i.test(s)))return 'Full scan + temporary sort';
  if(key==='index'&&lines.some(s=>/SEARCH incidents USING COVERING INDEX queue_lookup/i.test(s))&&!lines.some(s=>/TEMP B-TREE/i.test(s)))return 'Covering-index search · order supplied by index';
  return lines.join(' · ')||'Plan unavailable';
}
function element(tag,className,value){const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;}
function setLink(id,url,label){const link=$(id);link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');if(label)link.replaceChildren(document.createTextNode(label),...(id==='recovery'?[element('span','', '→')]:[]));}
function updateLinks(view){
  const origin=view.context?.source_origin, hash=view.hash||'';
  const recoveryParams=new URLSearchParams(hash.replace(/^#/,''));recoveryParams.set('view','recovery');
  const recoveryUrl=origin+'/#'+recoveryParams;
  const recordedParams=new URLSearchParams(hash.replace(/^#/,''));recordedParams.delete('view');
  setLink('original',origin?origin+'/#'+recordedParams:null);
  setLink('slate',origin?recoveryUrl:null);
  setLink('recovery',origin&&view.id?recoveryUrl:null,'Open recovery exercise');
  text('recovery-copy','Run SQLite locally in your browser. Choose a restore and inspect the outcome.');
}
function updateTab(tab,{focus=false}={}){
  ui.tab=tab;
  $('plan-sources').hidden=tab==='timings';$('both-copies').hidden=tab!=='timings';
  for(const name of ['plans','timings']){
    const selected=name===tab,button=$(name+'-tab');button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;$(name+'-panel').hidden=!selected;
  }
  if(focus)$(tab+'-tab').focus();
}
function selectField(field){ui.field=field;updateInspection();}
function updateInspection(){
  $('specimen').dataset.source=ui.source;$('specimen').dataset.field=ui.field;
  for(const button of $('fields').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.field===ui.field));
  for(const token of $('query').querySelectorAll('[data-field]'))token.classList.toggle('selected',token.dataset.field===ui.field);
  for(const input of document.querySelectorAll('input[name=source]'))input.checked=input.value===ui.source;
  text('index-heading',ui.source==='scan'?'Comparison index column order':'Index column order');
  text('field-explanation',ui.supported?(ui.source==='scan'?'Baseline does not use this index. ':'')+explanations[ui.field]:'Specialized field inspection is unavailable for this recorded SQL/index contract.');
  const b=ui.benchmark, lines=summary(b,ui.source);
  let annotation=lines;
  if(ui.supported&&ui.source==='index'){
    if(ui.field==='state')annotation='Equality lookup · tenant 7, state = “open”';
    if(ui.field==='created_minute')annotation='Newest first · created_minute DESC, supplied by the index';
    if(ui.field==='id')annotation='Tie-breaking order · id DESC, supplied by the index';
    if(ui.field==='severity')annotation='Covering lookup · severity is available directly in the index';
  }
  text('plan-annotation',annotation);
  text('exact-plan-title',ui.source==='scan'?'Baseline plan':'Indexed plan');
  // Preserve all raw record fields, rather than reconstituting a plan from labels.
  text('exact-plan',Array.isArray(b?.plan?.[ui.source])?JSON.stringify(b.plan[ui.source],null,2):'Complete plan records unavailable.');
}
function renderQuery(b){
  const code=$('query').querySelector('code');code.replaceChildren();
  const query=typeof b?.query==='string'?b.query:QUERY;
  if(!ui.supported){code.textContent=query;return;}
  const tokens=/\b(tenant_id|state|created_minute|id|severity)\b/gi;let offset=0;
  for(const match of query.matchAll(tokens)){
    code.append(document.createTextNode(query.slice(offset,match.index)));
    const token=element('span','query-token',match[0]);token.dataset.field=match[0].toLowerCase();code.append(token);offset=match.index+match[0].length;
  }
  code.append(document.createTextNode(query.slice(offset)));
}
function buildSamples(){
  const rows=$('samples');rows.replaceChildren();const scale=sharedScale(ui.pairs);
  $('scale').replaceChildren(...scale.ticks.map(value=>element('span','',value.toLocaleString('en-US',{maximumFractionDigits:3})+' ms')));
  $('sample-unavailable').hidden=!!ui.pairs.length;
  const rawSamples={baseline_ms:ui.benchmark?.timings?.scan?.samples_ms??null,indexed_ms:ui.benchmark?.timings?.index?.samples_ms??null};
  text('raw-samples-data',JSON.stringify(rawSamples,null,2));
  $('raw-samples').hidden=rawSamples.baseline_ms===null&&rawSamples.indexed_ms===null;
  for(const pair of ui.pairs){
    const row=element('tr');row.dataset.pair=String(pair.pair);
    const heading=element('th');heading.scope='row';const button=element('button','sample-button','Pair '+pair.pair);button.type='button';button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label',`Pin pair ${pair.pair}: baseline ${formatMs(pair.baseline)} milliseconds, indexed ${formatMs(pair.index)} milliseconds`);
    heading.append(button);row.append(heading);
    const plot=element('td','sample-plot');plot.setAttribute('aria-hidden','true');
    for(const key of ['baseline','index']){const bar=element('span','sample-bar '+key);bar.style.setProperty('--fraction',String(pair[key]/scale.max));plot.append(bar);}
    row.append(plot);
    for(const key of ['baseline','index'])row.append(element('td','sample-value',formatMs(pair[key])));
    button.addEventListener('click',()=>{ui.pinned=ui.pinned===pair.pair?null:pair.pair;updateSamples();});
    row.addEventListener('mouseenter',()=>{ui.hovered=pair.pair;updateSamples();});row.addEventListener('mouseleave',()=>{ui.hovered=null;updateSamples();});
    button.addEventListener('focus',()=>{ui.focused=pair.pair;updateSamples();});button.addEventListener('blur',()=>{ui.focused=null;updateSamples();});
    rows.append(row);
  }
  updateSamples();
}
function updateSamples(){
  const active=ui.pinned??ui.focused??ui.hovered;
  for(const row of $('samples').children){const pair=Number(row.dataset.pair);row.classList.toggle('active',pair===active);row.classList.toggle('pinned',pair===ui.pinned);row.querySelector('button').setAttribute('aria-pressed',String(pair===ui.pinned));}
  const pair=ui.pairs.find(p=>p.pair===active);
  text('sample-readout',pair?`Pair ${pair.pair}${ui.pinned?' · pinned':''}: baseline ${formatMs(pair.baseline)} ms; indexed ${formatMs(pair.index)} ms.`:ui.pairs.length?'No sample pinned. All measured pairs are shown above.':'No sample pinned. Complete paired samples are unavailable.');
  $('clear-sample').disabled=ui.pinned===null;
}
function clearSample(){ui.pinned=null;ui.hovered=null;ui.focused=null;updateSamples();}
function renderBenchmark(state){
  const b=state.benchmark||null, signature=JSON.stringify(b);
  if(ui.signature!==signature){
    ui.signature=signature;ui.benchmark=b;
    // A known index definition alone does not prove that the planner used it.
    // Specialized coverage/order annotations require the actual returned plan.
    ui.supported=canExplainIndex(b)&&planLines(b,'index').some(line=>/SEARCH incidents USING COVERING INDEX queue_lookup/i.test(line))&&!planLines(b,'index').some(line=>/TEMP B-TREE/i.test(line));
    if(!ui.supported)ui.field='tenant_id';
    ui.pairs=timingPairs(b);ui.pinned=null;ui.hovered=null;ui.focused=null;
    renderQuery(b);$('fields').replaceChildren();
    for(const field of INDEX_FIELDS){const button=element('button','field',field.label);button.type='button';button.dataset.field=field.key;button.disabled=!ui.supported;button.addEventListener('click',()=>selectField(field.key));$('fields').append(button);}
    buildSamples();
  }
  text('query-title',ui.supported?'Tenant 7’s 50 newest open incidents':b?'Inspect the recorded query':'No query measurement recorded');
  text('parameters',b?'Parameters: '+(Array.isArray(b.parameters)?JSON.stringify(b.parameters):'unavailable'):'Fixed lab query · parameters [7, "open"] · not yet measured');
  $('unmeasured-evidence').hidden=!!b;
  for(const id of ['plan-details','result-details']){const details=$(id);details.dataset.unavailable=String(!b);details.querySelector('summary').setAttribute('aria-disabled',String(!b));}
  $('specimen').hidden=!ui.supported;$('unsupported-plan').hidden=ui.supported;
  text('unsupported-query',typeof b?.query==='string'?b.query:'Open the existing flow to measure this run. This view only reads status.');
  text('baseline-median',formatMs(b?.timings?.scan?.median_ms)??'—');text('index-median',formatMs(b?.timings?.index?.median_ms)??'—');
  text('baseline-summary',summary(b,'scan'));text('index-summary',summary(b,'index'));
  const r=ratio(b);text('ratio',r===null?'—':r.toLocaleString('en-US',{maximumFractionDigits:1,minimumFractionDigits:1})+'×');
  const equal=benchmarkEqual(state),different=event(state,'query_measurement')?.results_equal===false;
  $('agreement').dataset.equal=String(equal);text('agreement-mark',equal?'✓':different?'!':'?');
  text('agreement-title',equal?`${b.result_count.toLocaleString('en-US')} ordered results match`:different?'Recorded results differ':'Agreement not established');
  text('agreement-copy',equal?'Shared ordered-result SHA-256 recorded.':different?'Inspect the recorded result evidence.':'Complete comparison evidence is unavailable.');
  const hash=/^[0-9a-f]{64}$/.test(b?.result_sha256||'')?b.result_sha256:null;
  text('result-hash',hash??'Full ordered-result hash unavailable.');$('copy-hash').disabled=!hash;
  text('result-record',`Run ${state.run_id} · stage ${state.stage}. ${equal?'The query-measurement event records equal fetched results.':different?'The query-measurement event records unequal fetched results.':'No complete matching query-measurement evidence is recorded.'} ${Number.isInteger(b?.result_count)?'Recorded ordered-result count: '+b.result_count+'.':''}`);
  text('index-sql',typeof b?.index_sql==='string'?b.index_sql:'Index definition unavailable.');
  text('exact-query',(typeof b?.query==='string'?b.query:'Query unavailable.')+'\n\nParameters: '+JSON.stringify(b?.parameters??null));
  const method=b?.method;
  text('method',method?`${Number.isInteger(method.warmups_per_variant)?method.warmups_per_variant:'Unknown'} warm-ups and ${Number.isInteger(method.repeats_per_variant)?method.repeats_per_variant:'unknown'} timed repeats per variant. ${method.order||'Execution order unavailable'}. Clock: ${method.clock||'unavailable'}; ${method.fetch_all_in_timing===true?'all results fetched inside the timing':'fetch timing scope unconfirmed'}. ${method.cache||'Cache conditions unavailable'}. ${method.limits||''}`:'Timing methodology unavailable.');
  updateInspection();
}
function render(view){
  updateLinks(view);
  if(ui.run!==view.id){ui.run=view.id;ui.signature=null;ui.tab='plans';ui.source='index';ui.field='tenant_id';clearSample();updateTab('plans');}
  const state=view.state;
  const notice=view.busy?'Loading recorded evidence…':view.interrupted?'An interrupted operation marker is present. This read-only view preserves it. Open recovery to inspect its outcome.':state&&!view.fresh?'Last confirmed evidence is shown; current status has not been established.':state?.stage==='verification_failed'?'Recovery verification reports a mismatch. The query comparison below concerns the separate benchmark copies.':'';
  text('status-notice',notice);text('error-notice',view.error);$('error-notice').hidden=!view.error;
  $('experiment').hidden=!state;$('empty').hidden=!!state;
  text('empty-copy',view.busy?'Reading the existing experiment.':view.interrupted&&!view.id?'Creation was interrupted without a run identifier. Its outcome is uncertain; no new run will be created here.':view.id?'The experiment could not be read. No operation has been attempted.':'Open this view with an existing run identifier. This inspection never creates experiments.');
  updateRecordedMetadata(view);
  // Keep the invoking control focusable during a read; stale responses are
  // sequence-guarded by the reader, and the click handlers suppress duplicates.
  for(const id of ['refresh','refresh-empty'])$(id).setAttribute('aria-disabled',String(view.busy));
  if(!state)return;
  renderBenchmark(state);
  text('qualification',`${view.fresh?'Read-only recording captured from the local lab. The recovery exercise separately runs browser SQLite.':'Last confirmed evidence; current status read failed or is pending.'} ${state.engine}. Single-process fixed fixture; warm-cache timings vary and do not represent production performance. The schematic is explanatory, not a trace of execution or rows read.`);
}

for(let i=1;i<=24;i++){$('bands').append(element('div','band'));$('tenant-axis').append(element('span','',String(i)));}
// The fragment is the experiment address. Local reading navigation must not
// replace its run identifier or any inherited operation marker.
for(const link of document.querySelectorAll('a[href="#main"]'))link.addEventListener('click',event=>{event.preventDefault();$('main').focus({preventScroll:true});$('main').scrollIntoView({block:'start',behavior:'instant'});});
for(const tab of ['plans','timings']){
  $(tab+'-tab').addEventListener('click',()=>updateTab(tab));
  $(tab+'-tab').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'plans':event.key==='End'?'timings':ui.tab==='plans'?'timings':'plans';updateTab(next,{focus:true});}});
}
for(const source of document.querySelectorAll('input[name=source]'))source.addEventListener('change',()=>{if(source.checked){ui.source=source.value;updateInspection();}});
$('clear-sample').addEventListener('click',clearSample);
$('timings-panel').addEventListener('keydown',event=>{if(event.key==='Escape'&&ui.pinned!==null){event.preventDefault();clearSample();}});
$('copy-hash').addEventListener('click',async()=>{const hash=ui.benchmark?.result_sha256;if(!/^[0-9a-f]{64}$/.test(hash||''))return;try{await navigator.clipboard.writeText(hash);text('copy-status','Full hash copied.');}catch{text('copy-status','Copy is unavailable. Select the full hash above to copy it.');}});
installDisclosures();
const reader=createReader({fetcher:recordingRequest,location,history,render});
for(const id of ['refresh','refresh-empty'])$(id).addEventListener('click',()=>{if($(id).getAttribute('aria-disabled')!=='true')reader.refresh();});
addEventListener('hashchange',reader.refresh);
reader.start();
