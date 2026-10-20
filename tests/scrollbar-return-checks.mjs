import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const frames=traces=>traces.flatMap(t=>t.frames);
function checkBottomVisible(all){assert(all.some(f=>f.max>0&&Math.abs(f.max-f.y)<=1&&f.top.visible&&!f.top.inert),'Short-page bottom has no active return button');}
export function checkShortBottom(traces){
 const all=frames(traces),short=all.filter(f=>f.max>0&&f.max<Math.max(1500,f.height*2.5));
 assert(short.some(f=>f.max-f.y>5&&f.max-f.y<20&&!f.top.visible),'Missing hidden state just above the bottom');
 checkBottomVisible(short);
 assert(short.filter(f=>f.top.presence>0&&f.top.presence<1).length>=3,'No intermediate bubble entrance');
 assert(new Set(all.map(f=>f.history)).size===1,'Scroll inserted history');
}
export function checkReturn(traces){
 const all=frames(traces),last=all.at(-1);assert(last.y<1&&last.focus==='page-top'&&!last.top.visible&&last.top.inert,'Return misses top/focus or remains active');
 assert(new Set(all.map(f=>f.history)).size===1&&new Set(all.map(f=>f.url)).size===1,'Return changes history or URL');
}
export function checkNativeBars(wide,narrow){
 const sides=frames(wide).map(f=>f.aside).filter(Boolean),codes=frames(narrow).map(f=>f.code).filter(Boolean);
 assert(sides.some(s=>s.track===0)&&sides.some(s=>s.track>.99),'Vertical hover does not reveal its track');
 assert(new Set(sides.map(s=>[s.w,s.clientWidth,s.lane].join(','))).size===1,'Vertical hover changes the lane or content width');
 assert(codes.some(s=>s.pill===0)&&codes.some(s=>s.pill>.99),'Horizontal pill does not hide/reveal');
 assert(codes.some(s=>s.scrollLeft>10),'No native horizontal movement was observed');
 assert(new Set(codes.map(s=>[s.w,s.h,s.clientWidth,s.clientHeight].join(','))).size===1,'Horizontal reveal changes geometry');
 assert(codes.every(s=>s.thumb.trim()==='#a0a497'),'Dark-code thumb palette differs from the approved preview');
 assert(frames(narrow).every(f=>!f.overflow),'Narrow document has horizontal overflow');
}
export async function verifyEvidence(folder,runtime){
 const read=name=>readFile(path.join(folder,name),'utf8').then(JSON.parse),stamp=await read('scrollbar-release-stamp.json');
 for(const [name,sha]of Object.entries(stamp.runtime_sha256))assert.equal(createHash('sha256').update(await readFile(path.join(runtime,name))).digest('hex'),sha,'Fresh affected browser evidence is required for '+name);
 checkShortBottom(await read('short-page-bottom.json'));checkReturn(await read('short-page-return.json'));
 const control=frames(await read('short-page-old-control.json'));assert(control.some(f=>f.max>0&&Math.abs(f.max-f.y)<=1),'Old control never reached the bottom');assert.throws(()=>checkBottomVisible(control),/no active return button/);
 const wide=await read('integrated-scrollbars-wide.json'),narrow=await read('integrated-scrollbars-narrow.json');checkNativeBars(wide,narrow);
 return {status:'pass',scope:'Source-stamped native in-app browser observations; not a browser rerun or other-engine certification'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await verifyEvidence(process.argv[2],process.argv[3]||fileURLToPath(new URL('../web/design/handbook-lab/',import.meta.url))));
