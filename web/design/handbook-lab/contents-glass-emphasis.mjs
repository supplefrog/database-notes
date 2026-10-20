// Paint emphasis follows the drawn glass, never its commanded destination or
// the semantic reading observer. Fixed text metrics keep wrapping stationary.
export const emphasisStroke=.35;
export function emphasisWeights(glass,rows,targetIndex=null){
  const cx=glass.x+glass.w/2,cy=glass.y+glass.h/2;
  const weights=rows.map((row,index)=>{
    if(targetIndex!==null&&index!==targetIndex)return 0;
    const distance=Math.max(
      Math.abs(cy-row.y-row.h/2)/Math.max(12,row.h/2),
      Math.abs(cx-row.x-row.w/2)/Math.max(24,row.w/2),
      Math.abs(glass.w-row.w)/Math.max(24,row.w*.75),
      Math.abs(glass.h-row.h)/Math.max(24,row.h*.75));
    const t=Math.max(0,Math.min(1,1-distance));
    return t*t*(3-2*t);
  });
  // Adjacent padded ink boxes can overlap by a fraction of a line. The two
  // strongest rows also bound the shader's identical emphasis uniforms.
  const active=weights.map((weight,index)=>({weight,index})).sort((a,b)=>b.weight-a.weight).slice(0,2);
  return weights.map((weight,index)=>active.some(row=>row.index===index)?weight:0);
}
export function blendEmphasis(previous,target,seconds,reduced=false){
  if(reduced)return [...target];
  const fraction=1-Math.exp(-Math.min(.04,Math.max(0,seconds))/.07);
  return target.map((value,index)=>(previous[index]||0)+(value-(previous[index]||0))*fraction);
}
