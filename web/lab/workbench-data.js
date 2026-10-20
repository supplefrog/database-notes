// Read-only adapters: chart, table and inspection share these exact records.
import {QUERY} from './model.js';
export function timingPairs(benchmark) {
  const scan=benchmark?.timings?.scan?.samples_ms, index=benchmark?.timings?.index?.samples_ms;
  if(!Array.isArray(scan)||!Array.isArray(index)||scan.length!==index.length||!scan.length)return [];
  if(![...scan,...index].every(v=>Number.isFinite(v)&&v>=0))return [];
  return scan.map((baseline,i)=>({pair:i+1,baseline,index:index[i]}));
}
export function sharedScale(pairs) {
  const max=Math.max(0,...pairs.flatMap(p=>[p.baseline,p.index]));
  if(max===0)return {max:1,ticks:[0,.25,.5,.75,1]};
  const magnitude=10**Math.floor(Math.log10(max));
  const upper=Math.ceil(max/magnitude*2)/2*magnitude;
  return {max:upper,ticks:Array.from({length:5},(_,i)=>upper*i/4)};
}
const EXPECTED_INDEX='CREATE INDEX queue_lookup ON incidents(tenant_id,state,created_minute DESC,id DESC,severity)';
export const INDEX_FIELDS=[
  {key:'tenant_id',label:'tenant_id',explanation:'Filters to tenant 7.'},
  {key:'state',label:'state',explanation:'Filters to open incidents.'},
  {key:'created_minute',label:'created_minute DESC',explanation:'Supports the requested newest-first order.'},
  {key:'id',label:'id DESC',explanation:'Supplies the query’s tie-breaking order.'},
  {key:'severity',label:'severity',explanation:'A selected field available directly from the covering index.'},
];
const canonical=s=>typeof s==='string'?s.replace(/\s+/g,'').replace(/;$/,'').toLowerCase():'';
export function canExplainIndex(b) {return canonical(b?.index_sql)===canonical(EXPECTED_INDEX)&&canonical(b?.query)===canonical(QUERY)&&b?.parameters?.[0]===7&&b?.parameters?.[1]==='open'&&b.parameters.length===2;}
export function planSummary(b,key) {
  const lines=(b?.plan?.[key]||[]).map(p=>p.detail).filter(x=>typeof x==='string');
  if(key==='scan'&&lines.some(x=>/^SCAN incidents\b/i.test(x))&&lines.some(x=>/USE TEMP B-TREE FOR ORDER BY/i.test(x)))return 'Full scan + temporary sort';
  if(key==='index'&&lines.some(x=>/SEARCH incidents USING COVERING INDEX queue_lookup/i.test(x))&&!lines.some(x=>/TEMP B-TREE/i.test(x)))return 'Covering-index search · no separate sort';
  return lines.join(' · ')||'Plan unavailable';
}
