// SuperAnim frame interpolation, adapted from Raymond Lu's MIT SDK.
// Original license and source URL: docs/SuperAnim-LICENSE.txt.
export function samTransform(object,image,size){
 const [a,b,c,d,x,y]=object,[e,f,g,h,u,v]=image,[w,ht]=size;
 // Native O × I uses upward-y off-diagonals and centered texture vertices.
 const A=a*e+c*f,B=-a*g-c*h,C=-b*e-d*f,D=b*g+d*h,tx=x+a*u-c*v,ty=y-b*u+d*v;
 return [A,-C,-B,D,tx+B*ht,ty+C*w];
}
export class SamPlayer {
 constructor(data){this.data=data;this.images=new Map();this.tintCache=new Map();this.labelCache=new Map();}
 async load(){await Promise.all([...new Set(Object.values(this.data).flatMap(d=>d.images.map(i=>i.file)))].map(file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{this.images.set(file,img);resolve();};img.onerror=()=>reject(Error('연출 이미지를 불러오지 못했습니다.'));img.src='assets/'+file;})));}
 frameAt(name,time=0,label='loop',loop=true){
  const d=this.data[name],section=d.labels.find(s=>s.name===label)||{start:0,end:d.frames.length-1},length=section.end-section.start+1;
  const offset=Math.max(0,time)/1000*d.fps,index=section.start+(loop?offset%length:Math.min(length-1,offset));
  const base=Math.floor(index),fraction=index-base,current=d.frames[base],next=d.frames[Math.min(base+1,section.end)];
  return current.map(([id,res,matrix,color])=>{const following=next.find(v=>v[0]===id&&v[1]===res);return {id,res,matrix:matrix.map((v,i)=>v+(following?following[2][i]-v:0)*fraction),color:color.map((v,i)=>Math.trunc(v+(following?following[3][i]-v:0)*fraction))};});
 }
 duration(name,label='start'){const d=this.data[name],s=d.labels.find(s=>s.name===label);return (s?s.end-s.start+1:d.frames.length)/d.fps*1000;}
 tint(file,color){
  const image=this.images.get(file);if(color.slice(0,3).every(c=>c===255))return image;
  const key=file+color.slice(0,3).join(',');if(this.tintCache.has(key))return this.tintCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgb(${color.slice(0,3).join(',')})`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0);
  if(this.tintCache.size>=160)this.tintCache.delete(this.tintCache.keys().next().value);this.tintCache.set(key,canvas);return canvas;
 }
 koreanLabel(resource){
  if(this.labelCache.has(resource.file))return this.labelCache.get(resource.file);
  const canvas=document.createElement('canvas');canvas.width=resource.size[0];canvas.height=resource.size[1];const ctx=canvas.getContext('2d'),burst=resource.file.includes('219x124');
  const text=burst?'필살기':'방어';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`italic 900 ${burst?58:55}px system-ui,sans-serif`;ctx.lineJoin='round';ctx.lineWidth=10;ctx.strokeStyle='#fff';ctx.strokeText(text,canvas.width/2,canvas.height/2);ctx.lineWidth=6;ctx.strokeStyle='#111';ctx.strokeText(text,canvas.width/2,canvas.height/2);
  const gradient=ctx.createLinearGradient(0,canvas.height*.25,0,canvas.height*.8);gradient.addColorStop(0,burst?'#fff29b':'#fff');gradient.addColorStop(.5,burst?'#ffc420':'#c1cbd8');gradient.addColorStop(1,burst?'#d23908':'#687589');ctx.fillStyle=gradient;ctx.fillText(text,canvas.width/2,canvas.height/2);
  this.labelCache.set(resource.file,canvas);return canvas;
 }
 draw(ctx,name,{time=0,label='loop',loop=true,x=0,y=0,width=640,height=640,additive=false,exclude=[],koreanCommands=false}={}){
  const d=this.data[name];if(!d)return;ctx.save();ctx.translate(x,y);ctx.scale(width/d.bounds[2],height/d.bounds[3]);if(additive)ctx.globalCompositeOperation='lighter';
  for(const object of this.frameAt(name,time,label,loop)){const resource=d.images[object.res];if(!object.color[3]||exclude.some(part=>resource.file.includes(part)))continue;const image=this.images.get(resource.file);if(!image)continue;ctx.save();ctx.globalAlpha*=object.color[3]/255;ctx.transform(...samTransform(object.matrix,resource.matrix,resource.size));ctx.drawImage(koreanCommands&&/183x86|219x124/.test(resource.file)?this.koreanLabel(resource):this.tint(resource.file,object.color),0,0);ctx.restore();}
  ctx.restore();
 }
}
