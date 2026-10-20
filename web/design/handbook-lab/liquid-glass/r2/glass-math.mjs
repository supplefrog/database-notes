export function progressStops(anchors, rows, readingLine, maxScroll) {
  const stops=[];
  anchors.forEach((anchor,index)=>{
    const at=Math.max(stops.at(-1)?.at||0,Math.min(maxScroll,Math.max(0,anchor-readingLine)));
    const stop={at,y:rows[index].top,height:rows[index].height,index};
    if(stops.length&&Math.abs(at-stops.at(-1).at)<.001)stops[stops.length-1]=stop;
    else stops.push(stop);
  });
  return stops;
}
export function progressAt(stops, position) {
  if(!stops.length)return {y:0,height:36,fraction:0,left:0,right:0};
  if(position<=stops[0].at)return {...stops[0],fraction:0,left:stops[0].index,right:stops[0].index};
  for(let i=1;i<stops.length;i++)if(position<stops[i].at){
    const a=stops[i-1],b=stops[i],fraction=Math.max(0,Math.min(1,(position-a.at)/(b.at-a.at)));
    return {y:a.y+(b.y-a.y)*fraction,height:a.height+(b.height-a.height)*fraction,fraction,left:a.index,right:b.index};
  }
  const last=stops.at(-1);return {...last,fraction:1,left:last.index,right:last.index};
}
export function springStep(y,velocity,target,seconds) {
  const dt=Math.min(.04,Math.max(0,seconds)),omega=25,x=y-target,k=velocity+omega*x,decay=Math.exp(-omega*dt);
  return {y:target+(x+k*dt)*decay,velocity:(velocity-omega*k*dt)*decay};
}
