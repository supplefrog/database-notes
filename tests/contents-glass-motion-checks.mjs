// Checks measured browser frames, not renderer internals or saved expectations.
export function contentsMotionProblems(report){
  const issues=[],frames=report.frames.filter(f=>f.ready&&f.rows.length&&f.shape);
  if(!frames.length&&report.trigger?.type==='initial'&&!report.frames.some(f=>f.open))return [];
  if(frames.length<3)return ['Insufficient observed rendered frames'];
  const add=message=>{if(!issues.includes(message))issues.push(message);};
  for(let i=0;i<frames.length;i++){
    const f=frames[i],previous=frames[i-1];
    if(previous&&!report.reduced&&f.width===previous.width&&f.time-previous.time<40&&f.rows.some((r,j)=>Math.abs(Number(r.weight)-Number(previous.rows[j].weight))>=150))add('Text weight switches abruptly between rendered frames');
    if(previous&&f.width===previous.width&&f.open===previous.open){
      if(f.rows.some((r,j)=>Math.abs(r.height-previous.rows[j].height)>.1||Math.abs(r.width-previous.rows[j].width)>.1))add('Topic text reflows during selection or scrolling');
    }
    if(!f.open&&f.opacity>0&&previous&&!previous.open&&previous.opacity>0){
      if(f.canvas?.width!==previous.canvas?.width||f.canvas?.height!==previous.canvas?.height||f.canvas?.hidden)add('Glass bitmap resets during visible narrow exit');
      if(f.rows.some((r,j)=>r.weight!==previous.rows[j].weight||Math.abs(r.stroke-previous.rows[j].stroke)>.001))add('Text repaints independently of frozen glass during narrow exit');
    }
    if(f.open&&!report.reduced&&previous&&previous.open&&f.width===previous.width){
      const dt=f.time-previous.time;
      if(dt>0&&dt<40&&f.rows.some((r,j)=>Math.abs(r.emphasis-previous.rows[j].emphasis)>.45))add('Text emphasis jumps between adjacent rendered frames');
    }
  }
  return issues;
}
