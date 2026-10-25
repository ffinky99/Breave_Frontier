// TutorialScene1 / AutoMessage / CCParticleSystem, supplied APK 2.19.6.0.
// Addresses and untranslated strings: docs/sources/intro-native-proof.json.
export const INTRO_FLOW=['line0','line1','line2','name','line3','hero','line4','skip','exit','complete'];
export const INTRO_TEXT=[
 '\n<wait=20>\n나는 루시어스…<wait=20>\n이 게이트를 관장하는 신이다…',
 '\n<wait=20>\n나는 기다려 왔다…<wait=20>\n네가 이곳에<wait=20>\n도착할 날을…<wait=20>\n',
 '\n<wait=20>\n선택받은 자여…<wait=20>\n너의 이름은 무엇인가?<wait=20>\n',
 '\n{name}…<wait=20>\n이 문 너머에<wait=20>\n새로운 힘이<wait=20>\n너를 기다리고 있다…<wait=20>\n\n',
 '\n이제 나아가<wait=20>\n그 힘을 네 것으로 만들어라…<wait=20>\n그리고 그 힘으로 평화를<wait=20>\n이 세계에 가져오너라…\n',
];
export const HERO_DESCRIPTIONS=[
 ['가능성을 믿는 자,','열정으로 타오르는','불의 마음을 지닌 자'],
 ['진실을 찾는 자,','수정처럼 맑은','물의 마음을 지닌 자'],
 ['희망을 품은 자,','상처를 치유하는','숲의 마음을 지닌 자'],
 ['정의를 위해 싸우는 자,','곧고 정직한','번개의 마음을 지닌 자'],
];
export const cleanName=name=>Array.from(String(name).trim()).slice(0,8).join('');
export class IntroCarousel {
 constructor(page=0){this.position=page*320;this.target=this.position;this.velocity=0;this.moving=false;this.dragging=false;this.released=false;this.snapping=false;this.dragDelta=0;}
 get page(){return ((Math.round(this.position/320)%4)+4)%4;}
 offset(page){return ((page*320-this.position+640)%1280+1280)%1280-640;}
 arrow(direction){if(this.moving||this.dragging)return;this.velocity=Math.sign(direction)*40;this.released=true;this.snapping=false;this.moving=true;}
 startDrag(){this.dragging=true;this.released=false;this.snapping=false;this.velocity=0;this.dragDelta=0;this.moving=true;}
 drag(delta){if(!this.dragging)return;this.velocity=Math.max(-17,Math.min(17,this.dragDelta-delta))*1.2000000476837158;this.dragDelta=delta;}
 endDrag(){if(!this.dragging)return;this.dragging=false;this.released=true;this.moving=true;}
 update(){
  if(!this.moving)return;const previous=this.position;this.velocity*=.9200000166893005;if(Math.abs(this.velocity)<.05)this.velocity=0;this.position+=this.velocity;
  if(this.snapping&&((previous<=this.target&&this.position>=this.target)||(previous>=this.target&&this.position<=this.target))){this.position=this.target;this.velocity=0;this.moving=false;this.released=false;this.snapping=false;return;}
  // Native pageSnapThreshold40 is a velocity threshold, not a drag distance.
  if(this.released&&!this.snapping&&Math.abs(this.velocity)<40){
   if(this.position%320===0){this.velocity=0;this.moving=false;return;}
   this.target=Math.abs(this.velocity)>1?(this.velocity>0?Math.floor(this.position/320)+1:Math.ceil(this.position/320)-1)*320:Math.round(this.position/320)*320;
   this.velocity=Math.sign(this.target-this.position)*40;this.snapping=true;
  }
 }
}
export class IntroMessage {
 constructor(text){this.parts=text.split(/(<wait=\d+>)/).flatMap(t=>t.startsWith('<wait=')?[{wait:Number(t.slice(6,-1))}]:Array.from(t));this.text='';this.cursor=0;this.wait=0;this.counter=0;}
 get complete(){return this.cursor===this.parts.length&&!this.wait;}
 update(){
  if(this.wait&&--this.wait)return;
  while(this.cursor<this.parts.length){const p=this.parts[this.cursor];
   if(typeof p!=='string'){this.wait=p.wait;this.cursor++;return;}
   if(p==='\n'){this.text+='\n';this.cursor++;continue;}
   if(++this.counter<6)return;this.counter=0;this.text+=p;this.cursor++;return;
  }
 }
 reveal(){this.text=this.parts.filter(p=>typeof p==='string').join('');this.cursor=this.parts.length;this.wait=0;}
}
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
export class IntroParticles {
 constructor(parameters,random=Math.random){this.p=parameters;this.random=random;this.particles=[];}
 sample(value,variance=0){return value+variance*(2*this.random()-1);}
 color(prefix){return ['Red','Green','Blue','Alpha'].map(c=>clamp(this.sample(this.p[prefix+'Color'+c],this.p[prefix+'ColorVariance'+c])));}
 create(){const p=this.p;return {life:Math.max(0,this.sample(p.particleLifespan,p.particleLifespanVariance)),age:0,x:this.sample(0,p.sourcePositionVariancex),y:this.sample(0,p.sourcePositionVariancey),start:this.color('start'),finish:this.color('finish'),size:this.sample(p.startParticleSize,p.startParticleSizeVariance),endSize:this.sample(p.finishParticleSize,p.finishParticleSizeVariance),rotation:this.sample(p.rotationStart,p.rotationStartVariance),endRotation:this.sample(p.rotationEnd,p.rotationEndVariance)};}
 update(dt=1/60){
  if(dt<=0)return;
  // Native emissionRate = 40/0 = Infinity. Fill before ageing; deaths are
  // replaced on the next update, never recursively in the same update.
  while(this.particles.length<this.p.maxParticles)this.particles.push(this.create());
  for(const particle of this.particles)particle.age+=dt;
  this.particles=this.particles.filter(p=>p.age<p.life);
 }
 draw(ctx,texture,scale){
  ctx.save();ctx.translate(320,280);ctx.scale(scale*2,scale*2);ctx.globalCompositeOperation='lighter';
  this.tintCanvas??=document.createElement('canvas');this.tintCanvas.width=texture.width;this.tintCanvas.height=texture.height;const tint=this.tintCanvas.getContext('2d');
  for(const p of this.particles){const t=p.age/p.life,color=p.start.map((c,i)=>c+(p.finish[i]-c)*t),size=Math.max(0,p.size+(p.endSize-p.size)*t);
   tint.globalCompositeOperation='source-over';tint.clearRect(0,0,texture.width,texture.height);tint.drawImage(texture,0,0);tint.globalCompositeOperation='source-in';tint.fillStyle=`rgb(${color.slice(0,3).map(c=>Math.round(c*255)).join(',')})`;tint.fillRect(0,0,texture.width,texture.height);
   ctx.save();ctx.translate(p.x,-p.y);ctx.rotate(-(p.rotation+(p.endRotation-p.rotation)*t)*Math.PI/180);ctx.globalAlpha=color[3];ctx.drawImage(this.tintCanvas,-size/2,-size/2,size,size);ctx.restore();
  }ctx.restore();
 }
}
export class IntroSequence {
 constructor(parameters,{random=Math.random}={}){this.index=0;this.time=0;this.stageStarted=3000;this.name='소환사';this.hero=Math.floor(random()*4);this.carousel=new IntroCarousel(this.hero);this.skip=false;this.skipWarning=false;this.message=new IntroMessage(INTRO_TEXT[0]);this.particles=new IntroParticles(parameters,random);this.scaleAction={start:0,from:.1,to:.2,duration:1000};this.lastWall=null;this.accumulator=0;}
 get stage(){return INTRO_FLOW[this.index];}
 get age(){return Math.max(0,this.time-this.stageStarted);}
 get locked(){return this.time<3000||(this.stage==='hero'&&this.age<29/60*1000)||this.stage==='exit';}
 get scale(){const a=this.scaleAction;return a.from+(a.to-a.from)*clamp((this.time-a.start)/a.duration);}
 moveTo(index){const from=this.scale;this.index=index;this.stageStarted=this.time;const line=/^line(\d)$/.exec(this.stage);if(line)this.message=new IntroMessage(INTRO_TEXT[Number(line[1])].replace('{name}',this.name));const target={line3:.3,line4:.4,exit:1}[this.stage];if(target)this.scaleAction={start:this.time,from,to:target,duration:this.stage==='exit'?2000:3000};}
 tap(){if(this.locked||!this.stage.startsWith('line'))return false;if(!this.message.complete){this.message.reveal();return true;}this.moveTo(this.index+1);return true;}
 submitName(name){const valid=cleanName(name);if(this.stage!=='name'||!valid)return false;this.name=valid;this.moveTo(this.index+1);return true;}
 chooseHero(index){if(this.stage!=='hero'||this.locked||!Number.isInteger(index)||index<0||index>3)return false;this.hero=index;this.moveTo(this.index+1);return true;}
 chooseTutorial(skip){if(this.stage!=='skip')return false;this.skip=skip;this.moveTo(this.index+1);return true;}
 update(wall,{paused=false}={}){
  if(this.lastWall===null){this.lastWall=wall;return;}
  const delta=wall-this.lastWall;this.lastWall=wall;if(paused){this.accumulator=0;return;}
  this.accumulator+=Math.min(250,Math.max(0,delta));
  while(this.accumulator>=1000/60){this.accumulator-=1000/60;this.time+=1000/60;this.particles.update();if(this.stage==='hero')this.carousel.update();if(this.time>=3000&&this.stage.startsWith('line'))this.message.update();if(this.stage==='exit'&&this.age>=6000)this.moveTo(this.index+1);}
 }
 draw(ctx,texture){
  ctx.clearRect(0,0,640,960);this.particles.draw(ctx,texture,this.scale);
  if(this.time<3000){ctx.fillStyle=`rgba(0,0,0,${1-this.time/3000})`;ctx.fillRect(0,0,640,960);}
  if(this.stage==='exit'){const t=this.age,white=t<5000?255:Math.round(255*(1-clamp((t-5000)/1000)));ctx.fillStyle=`rgba(${white},${white},${white},${clamp(t/3000)})`;ctx.fillRect(0,0,640,960);}
 }
}
