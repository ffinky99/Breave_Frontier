import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {attackFrames,makeCatalog,newSave,createBattle,queueAction,advanceCombat} from '../dist/engine.js';
import {SamPlayer,samTransform} from '../dist/sam.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const units=read('../dist/units.json'),raw=read('../docs/units-source-kr.json'),catalog=makeCatalog(units);
const sam=read('../dist/sam.json'),inventory=read('../docs/sam-inventory.json');

test('24종 모두 원문 타격 프레임·분배를 유지하고 실제 타격 수만큼 해결한다',()=>{
 for(const u of units.units){
  const source=raw.find(d=>String(d.id)===u.id)['damage frames'];
  assert.deepEqual(attackFrames(u),{frames:source['frame times'],weights:source['hit dmg% distribution']},u.id);
  const s=newSave('10011',catalog);s.units[u.id]={id:u.id,level:1,xp:0};s.party=[u.id];
  const b=createBattle(s,'grass-1',catalog,40);b.enemies[0].hp=50000;
  queueAction(b,0,'attack',0,catalog);const events=advanceCombat(b,Infinity).filter(e=>e.type==='impact');
  assert.equal(events.length,source.hits,u.id);assert.deepEqual(events.map(e=>e.frame),source['frame times'].map(f=>f+10));
 }
});
test('SAM의 11개 연출은 원본 24fps·구간·모든 이미지와 연결된다',()=>{
 assert.equal(Object.keys(sam).length,11);
 for(const [name,data] of Object.entries(sam)){
  assert.equal(data.fps,24,name);assert.equal(data.frames.length,inventory[name].frames);assert.deepEqual(data.labels,inventory[name].labels);
  for(const image of data.images)assert.ok(existsSync(new URL('../dist/assets/'+image.file,import.meta.url)),image.file);
  for(const frame of data.frames)for(const [,res,m,c] of frame){assert.ok(data.images[res]);assert.ok(m.every(Number.isFinite));assert.ok(c.every(n=>n>=0&&n<=255));}
 }
 const player=new SamPlayer(sam);assert.equal(player.duration('GachaGateClose3','start'),20/24*1000);assert.equal(player.duration('GachaGateOpen3','start'),60/24*1000);
 assert.deepEqual(player.frameAt('Touch',1e8,'start',false),player.frameAt('Touch',0,'start',false));
});
test('SAM은 같은 객체의 행렬·색상만 다음 프레임으로 보간한다',()=>{
 const data={test:{fps:24,labels:[{name:'loop',start:0,end:1}],frames:[[[1,0,[1,0,0,1,10,20],[255,255,255,255]]],[[1,0,[1,0,0,1,30,40],[255,255,255,0]]]]}};
 const frame=new SamPlayer(data).frameAt('test',1000/48)[0];assert.deepEqual(frame.matrix,[1,0,0,1,20,30]);assert.equal(frame.color[3],127);
 assert.deepEqual(samTransform([1,0,0,1,320,320],[1,0,0,1,-32,-43],[64,86]),[1,0,0,1,288,277]);
});
