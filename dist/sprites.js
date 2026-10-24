// CGG: anchor,count,(x,y,flip,blend,opacity,rotation,sourceX,sourceY,w,h,page)*count
// CGS: groupIndex,xOffset,yOffset,frameDuration (60 frames/second).
// Format verified against supplied CSVs and BluuArc/BFFrameAnimator-js.
export class SpritePlayer {
  constructor(data){this.data=data;this.images=new Map();this.frameCache=new Map();this.errors=[];}
  async load(ids){
    await Promise.all(ids.map(id=>{
      if(this.images.has(id))return;
      return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{this.images.set(id,image);resolve();};image.onerror=()=>{this.errors.push(id);reject(Error('캐릭터 이미지를 불러오지 못했습니다.'));};image.src=`assets/unit_anime_${id}.png`;});
    }));
  }
  duration(id,action='atk'){return this.data[id].actions[action].reduce((sum,f)=>sum+Math.max(1,f[3]),0)/60*1000;}
  getFrame(id,action,time,loop=true){
    const rows=this.data[id].actions[action]||this.data[id].actions.idle;
    const total=rows.reduce((sum,f)=>sum+Math.max(1,f[3]),0);
    let frame=Math.max(0,time)/1000*60;
    frame=loop?frame%total:Math.min(total-.01,frame);
    let selected=rows[0];for(const row of rows){selected=row;frame-=Math.max(1,row[3]);if(frame<0)break;}
    return selected;
  }
  compose(id,index){
    const key=`${id}-${index}`;if(this.frameCache.has(key))return this.frameCache.get(key);
    const image=this.images.get(id);if(!image)return null;
    const raw=this.data[id].frames[index],parts=[];
    let minX=0,maxX=0,minY=0,maxY=0;
    for(let i=0;i<raw[1];i++){
      const p=raw.slice(2+i*11,13+i*11);parts.push(p);
      minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]+p[8]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]+p[9]);
    }
    const pad=4,canvas=document.createElement('canvas');canvas.width=maxX-minX+pad*2;canvas.height=maxY-minY+pad*2;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    for(let i=parts.length-1;i>=0;i--){
      const [x,y,flip,blend,opacity,rotate,sx,sy,w,h]=parts[i];
      ctx.save();ctx.translate(x-minX+pad+w/2,y-minY+pad+h/2);ctx.rotate(-rotate*Math.PI/180);ctx.scale(flip&1?-1:1,flip&2?-1:1);
      ctx.globalAlpha=opacity/100;ctx.globalCompositeOperation=blend===1?'lighter':'source-over';
      ctx.drawImage(image,sx,sy,w,h,-w/2,-h/2,w,h);ctx.restore();
    }
    const frame={canvas,x:minX-pad,y:minY-pad};this.frameCache.set(key,frame);return frame;
  }
  draw(ctx,id,{x,y,scale=2,action='idle',time=0,flip=false,alpha=1,loop=true}={}){
    if(!this.data[id]||!this.images.has(id))return;
    const row=this.getFrame(id,action,time,loop),frame=this.compose(id,row[0]);if(!frame)return;
    ctx.save();ctx.translate(x,y);ctx.scale(flip?-scale:scale,scale);ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(frame.canvas,frame.x+row[1],frame.y+row[2]);ctx.restore();
  }
}
