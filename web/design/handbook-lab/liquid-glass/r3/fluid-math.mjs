import {springStep} from '../r2/glass-math.mjs';
export const axes=['x','y','w','h'];
export const zeroVelocity=()=>({x:0,y:0,w:0,h:0});
export function labelShape(ink,padding,magnification=1){
  const w=Math.max(24,ink.w*magnification+padding.left+padding.right+8);
  const h=Math.max(padding.minimumHeight,ink.h*magnification+padding.top+padding.bottom);
  return {x:ink.x+ink.w/2-w/2,y:ink.y+ink.h/2-h/2,w,h};
}
export function interpolateShapes(stops,shapes,position){
  if(!shapes.length)return {shape:{x:0,y:0,w:24,h:36},fraction:0,left:0,right:0};
  let left=stops[0]?.index||0,right=left,fraction=0;
  if(position>=(stops.at(-1)?.at??0)){left=right=stops.at(-1)?.index??0;fraction=1;}
  else if(position>(stops[0]?.at??0))for(let i=1;i<stops.length;i++)if(position<stops[i].at){
    const a=stops[i-1],b=stops[i];left=a.index;right=b.index;fraction=Math.max(0,Math.min(1,(position-a.at)/(b.at-a.at)));break;
  }
  const shape=Object.fromEntries(axes.map(axis=>[axis,shapes[left][axis]+(shapes[right][axis]-shapes[left][axis])*fraction]));
  return {shape,fraction,left,right};
}
export function advanceShape(shape,velocity,target,seconds,reduced=false){
  if(reduced)return {shape:{...target},velocity:zeroVelocity()};
  const next={},speed={};
  for(const axis of axes){const step=springStep(shape[axis],velocity[axis],target[axis],seconds);next[axis]=step.y;speed[axis]=step.velocity;}
  for(const axis of ['w','h'])if(next[axis]<24){next[axis]=24;if(speed[axis]<0)speed[axis]=0;}
  return {shape:next,velocity:speed};
}
export function settled(shape,velocity,target){return axes.every(axis=>Math.abs(shape[axis]-target[axis])<.015&&Math.abs(velocity[axis])<.1);}
export const pinTopic=(index,expectedY)=>({kind:'topic',index,expectedY});
export const followScroll=()=>({kind:'scroll',index:null,expectedY:null});
export function observeScroll(owner,position){return owner.kind==='topic'&&Math.abs(position-owner.expectedY)>.5?followScroll():owner;}
