import {progressStops,zeroVelocity,labelShape,interpolateShapes,advanceShape,settled,followScroll,anchorTopic,observeTopic} from './contents-glass-math.mjs';
import {emphasisWeights,blendEmphasis,emphasisStroke} from './contents-glass-emphasis.mjs';
import {revealStep,revealSettled,revealShape} from './contents-glass-entry.mjs';

// Decorative adapter for the existing native Contents tree. app.js remains the
// sole owner of reading state, URL/history, focus, Resume and page transport.
export function attachContentsGlass({entries}){
 if(typeof IntersectionObserver!=='function'||typeof ResizeObserver!=='function')return null;
 const panel=document.querySelector('.current-chapter > .chapter-sections');
 if(!panel||!entries.length)return null;
 const links=entries.map(entry=>entry.link),layer=document.createElement('li');
 layer.className='contents-glass-layer';layer.setAttribute('aria-hidden','true');layer.setAttribute('role','presentation');
 const glass=document.createElement('canvas'),source=document.createElement('canvas');
 glass.className='contents-glass-paint';glass.hidden=true;
 layer.append(glass);panel.prepend(layer);panel.classList.add('contents-glass-host');
 const parents=[];for(let p=panel.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')parents.push(p);
 const motion=matchMedia('(prefers-reduced-motion:reduce)'),contrast=matchMedia('(forced-colors:active)');
 const thickness={value:'9'},ior={value:'1.48',max:'1.65'},lens={value:'1.06',max:'1.15'},quality={value:'3'},samples={value:'2'},mode={value:'glass'};
 const maxShift=18;
 let gutter=16,sourceGutter=36;
 let shape={x:0,y:0,w:24,h:36},shapeVelocity=zeroVelocity(),aim={...shape},owner=followScroll(),paintLeft=-16,paintWidth=282;
 let current=0,hovered=-1,y=0,target=0,height=36,velocity=0,frame=0,last=0,frames=0,labelPaints=0,allocations=0;
 let effective=false,onscreen=false,geometryDirty=true,storageDirty=true,labelsDirty=true,paintFailure=false,shaderError='',textureScale=1;
 let width=250,panelHeight=252,maxHeight=36,anchors=[],rows=[],stops=[],maxScroll=0,readingLine=56,progress={fraction:0,left:0,right:0};
 let dpr=devicePixelRatio||1,output=[0,0],renderSize=[0,0],sourceSize=[0,0],sourceOffset=[0,0],sizeKey='';
 let firstInput=0,inputToDrawCallbackMs=0,activeRafIntervalsMs=[],gl,surface,horizontal,vertical,bgTexture,strongTexture,sceneTexture,resolveTexture,sceneFbo,resolveFbo;
 let reveal={value:0,velocity:0},surfaceShape=null;
 let emphasis=links.map(()=>0),emphasisGoal=[...emphasis],lastEmphasisTime=0;
 let observed={current:links[0],position:scrollY,readingLine:56,transportActive:false};
 const reduced=()=>motion.matches;
 const glassMode=()=>effective;
 const rasterMode=()=>false;
 const visible=()=>onscreen&&!document.hidden&&parents.every(parent=>parent.open)&&!contrast.matches&&!paintFailure&&!shaderError;
 const canDraw=()=>effective&&visible();
 function visibleInScrollports(){
  const r=panel.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right);
  for(let parent=panel.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent),box=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,box.top+parent.clientTop);bottom=Math.min(bottom,box.top+parent.clientTop+parent.clientHeight);}if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,box.left+parent.clientLeft);right=Math.min(right,box.left+parent.clientLeft+parent.clientWidth);}}
  return bottom>top&&right>left;
 }
 function localBox(){const box=panel.getBoundingClientRect();return {left:box.left+panel.clientLeft,top:box.top+panel.clientTop};}
 function backgroundColor(){for(let el=panel;el;el=el.parentElement){const color=getComputedStyle(el).backgroundColor;if(color!=='transparent'&&color!=='rgba(0, 0, 0, 0)')return color;}return '#e9e9e5';}
const vertex=`#version 300 es
layout(location=0) in vec2 position;out vec2 uv;
void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D background,strongBackground;
uniform vec3 emphasisRow0,emphasisRow1;
uniform vec2 viewSize,panelSize,sourceSize,sourceOffset,slabSize,slabCenter;
uniform float paintLeft,presence;
uniform float top,slabHeight,thickness,indexOfRefraction,lensScale,gutter;
float sdf(vec2 p){vec2 q=abs(p)-vec2(slabSize.x*.5-4.,slabHeight*.5)+7.;return length(max(q,0.))+min(max(q.x,q.y),0.)-7.;}
float surfaceHeight(vec2 p){
 float d=sdf(p),b=clamp(-d/6.5,0.,1.);
 float bevel=sqrt(max(0.,1.-(1.-b)*(1.-b)));
 float nx=p.x/max(1.,slabSize.x*.5-4.),ny=p.y/max(1.,slabHeight*.5);
 float crown=2.1*max(0.,1.-ny*ny)*max(0.,1.-nx*nx);
 return thickness*bevel+crown*smoothstep(0.,3.,-d);
}
void main(){
 vec2 local=vec2(uv.x*viewSize.x,(1.-uv.y)*viewSize.y);
 vec2 center=slabCenter;
 vec2 global=vec2(local.x+paintLeft,top+local.y),p=global-center;
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
 vec2 sourceUV=(sampleAt+sourceOffset)/sourceSize;
 float inkWeight=0.;
 if(sampleAt.y>=emphasisRow0.x&&sampleAt.y<=emphasisRow0.y)inkWeight=max(inkWeight,emphasisRow0.z);
 if(sampleAt.y>=emphasisRow1.x&&sampleAt.y<=emphasisRow1.y)inkWeight=max(inkWeight,emphasisRow1.z);
 vec3 transmitted=mix(texture(background,sourceUV).rgb,texture(strongBackground,sourceUV).rgb,inkWeight);
 float f0=pow((indexOfRefraction-1.)/(indexOfRefraction+1.),2.);
 float fresnel=f0+(1.-f0)*pow(1.-max(0.,dot(-incident,normal)),5.);
 vec3 light=normalize(vec3(-.35,-.65,1.)),halfway=normalize(light-incident);
 float spec=pow(max(0.,dot(normal,halfway)),70.),rim=exp(-abs(d+1.1)*1.7);
 vec3 reflected=mix(vec3(.32,.31,.29),vec3(.98,.98,.96),smoothstep(-.15,.9,normal.y));
 vec3 material=mix(transmitted,reflected,fresnel*.65);
 material=mix(material,vec3(.96,.96,.94),.025)+vec3(spec*.16+rim*.05);
 color=vec4(material*coverage,coverage+shadow*(1.-coverage))*presence;
}`;
const tent=`#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D image;uniform vec2 stepUV;uniform float radius;
float sinc(float x){if(abs(x)<.0001)return 1.;float a=3.141592653589793*x;return sin(a)/a;}
void main(){vec4 sum=vec4(0.);float weights=0.;for(int i=-12;i<=12;i++){
 float x=float(i)/max(1.,radius),w=abs(x)<2.?sinc(x)*sinc(x*.5):0.;
 sum+=texture(image,uv+stepUV*float(i))*w;weights+=w;
}color=clamp(sum/max(weights,.0001),0.,1.);}`;
function program(v,f){
 const shader=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,v),fs=shader(gl.FRAGMENT_SHADER,f);
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 const locations=new Map();return {program:p,u:name=>{if(!locations.has(name))locations.set(name,gl.getUniformLocation(p,name));return locations.get(name);}};
}
function texture(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function stop(){cancelAnimationFrame(frame);frame=0;last=0;velocity=0;shapeVelocity=zeroVelocity();}
function fail(error){paintFailure=true;shaderError=String(error.message||error);stop();refresh();}
function setupGL(){if(gl||shaderError)return;try{
 gl=glass.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,depth:false,stencil:false});
 if(!gl)throw Error('WebGL 2 unavailable');
 surface=program(vertex,fragment);horizontal=program(vertex,tent);vertical=program(vertex,tent);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 bgTexture=texture();strongTexture=texture();sceneTexture=texture();resolveTexture=texture();sceneFbo=gl.createFramebuffer();resolveFbo=gl.createFramebuffer();
}catch(error){shaderError=String(error.message||error);}}
glass.addEventListener('webglcontextlost',()=>{shaderError='WebGL context lost';stop();refresh();});
function lineRuns(a,box){
 const style=getComputedStyle(a),font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,lines=[];
 const walker=document.createTreeWalker(a,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(node.data)]:(()=>{let offset=0;return Array.from(node.data).map(segment=>{const entry={segment,index:offset};offset+=segment.length;return entry;});})();
  for(const {segment,index} of segments){
   const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+segment.length);
   const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;
   let line=lines.find(line=>Math.abs(line.top-(r.top-box.top))<parseFloat(style.lineHeight)*.4);
   if(!line){line={text:'',left:r.left-box.left,top:r.top-box.top,right:r.right-box.left,bottom:r.bottom-box.top,font};lines.push(line);}
   line.text+=segment;line.left=Math.min(line.left,r.left-box.left);line.right=Math.max(line.right,r.right-box.left);line.bottom=Math.max(line.bottom,r.bottom-box.top);
  }
 }
 const context=source.getContext('2d');let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const line of lines){
  context.font=font;const m=context.measureText(line.text),asc=m.fontBoundingBoxAscent||13,desc=m.fontBoundingBoxDescent||3;
  line.baseline=line.top+(line.bottom-line.top-asc-desc)/2+asc;
  left=Math.min(left,line.left-(m.actualBoundingBoxLeft||0));right=Math.max(right,line.left+(m.actualBoundingBoxRight||line.right-line.left));
  top=Math.min(top,line.baseline-(Number.isFinite(m.actualBoundingBoxAscent)?m.actualBoundingBoxAscent:asc));bottom=Math.max(bottom,line.baseline+(Number.isFinite(m.actualBoundingBoxDescent)?m.actualBoundingBoxDescent:desc));
 }
 if(!lines.length){const r=a.getBoundingClientRect();left=r.left-box.left;right=r.right-box.left;top=r.top-box.top;bottom=r.bottom-box.top;}
 return {lines,ink:{x:left,y:top,w:right-left,h:bottom-top},padding:{left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight),top:parseFloat(style.paddingTop),bottom:parseFloat(style.paddingBottom),minimumHeight:parseFloat(style.minHeight)||36}};
}
function opticalScale(maximum=false){const n=maximum?+ior.max:mode.value==='ior1'?1:+ior.value,k=maximum?+lens.max:+lens.value;return 1+(k-1)*Math.max(0,Math.min(1.4,(n-1)/.48));}
function measuredShapes(maximum=false){return rows.map(row=>labelShape(row.ink,row.padding,opticalScale(maximum)));}
function measure(){
 gutter=Math.ceil(Math.max(16,12+2/dpr));width=panel.clientWidth;const box=localBox();panelHeight=panel.clientHeight;
 rows=links.map(a=>{const r=a.getBoundingClientRect();return {top:r.top-box.top,height:r.height,...lineRuns(a,box)};});
 const maximum=measuredShapes(true),left=Math.min(0,...maximum.map(r=>r.x)),right=Math.max(width,...maximum.map(r=>r.x+r.w));
 const above=Math.min(0,...maximum.map(r=>r.y)),below=Math.max(panelHeight,...maximum.map(r=>r.y+r.h));
 paintLeft=Math.floor(left)-gutter;paintWidth=Math.ceil(right)-Math.floor(left)+gutter*2;maxHeight=Math.max(36,...maximum.map(r=>r.h));
 sourceGutter=Math.ceil(Math.max(gutter,-paintLeft,paintLeft+paintWidth-width,gutter-above,below-panelHeight+gutter)+maxShift+2/dpr);
 anchors=entries.map(entry=>entry.target.getBoundingClientRect().top+scrollY);
 maxScroll=Math.max(0,document.documentElement.scrollHeight-innerHeight);readingLine=observed.readingLine;
 stops=progressStops(anchors,rows,readingLine,maxScroll);geometryDirty=false;storageDirty=labelsDirty=true;
}
function storage(){
 const limit=gl?Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),8192):8192;
 const cw=paintWidth,ch=maxHeight+gutter*2;
 const physical=Math.min(dpr,limit/Math.max(cw,ch));
 const ow=Math.max(1,Math.round(cw*physical)),oh=Math.max(1,Math.round(ch*physical));
 const factor=Math.min(+quality.value*+samples.value,limit/ow,limit/oh);
 const rw=Math.max(ow,Math.round(ow*factor)),rh=Math.max(oh,Math.round(oh*factor));
 glass.style.left=paintLeft+'px';glass.style.width=cw+'px';glass.style.height=ch+'px';
 const key=[ow,oh,rw,rh].join(':');
 if(key!==sizeKey){
  glass.width=ow;glass.height=oh;glass.style.left=paintLeft+'px';glass.style.width=cw+'px';glass.style.height=ch+'px';
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
 const box=localBox(),h=panelHeight;
 textureScale=Math.min(+quality.value*+samples.value*dpr,4096/Math.max(width+sourceGutter*2,h+sourceGutter*2));
 const gx=Math.ceil(sourceGutter*textureScale),bw=Math.max(1,Math.round(width*textureScale)),bh=Math.max(1,Math.round(h*textureScale));
 source.width=bw+gx*2;source.height=bh+gx*2;sourceSize=[source.width/textureScale,source.height/textureScale];sourceOffset=[gx/textureScale,gx/textureScale];
 const c=source.getContext('2d');c.setTransform(1,0,0,1,0,0);c.fillStyle=backgroundColor();c.fillRect(0,0,source.width,source.height);c.setTransform(textureScale,0,0,textureScale,gx,gx);
 // Outside the pane, the browser paints the native labels. The optical
 // source uses those same computed colors/weights, never duplicate DOM ink.
 rows.forEach((row,i)=>{c.fillStyle=getComputedStyle(links[i]).color;for(const run of row.lines){c.font=run.font;c.fillText(run.text,run.left,run.baseline);}});
 const upload=(texture,unit)=>{gl.activeTexture(unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);};
 if(gl&&!shaderError){
  upload(bgTexture,gl.TEXTURE0);
  // One stable emphasized source shares the native label's exact line breaks.
  // Blend cached sources on the GPU; no full text texture upload per frame.
  c.lineWidth=emphasisStroke;c.lineJoin='round';
  rows.forEach((row,i)=>{c.strokeStyle=getComputedStyle(links[i]).color;for(const run of row.lines){c.font=run.font;c.strokeText(run.text,run.left,run.baseline);}});
  upload(strongTexture,gl.TEXTURE1);gl.activeTexture(gl.TEXTURE0);
 }
 labelsDirty=false;labelPaints++;
}
function ensurePaint(){if(!canDraw())return;try{if(geometryDirty)measure();if(storageDirty){storage();storageDirty=false;}if(labelsDirty)labels();}catch(error){fail(error);}}
function render(){
 if(!canDraw())return;ensurePaint();if(!canDraw()||!glassMode())return;
 surfaceShape=revealShape(shape,reveal.value);
 emphasisGoal=emphasisWeights(shape,measuredShapes(),owner.kind==='topic'?owner.index:null).map(weight=>weight*surfaceShape.opacity);
 const now=performance.now();emphasis=blendEmphasis(emphasis,emphasisGoal,(now-lastEmphasisTime)/1000,reduced()||!lastEmphasisTime);lastEmphasisTime=now;
 links.forEach((link,index)=>{const value=emphasis[index].toFixed(4);if(link.style.getPropertyValue('--contents-emphasis')!==value)link.style.setProperty('--contents-emphasis',value);});
 const [rw,rh]=renderSize,[ow,oh]=output,cw=ow/dpr,ch=oh/dpr,box=localBox();
 // Snap only the bitmap viewport to device pixels. The optical surface and
 // sample coordinates keep their continuous native position inside it.
 const left=Math.round((box.left+paintLeft)*dpr)/dpr-box.left;
 const top=Math.round((box.top+shape.y-gutter)*dpr)/dpr-box.top;
 glass.style.left=left+'px';glass.style.width=cw+'px';glass.style.height=ch+'px';
 glass.style.transform=`translateY(${top}px)`;
 gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFbo);gl.viewport(0,0,rw,rh);gl.useProgram(surface.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,bgTexture);
 const u=surface.u;gl.uniform1i(u('background'),0);gl.uniform1i(u('strongBackground'),1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,strongTexture);gl.activeTexture(gl.TEXTURE0);
 const emphasized=emphasis.map((weight,index)=>({weight,index})).filter(row=>row.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,2);
 for(let i=0;i<2;i++){const entry=emphasized[i],row=entry&&rows[entry.index];gl.uniform3f(u(`emphasisRow${i}`),row?row.top-1:0,row?row.top+row.height+1:-1,entry?.weight||0);}
 gl.uniform2f(u('viewSize'),cw,ch);gl.uniform2f(u('panelSize'),width,panelHeight);gl.uniform2f(u('sourceSize'),...sourceSize);gl.uniform2f(u('sourceOffset'),...sourceOffset);
 gl.uniform1f(u('top'),top);gl.uniform1f(u('gutter'),gutter);gl.uniform1f(u('presence'),surfaceShape.opacity);gl.uniform1f(u('slabHeight'),surfaceShape.h);gl.uniform2f(u('slabSize'),surfaceShape.w,surfaceShape.h);gl.uniform2f(u('slabCenter'),shape.x+shape.w/2,shape.y+shape.h/2);gl.uniform1f(u('paintLeft'),left);gl.uniform1f(u('thickness'),+thickness.value);gl.uniform1f(u('indexOfRefraction'),mode.value==='ior1'?1:+ior.value);gl.uniform1f(u('lensScale'),+lens.value);gl.drawArrays(gl.TRIANGLES,0,6);
 for(const [pass,tex,fbo,w,h,dx,dy,radius] of [[horizontal,sceneTexture,resolveFbo,ow,rh,1/rw,0,rw/ow],[vertical,resolveTexture,null,ow,oh,0,1/rh,rh/oh]]){
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,w,h);gl.useProgram(pass.program);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(pass.u('image'),0);gl.uniform2f(pass.u('stepUV'),dx,dy);gl.uniform1f(pass.u('radius'),Math.max(1,radius));gl.drawArrays(gl.TRIANGLES,0,6);
 }
 frames++;if(firstInput){inputToDrawCallbackMs=performance.now()-firstInput;firstInput=0;}
}

 function synchronize(){y=shape.y;target=aim.y;height=shape.h;velocity=shapeVelocity.y;}
 function settleShape(){shape={...aim};shapeVelocity=zeroVelocity();synchronize();}
 function targetShape(){
  if(geometryDirty)measure();
  readingLine=observed.readingLine;stops=progressStops(anchors,rows,readingLine,maxScroll);
  const shapes=measuredShapes();progress=interpolateShapes(stops,shapes,observed.position);
  aim=owner.kind==='topic'&&shapes[owner.index]?{...shapes[owner.index]}:{...progress.shape};
  current=Math.max(0,links.indexOf(observed.current));target=aim.y;
  if(reduced())settleShape();
 }
 function tick(time){
  frame=0;if(!canDraw()){last=0;shapeVelocity=zeroVelocity();return;}
  const dt=last?(time-last)/1000:1/60;last=time;
  reveal=revealStep(reveal,1,dt,reduced());
  ({shape,velocity:shapeVelocity}=advanceShape(shape,shapeVelocity,aim,dt,reduced()));synchronize();render();
  if(!revealSettled(reveal)||!settled(shape,shapeVelocity,aim)||emphasis.some((value,index)=>Math.abs(value-emphasisGoal[index])>.001))frame=requestAnimationFrame(tick);else{reveal={value:1,velocity:0};settleShape();emphasis=[...emphasisGoal];last=0;render();}
 }
 function request(){if(canDraw()&&!frame){last=0;lastEmphasisTime=performance.now();frame=requestAnimationFrame(tick);}}
 function summary(){}
 function refresh(opening=false){
  stop();effective=false;
  // IntersectionObserver can arrive one painted frame after a disclosure
  // starts entering. Prepare its new paint synchronously before that frame.
  if(opening&&parents.every(parent=>parent.open))onscreen=visibleInScrollports();
  // Preserve the last painted material through the native disclosure's exit.
  // It draws no new frames while hidden, closed or outside the scrollport.
  if(!visible()){if(contrast.matches||paintFailure||shaderError){panel.classList.remove('contents-glass-ready');glass.hidden=true;}return;}
  setupGL();if(!gl||shaderError){panel.classList.remove('contents-glass-ready');glass.hidden=true;return;}
  effective=true;panel.classList.add('contents-glass-ready');glass.hidden=false;
  try{targetShape();settleShape();ensurePaint();if(reduced())reveal={value:1,velocity:0};lastEmphasisTime=0;render();request();}catch(error){fail(error);}
 }
 function invalidate(){geometryDirty=storageDirty=labelsDirty=true;sizeKey='';refresh();}
 function read(next){
  observed=next;
  owner=observeTopic(owner,next.position,next.transportActive);
  if(canDraw()){targetShape();request();}
 }
 function select(link,transportActive){
  const index=links.indexOf(link);
  if(index<0){follow();return;}
  const target=entries[index].target,margin=parseFloat(getComputedStyle(target).scrollMarginTop)||0;
  const destination=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,scrollY+target.getBoundingClientRect().top-margin));
  owner=anchorTopic(index,scrollY,destination,transportActive);
  observed={...observed,position:scrollY};firstInput=performance.now();
  if(canDraw()){targetShape();request();}
 }
 function follow(){owner=followScroll();observed={...observed,position:scrollY};if(canDraw()){targetShape();request();}}
 for(const [index,link] of links.entries()){
  link.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovered=index;labelsDirty=true;request();});
  link.addEventListener('pointerleave',()=>{if(hovered!==index)return;hovered=-1;labelsDirty=true;request();});
 }
 // Reset only after a disclosure has actually finished hiding. A reversal
 // during visible exit retains present expansion/velocity and matched ink.
 function resetHiddenReveal(){
  if(parents.some(parent=>!parent.open&&(getComputedStyle(parent,'::details-content').contentVisibility==='hidden'||Number(getComputedStyle(parent,'::details-content').opacity)===0)))reveal={value:0,velocity:0};
 }
 for(const parent of parents){
  parent.addEventListener('transitionend',resetHiddenReveal);
  const summary=parent.querySelector(':scope>summary');
  for(const type of ['pointerdown','keydown'])summary?.addEventListener(type,resetHiddenReveal,{capture:true});
 }
 new IntersectionObserver(records=>{const next=records.some(record=>record.isIntersecting);if(next===onscreen)return;onscreen=next;geometryDirty=storageDirty=labelsDirty=true;refresh();}).observe(panel);
 new MutationObserver(()=>{geometryDirty=storageDirty=labelsDirty=true;refresh(true);}).observe(panel.closest('.contents-menu'),{attributes:true,attributeFilter:['open'],subtree:true});
 const resize=new ResizeObserver(invalidate);resize.observe(panel);const article=document.querySelector('.reader');if(article)resize.observe(article);
 document.addEventListener('visibilitychange',refresh);window.addEventListener('pagehide',()=>{stop();effective=false;});
 window.addEventListener('pageshow',()=>{owner=followScroll();invalidate();});
 window.addEventListener('resize',()=>{dpr=devicePixelRatio||1;invalidate();});
 document.fonts?.ready.then(invalidate);window.addEventListener('load',invalidate);
 motion.addEventListener('change',()=>{if(reduced()){reveal={value:1,velocity:0};settleShape();}request();});contrast.addEventListener('change',refresh);
 let dprQuery;function watchDpr(){dprQuery?.removeEventListener('change',changedDpr);dprQuery=matchMedia(`(resolution:${dpr}dppx)`);dprQuery.addEventListener('change',changedDpr);}
 function changedDpr(){dpr=devicePixelRatio||1;watchDpr();invalidate();}watchDpr();
 window.visualViewport?.addEventListener('resize',()=>{if(dpr!==(devicePixelRatio||1))changedDpr();});
 Object.defineProperty(window,'notesContentsGlass',{configurable:true,get:()=>({revision:'local-r4-boxless-bubble',reveal:{...reveal},surface:surfaceShape&&{...surfaceShape},labelRenderer:'native-outside-refracted-inside',filter:'lanczos2',pixelAligned:true,enabled:effective,onscreen,drawingAllowed:canDraw(),owner:{...owner},current:observed.current?.hash,shape:{...shape},aim:{...aim},shapeVelocity:{...shapeVelocity},progress,frames,labelPaints,allocations,dpr,output:[...output],source:[...sourceSize],shaderError,reduced:reduced(),geometryDirty})});
 return {read,select,follow};
}
