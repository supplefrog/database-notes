// A damped material entrance. Retarget from present state, never replay a keyframe.
export function revealStep(state,target,seconds,reduced=false){
 if(reduced)return {value:target,velocity:0};
 const dt=Math.max(0,Math.min(.04,seconds)),omega=24,zeta=.7,damped=omega*Math.sqrt(1-zeta*zeta);
 const x=state.value-target,a=(state.velocity+zeta*omega*x)/damped,e=Math.exp(-zeta*omega*dt),s=Math.sin(damped*dt),c=Math.cos(damped*dt);
 return {value:target+e*(x*c+a*s),velocity:e*((-zeta*omega*x+a*damped)*c+(-zeta*omega*a-x*damped)*s)};
}
export const revealSettled=state=>Math.abs(state.value-1)<.001&&Math.abs(state.velocity)<.01;
export function revealShape(shape,value){
 const p=Math.max(0,Math.min(1.06,value)),w=shape.w*(.58+.42*p),h=shape.h*(.24+.76*p);
 return {x:shape.x+(shape.w-w)/2,y:shape.y+(shape.h-h)/2,w,h,opacity:Math.max(0,Math.min(1,p))};
}
