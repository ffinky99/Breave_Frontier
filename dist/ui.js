// Original atlas regions and TexturePacker rotation, rendered without changing the source files.
export class NativeUI {
  constructor(data){this.data=data;this.images=new Map();}
  async load(){await Promise.all([...new Set(Object.values(this.data).map(v=>v.image))].map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{this.images.set(name,image);resolve();};image.onerror=()=>reject(Error('화면 이미지를 불러오지 못했어요.'));image.src='assets/'+name;})));}
  paint(){for(const canvas of document.querySelectorAll('canvas[data-ui]:not([data-painted])')){
    const frame=this.data[canvas.dataset.ui];if(!frame)continue;const source=this.images.get(frame.image);if(!source)continue;
    const [x,y,w,h]=frame.rect,[ox,oy]=frame.sourceRect;canvas.width=frame.size[0];canvas.height=frame.size[1];
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(ox,oy);
    if(frame.rotated){ctx.translate(0,h);ctx.rotate(-Math.PI/2);ctx.drawImage(source,x,y,h,w,0,0,h,w);}
    else ctx.drawImage(source,x,y,w,h,0,0,w,h);
    ctx.restore();canvas.dataset.painted='true';
  }}
}
