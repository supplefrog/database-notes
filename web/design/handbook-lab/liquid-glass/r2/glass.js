import {progressStops,progressAt,springStep} from './glass-math.mjs';
const panel=document.querySelector('.section-panel'),links=[...document.querySelectorAll('.section-links a')];
const base=document.querySelector('#label-paint'),glass=document.querySelector('#glass'),source=document.createElement('canvas');
const enable=document.querySelector('#enable-glass'),reduce=document.querySelector('#reduce'),mode=document.querySelector('#comparison');
const thickness=document.querySelector('#thickness'),ior=document.querySelector('#ior'),lens=document.querySelector('#lens');
const quality=document.querySelector('#quality'),samples=document.querySelector('#samples'),message=document.querySelector('#render-status');
const motion=matchMedia('(prefers-reduced-motion:reduce)'),contrast=matchMedia('(forced-colors:active)');
const maxShift=18;
let gutter=16,sourceGutter=36;
let current=0,hovered=-1,y=0,target=0,height=36,velocity=0,frame=0,last=0,frames=0,labelPaints=0,allocations=0;
let effective=false,onscreen=false,geometryDirty=true,storageDirty=true,labelsDirty=true,paintFailure=false,shaderError='',textureScale=1;
let width=250,panelHeight=252,maxHeight=36,anchors=[],rows=[],stops=[],maxScroll=0,readingLine=120,progress={fraction:0,left:0,right:0};
let dpr=devicePixelRatio||1,output=[0,0],renderSize=[0,0],sourceSize=[0,0],sourceOffset=[0,0],sizeKey='';
let firstInput=0,inputToDrawCallbackMs=0,activeRafIntervalsMs=[],gl,surface,horizontal,vertical,bgTexture,sceneTexture,resolveTexture,sceneFbo,resolveFbo;
const reduced=()=>motion.matches||reduce.checked;
const glassMode=()=>effective&&(mode.value==='glass'||mode.value==='ior1');
const rasterMode=()=>effective&&mode.value==='raster';
const canDraw=()=>effective&&mode.value!=='native'&&onscreen&&!document.hidden&&!panel.closest('details:not([open])');
const vertex=`#version 300 es
layout(location=0) in vec2 position;out vec2 uv;
void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D background;
uniform vec2 viewSize,panelSize,sourceSize,sourceOffset;
uniform float top,slabHeight,thickness,indexOfRefraction,lensScale,gutter;
float sdf(vec2 p){vec2 q=abs(p)-vec2(panelSize.x*.5-4.,slabHeight*.5)+7.;return length(max(q,0.))+min(max(q.x,q.y),0.)-7.;}
float surfaceHeight(vec2 p){
 float d=sdf(p),b=clamp(-d/6.5,0.,1.);
 float bevel=sqrt(max(0.,1.-(1.-b)*(1.-b)));
 float nx=p.x/max(1.,panelSize.x*.5-4.),ny=p.y/max(1.,slabHeight*.5);
 float crown=2.1*max(0.,1.-ny*ny)*max(0.,1.-nx*nx);
 return thickness*bevel+crown*smoothstep(0.,3.,-d);
}
void main(){
 vec2 local=vec2(uv.x*viewSize.x,(1.-uv.y)*viewSize.y);
 vec2 center=vec2(panelSize.x*.5,top+gutter+slabHeight*.5);
 vec2 global=vec2(local.x-gutter,top+local.y),p=global-center;
 float d=sdf(p),aa=max(fwidth(d),.035),coverage=1.-smoothstep(-aa,aa,d);
 float shadow=(1.-smoothstep(-1.,8.,sdf(p-vec2(0.,3.))))*.12;
 float h=surfaceHeight(p),e=.25;
 vec2 gradient=vec2(surfaceHeight(p+vec2(e,0.))-surfaceHeight(p-vec2(e,0.)),surfaceHeight(p+vec2(0.,e))-surfaceHeight(p-vec2(0.,e)))/(2.*e);
 vec3 normal=normalize(vec3(-gradient,1.));
 vec3 incident=normalize(vec3(p.x/900.,p.y/900.-.12,-1.));
 vec3 inside=refract(incident,normal,1./indexOfRefraction);
 vec3 outgoing=refract(inside,vec3(0.,0.,1.),indexOfRefraction);
 vec2 shift=(inside.xy/max(.08,-inside.z)-incident.xy/-incident.z)*h;
 if(length(outgoing)>.01)shift+=(outgoing.xy/max(.08,-outgoing.z)-incident.xy/-incident.z)*3.;
 shift=clamp(shift,vec2(-18.),vec2(18.));
 float optical=clamp((indexOfRefraction-1.)/.48,0.,1.4);
 float enlargement=1.+(lensScale-1.)*optical*smoothstep(0.,6.5,-d);
 vec2 sampleAt=center+(global-center)/enlargement+shift;
 vec3 transmitted=texture(background,(sampleAt+sourceOffset)/sourceSize).rgb;
 float f0=pow((indexOfRefraction-1.)/(indexOfRefraction+1.),2.);
 float fresnel=f0+(1.-f0)*pow(1.-max(0.,dot(-incident,normal)),5.);
 vec3 light=normalize(vec3(-.35,-.65,1.)),halfway=normalize(light-incident);
 float spec=pow(max(0.,dot(normal,halfway)),70.),rim=exp(-abs(d+1.1)*1.7);
 vec3 reflected=mix(vec3(.32,.31,.29),vec3(.98,.98,.96),smoothstep(-.15,.9,normal.y));
 vec3 material=mix(transmitted,reflected,fresnel*.65);
 material=mix(material,vec3(.96,.96,.94),.025)+vec3(spec*.16+rim*.05);
 color=vec4(material*coverage,coverage+shadow*(1.-coverage));
}`;
const tent=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D image;uniform vec2 stepUV;uniform float radius;
void main(){vec4 sum=vec4(0.);float weights=0.;for(int i=-12;i<=12;i++){
 float w=max(0.,1.-abs(float(i))/radius);sum+=texture(image,uv+stepUV*float(i))*w;weights+=w;
}color=sum/max(weights,.0001);}`;
function program(v,f){
 const shader=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,v),fs=shader(gl.FRAGMENT_SHADER,f);
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 const locations=new Map();return {program:p,u:name=>{if(!locations.has(name))locations.set(name,gl.getUniformLocation(p,name));return locations.get(name);}};
}
function texture(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function stop(){cancelAnimationFrame(frame);frame=0;last=0;velocity=0;}
function fail(error){paintFailure=true;shaderError=String(error.message||error);stop();refresh();}
try{
 gl=glass.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,depth:false,stencil:false});
 if(!gl)throw Error('WebGL 2 unavailable');
 surface=program(vertex,fragment);horizontal=program(vertex,tent);vertical=program(vertex,tent);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 bgTexture=texture();sceneTexture=texture();resolveTexture=texture();sceneFbo=gl.createFramebuffer();resolveFbo=gl.createFramebuffer();
}catch(error){shaderError=String(error.message||error);}
glass.addEventListener('webglcontextlost',()=>{shaderError='WebGL context lost';stop();refresh();});
function measure(){
 // Include shadow, silhouette AA and the physical-pixel resolve footprint at zoom-out.
 gutter=Math.ceil(Math.max(16,12+2/dpr));sourceGutter=Math.ceil(gutter+maxShift+2/dpr);
 width=panel.clientWidth;panelHeight=panel.scrollHeight;const box=panel.getBoundingClientRect();
 rows=links.map(a=>{const r=a.getBoundingClientRect();return {top:r.top-box.top,height:r.height};});
 maxHeight=Math.max(1,...rows.map(r=>r.height));
 anchors=links.map(a=>document.getElementById(a.hash.slice(1)).getBoundingClientRect().top+scrollY);
 maxScroll=Math.max(0,document.documentElement.scrollHeight-innerHeight);readingLine=Math.min(innerHeight/3,120);
 stops=progressStops(anchors,rows,readingLine,maxScroll);geometryDirty=false;storageDirty=labelsDirty=true;
}
function storage(){
 const limit=gl?Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),8192):8192;
 const cw=width+gutter*2,ch=maxHeight+gutter*2;
 const physical=Math.min(dpr,limit/Math.max(cw,ch));
 const ow=Math.max(1,Math.round(cw*physical)),oh=Math.max(1,Math.round(ch*physical));
 const factor=Math.min(+quality.value*+samples.value,limit/ow,limit/oh);
 const rw=Math.max(ow,Math.round(ow*factor)),rh=Math.max(oh,Math.round(oh*factor));
 glass.style.left=-gutter+'px';glass.style.width=cw+'px';glass.style.height=ch+'px';
 const key=[ow,oh,rw,rh].join(':');
 if(key!==sizeKey){
  glass.width=ow;glass.height=oh;glass.style.left=-gutter+'px';glass.style.width=cw+'px';glass.style.height=ch+'px';
  output=[ow,oh];renderSize=[rw,rh];sizeKey=key;
  if(gl&&!shaderError){
   for(const [tex,fbo,w,h] of [[sceneTexture,sceneFbo,rw,rh],[resolveTexture,resolveFbo,ow,rh]]){
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Render target unavailable');
   }
  }
  allocations++;
 }
}
function labels(){
 const box=panel.getBoundingClientRect(),h=panelHeight;
 textureScale=Math.min(+quality.value*+samples.value*dpr,4096/Math.max(width+sourceGutter*2,h+sourceGutter*2));
 const gx=Math.ceil(sourceGutter*textureScale),bw=Math.max(1,Math.round(width*textureScale)),bh=Math.max(1,Math.round(h*textureScale));
 source.width=bw+gx*2;source.height=bh+gx*2;sourceSize=[source.width/textureScale,source.height/textureScale];sourceOffset=[gx/textureScale,gx/textureScale];
 const c=source.getContext('2d');c.setTransform(1,0,0,1,0,0);c.fillStyle='#e9e9e5';c.fillRect(0,0,source.width,source.height);c.setTransform(textureScale,0,0,textureScale,gx,gx);
 links.forEach((a,i)=>{
  const r=a.getBoundingClientRect(),s=getComputedStyle(a);c.font=`400 ${s.fontSize} ${s.fontFamily}`;
  const metric=c.measureText(a.textContent),asc=metric.fontBoundingBoxAscent||13,desc=metric.fontBoundingBoxDescent||3;
  c.fillStyle=i===hovered?'#292927':'#5b5c56';c.fillText(a.textContent,r.left-box.left+parseFloat(s.paddingLeft),r.top-box.top+parseFloat(s.paddingTop)+(parseFloat(s.lineHeight)-asc-desc)/2+asc);
 });
 base.width=bw;base.height=bh;base.style.width=width+'px';base.style.height=h+'px';
 base.getContext('2d').drawImage(source,gx,gx,bw,bh,0,0,bw,bh);
 if(gl&&!shaderError){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,bgTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
 labelsDirty=false;labelPaints++;
}
function ensurePaint(){if(!canDraw())return;try{if(geometryDirty)measure();if(storageDirty){storage();storageDirty=false;}if(labelsDirty)labels();}catch(error){fail(error);}}
function render(){
 if(!canDraw())return;ensurePaint();if(!canDraw()||!glassMode())return;
 const top=y-gutter,cw=width+gutter*2,ch=maxHeight+gutter*2,[rw,rh]=renderSize,[ow,oh]=output;
 glass.style.transform=`translateY(${top}px)`;
 gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFbo);gl.viewport(0,0,rw,rh);gl.useProgram(surface.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,bgTexture);
 const u=surface.u;gl.uniform1i(u('background'),0);gl.uniform2f(u('viewSize'),cw,ch);gl.uniform2f(u('panelSize'),width,panelHeight);gl.uniform2f(u('sourceSize'),...sourceSize);gl.uniform2f(u('sourceOffset'),...sourceOffset);
 gl.uniform1f(u('top'),top);gl.uniform1f(u('gutter'),gutter);gl.uniform1f(u('slabHeight'),height);gl.uniform1f(u('thickness'),+thickness.value);gl.uniform1f(u('indexOfRefraction'),mode.value==='ior1'?1:+ior.value);gl.uniform1f(u('lensScale'),+lens.value);gl.drawArrays(gl.TRIANGLES,0,6);
 for(const [pass,tex,fbo,w,h,dx,dy,radius] of [[horizontal,sceneTexture,resolveFbo,ow,rh,1/rw,0,rw/ow],[vertical,resolveTexture,null,ow,oh,0,1/rh,rh/oh]]){
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,w,h);gl.useProgram(pass.program);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(pass.u('image'),0);gl.uniform2f(pass.u('stepUV'),dx,dy);gl.uniform1f(pass.u('radius'),Math.max(1,radius));gl.drawArrays(gl.TRIANGLES,0,6);
 }
 frames++;if(firstInput){inputToDrawCallbackMs=performance.now()-firstInput;firstInput=0;}
}
function tick(time){
 frame=0;if(!canDraw()){last=0;velocity=0;return;}
 const dt=last?(time-last)/1000:1/60;if(last)activeRafIntervalsMs.push(time-last);last=time;
 if(reduced()){y=target;velocity=0;}else({y,velocity}=springStep(y,velocity,target,dt));
 render();if(Math.abs(y-target)>.015||Math.abs(velocity)>.1)frame=requestAnimationFrame(tick);else{y=target;velocity=0;last=0;render();summary();}
}
function request(){if(!canDraw())return;if(rasterMode()){ensurePaint();summary();return;}if(!frame){last=0;activeRafIntervalsMs=[];frame=requestAnimationFrame(tick);}}
function reading(){
 if(geometryDirty)measure();let next=0;
 anchors.forEach((at,i)=>{if(at<=scrollY+readingLine)next=i;});if(maxScroll>0&&scrollY>=maxScroll-2)next=links.length-1;
 if(next!==current){current=next;links.forEach((a,i)=>i===current?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current'));}
 progress=progressAt(stops,scrollY);target=progress.y;height=progress.height;
 if(reduced()){y=target;velocity=0;}
 request();
}
function summary(){
 if(enable.checked&&contrast.matches){message.textContent='Standard marker retained: forced colors';return;}
 if(enable.checked&&(paintFailure||mode.value==='glass'||mode.value==='ior1')&&shaderError){message.textContent='Standard marker retained: '+shaderError;return;}
 if(!enable.checked){message.textContent='Standard marker - experiment off';return;}
 if(mode.value==='native'){message.textContent='Native neutral labels - no raster or glass';return;}
 message.textContent=`${mode.value==='raster'?'Unwarped raster':mode.value==='ior1'?'Glass IOR 1 control':'Glass enabled'} - DPR ${dpr} - CSS ${(width+gutter*2).toFixed(1)}x${(maxHeight+gutter*2).toFixed(1)} - physical canvas ${output.join('x')} - scene ${renderSize.join('x')} - footprint Tent - MSAA/SMAA unsupported (off), temporal off${onscreen?'':' - offscreen paused'}${reduced()?' - motion reduced':''}`;
}
function refresh(){
 effective=enable.checked&&!contrast.matches&&!paintFailure&&(mode.value==='native'||mode.value==='raster'||(!!gl&&!shaderError));
 document.documentElement.classList.toggle('glass-on',effective&&mode.value!=='native');document.documentElement.classList.toggle('comparison-native',effective&&mode.value==='native');
 base.hidden=!(rasterMode()||glassMode());glass.hidden=!glassMode();stop();geometryDirty=true;
 reading();y=target;velocity=0;stop();ensurePaint();render();summary();
}
let scrollFrame=0;
window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;reading();});},{passive:true});
for(const [index,a] of links.entries()){
 a.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovered=index;labelsDirty=true;request();});
 a.addEventListener('pointerleave',()=>{if(hovered!==index)return;hovered=-1;labelsDirty=true;request();});
}
document.addEventListener('click',event=>{
 const a=event.target.closest('a');if(!a||event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||a.origin!==location.origin||a.pathname!==location.pathname||!a.hash)return;
 const t=document.getElementById(decodeURIComponent(a.hash.slice(1)));if(!t)return;
 event.preventDefault();history.replaceState(history.state,'',a.hash);t.tabIndex=-1;t.focus({preventScroll:true});t.scrollIntoView({behavior:'instant',block:'start'});reading();
});
for(const c of [thickness,ior,lens])c.addEventListener('input',()=>{document.querySelector('#'+c.id+'-value').value=c.value;firstInput=performance.now();request();});
for(const c of [quality,samples])c.addEventListener('input',()=>{document.querySelector('#'+c.id+'-value').value=c.value;sizeKey='';labelsDirty=true;refresh();});
const initial=new URL(location.href);enable.checked=initial.searchParams.get('glass')==='1';mode.value=['native','raster','ior1','glass'].includes(initial.searchParams.get('mode'))?initial.searchParams.get('mode'):'glass';
function urlState(){const u=new URL(location.href);u.searchParams.set('glass',enable.checked?'1':'0');u.searchParams.set('mode',mode.value);history.replaceState(history.state,'',u);}
enable.addEventListener('change',()=>{urlState();refresh();});mode.addEventListener('change',()=>{labelsDirty=true;urlState();refresh();});
document.querySelector('#reset').addEventListener('click',()=>{enable.checked=false;reduce.checked=false;mode.value='glass';for(const [c,value] of [[thickness,'9'],[ior,'1.48'],[lens,'1.06'],[quality,'3'],[samples,'2']]){c.value=value;document.querySelector('#'+c.id+'-value').value=value;}sizeKey='';urlState();refresh();});
function motionChanged(){if(reduced()){y=target;velocity=0;}request();summary();}
reduce.addEventListener('change',motionChanged);motion.addEventListener('change',motionChanged);contrast.addEventListener('change',refresh);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else refresh();});
if(typeof IntersectionObserver==='function')new IntersectionObserver(entries=>{const visible=entries.some(e=>e.isIntersecting);if(visible===onscreen)return;onscreen=visible;if(!visible)stop();else refresh();summary();}).observe(panel);else onscreen=true;
panel.closest('details')?.addEventListener('toggle',refresh);
document.querySelector('.lab details')?.addEventListener('toggle',refresh);
new ResizeObserver(()=>{geometryDirty=true;sizeKey='';refresh();}).observe(panel);
let dprQuery;
function watchDPR(){dprQuery?.removeEventListener('change',changedDPR);dprQuery=matchMedia(`(resolution: ${dpr}dppx)`);dprQuery.addEventListener('change',changedDPR);}
function changedDPR(){dpr=devicePixelRatio||1;sizeKey='';geometryDirty=labelsDirty=true;watchDPR();refresh();}
watchDPR();window.addEventListener('resize',()=>{if(dpr!==(devicePixelRatio||1))changedDPR();else refresh();});
window.visualViewport?.addEventListener('resize',()=>{if(dpr!==(devicePixelRatio||1))changedDPR();});
window.addEventListener('load',refresh);document.fonts.ready.then(refresh);refresh();
Object.defineProperty(window,'glassLabState',{get:()=>({revision:'r2',enabled:effective,mode:mode.value,onscreen,drawingAllowed:canDraw(),current:links[current].textContent,y,target,velocity,progress,reduced:reduced(),frames,labelPaints,allocations,inputToDrawCallbackMs,activeRafIntervalsMs:[...activeRafIntervalsMs],dpr,viewportScale:window.visualViewport?.scale||1,css:[width+gutter*2,maxHeight+gutter*2],output,render:renderSize,resolve:[output[0],renderSize[1]],footprint:[renderSize[0]/output[0],renderSize[1]/output[1]],source:sourceSize,sourceOffset,textureScale,gutter,sourceGutter,maxShift,shaderError,limits:'Height-field and explicit digital lens scale; not Apple optics or full-scene path tracing. rAF callbacks are not physical FPS. Full WebGL rendering and zoom quality need permitted rendered review.'})});
