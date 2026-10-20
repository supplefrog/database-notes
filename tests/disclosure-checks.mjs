export function geometryIssues(batches){
 const frames=batches.flatMap(b=>b.frames),issues=[];
 const add=x=>{if(!issues.includes(x))issues.push(x);};
 if(frames.length<4)add('No useful intermediate-frame observation');
 for(let i=1;i<frames.length;i++){
  const a=frames[i-1],b=frames[i];if(a.width!==b.width||a.height!==b.height)continue;
  if(b.overflow>0)add('Document overflows horizontally');
  if(Math.abs(a.aside.client-b.aside.client)>.1)add('Scrollbar threshold changes rail content width');
  if(Math.abs(a.nav.client-b.nav.client)>.1)add('Scrollbar threshold changes menu content width');
  if(a.groups.some((g,j)=>Math.abs(g.summary.x-b.groups[j].summary.x)>.1||Math.abs(g.summary.w-b.groups[j].summary.w)>.1))add('Disclosure labels shift horizontally during their own transition');
  if(b.canvases>1)add('More than one optical canvas paints the section labels');
  if(b.glass?.error)add('Optical renderer failed');
  const visible=f=>f.menu.opacity>.02&&f.groups.some(g=>g.open&&g.opacity>.02);
  if(visible(a)&&visible(b)&&b.t>a.t&&b.t-a.t<40&&a.glass?.reveal&&b.glass?.reveal&&Math.abs(a.glass.reveal.value-b.glass.reveal.value)>.3)add('Visible bubble expansion restarts between adjacent frames');
 }
 return issues;
}
export function entranceEvidence(batches){
 const frames=batches.flatMap(b=>b.frames),visible=frames.filter(f=>f.glass?.enabled&&f.canvas&&!f.canvas.hidden&&f.menu.opacity>.01&&f.groups.some(g=>g.open&&g.opacity>.01));
 const ratios=visible.map(f=>(f.glass.surface||f.glass.shape).h/f.glass.shape.h);
 return {first:ratios[0],minimum:Math.min(...ratios),maximum:Math.max(...ratios),last:ratios.at(-1),frames:visible.length,partial:ratios.filter(v=>v>.25&&v<.98).length,overshoot:ratios.filter(v=>v>1.005).length};
}
export function entranceIssues(batches){
 const e=entranceEvidence(batches),reduced=batches[0]?.frames[0]?.reduced;
 if(reduced)return e.frames&&Math.abs(e.last-1)<.01?[]:['Reduced-motion bubble is not settled'];
 const issues=[];
 if(e.frames<4||e.partial<3)issues.push('Bubble appears at full size without observed expanding frames');
 if(!e.overshoot||e.maximum>1.06)issues.push('Restrained bubble overshoot/settle was not observed');
 if(Math.abs(e.last-1)>.005)issues.push('Bubble has not settled at its real reading geometry');
 return issues;
}
