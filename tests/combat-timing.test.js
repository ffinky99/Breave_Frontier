import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCatalog,newSave,setParty,createBattle,queueAction,queueEnemyTurn,advanceCombat,attackFrames} from '../dist/engine.js';
const catalog=makeCatalog(JSON.parse(readFileSync(new URL('../dist/units.json',import.meta.url))));
function fresh(){const s=newSave('40011',catalog);setParty(s,['40011','10030']);const b=createBattle(s,'grass-1',catalog,198);b.enemies.forEach(e=>e.hp=e.maxHp=50000);return b;}

test('공격 입력 직후 HP는 유지되고 원본 프레임마다 피해 비율이 적용된다',()=>{
 const s=newSave('10011',catalog),b=createBattle(s,'grass-1',catalog,2026),before=b.enemies[0].hp;
 assert.deepEqual(attackFrames(catalog['10011']),{frames:[26,44,62],weights:[50,30,20]});
 queueAction(b,0,'attack',0,catalog,{at:0});assert.equal(b.enemies[0].hp,before);
 assert.equal(advanceCombat(b,599).length,0);const first=advanceCombat(b,600).filter(e=>e.type==='impact');
 assert.equal(first.length,1);assert.equal(first[0].hit,0);assert.equal(b.enemies[0].hp,before-first[0].actual);
 const rest=advanceCombat(b,Infinity).filter(e=>e.type==='impact');assert.deepEqual(rest.map(e=>e.hit),[1,2]);
 assert.ok(Math.abs(first[0].value/rest[0].value-5/3)<.05);
});
test('같은 타깃의 같은 프레임만 양쪽에 스파크를 적용한다',()=>{
 const same=fresh(),differentTarget=fresh(),differentFrame=fresh();
 for(const b of [same,differentTarget,differentFrame])queueAction(b,0,'attack',0,catalog,{at:0});
 queueAction(same,1,'attack',0,catalog,{at:0});
 queueAction(differentTarget,1,'attack',1,catalog,{at:0});
 queueAction(differentFrame,1,'attack',0,catalog,{at:1});
 const a=advanceCombat(same,Infinity).filter(e=>e.type==='impact');
 const c=advanceCombat(differentFrame,Infinity).filter(e=>e.type==='impact');
 assert.equal(a.length,2);assert.ok(a.every(e=>e.spark));assert.ok(c.every(e=>!e.spark));
 assert.ok(advanceCombat(differentTarget,Infinity).filter(e=>e.type==='impact').every(e=>!e.spark));
 assert.deepEqual(a.map(e=>e.value),c.map(e=>Math.max(1,Math.floor(e.value*1.5))));
});
test('예약된 추가 타격은 적 사망 뒤에도 끝나며 차례와 보상이 앞서 넘어가지 않는다',()=>{
 const b=fresh();b.enemies[0].hp=1;b.enemies[1].hp=0;
 queueAction(b,0,'attack',0,catalog,{at:0,duration:2000});queueAction(b,1,'attack',0,catalog,{at:0,duration:2000});
 const impacts=advanceCombat(b,700).filter(e=>e.type==='impact');
 assert.deepEqual(impacts.map(e=>e.overkill),[false,true]);assert.equal(b.damage,1);assert.equal(b.enemies[0].hp,0);assert.equal(b.phase,'player');
 advanceCombat(b,2000);assert.equal(b.phase,'waveclear');assert.equal(advanceCombat(b,3000).length,0);
});
test('필살기는 입력 때 게이지를 소모하고 방어 자체는 게이지를 채우지 않는다',()=>{
 const b=fresh();b.party[0].bb=b.party[0].bbCost;
 queueAction(b,0,'burst',0,catalog,{at:0});assert.equal(b.party[0].bb,0);
 const before=b.party[1].bb;queueAction(b,1,'guard',0,catalog);assert.equal(b.party[1].bb,before);assert.equal(b.party[1].guard,true);
 advanceCombat(b,Infinity);assert.ok(b.party.every(p=>p.bb>=0&&p.bb<=p.bbCost));
});
test('적의 타격도 해당 프레임까지 체력을 유지하며 가드가 차례 끝까지 유지된다',()=>{
 const b=fresh();b.party.forEach(p=>{p.guard=true;p.acted=true;});b.phase='enemyPending';
 const before=b.party.map(p=>p.hp);queueEnemyTurn(b,catalog,{at:1000});assert.equal(b.phase,'enemyAnimating');assert.deepEqual(b.party.map(p=>p.hp),before);
 advanceCombat(b,1001);assert.deepEqual(b.party.map(p=>p.hp),before);
 const events=advanceCombat(b,Infinity);assert.ok(events.some(e=>e.type==='enemy-impact'&&e.guarded));assert.ok(b.party.some((p,i)=>p.hp<before[i]));
 assert.equal(b.phase,'player');assert.equal(b.turn,2);assert.ok(b.party.every(p=>!p.guard&&!p.acted));
});
test('무작위 결정은 보유 게이지·체력을 넘지 않고 하트는 부상자를 우선한다',()=>{
 const b=fresh();b.party[1].hp=1;
 for(let n=0;n<80;n++){
  b.party.forEach(p=>p.acted=false);b.phase='player';b.enemies[0].hp=50000;
  queueAction(b,0,'attack',0,catalog);const events=advanceCombat(b,Infinity);
  assert.ok(b.party.every(p=>p.bb>=0&&p.bb<=p.bbCost&&p.hp<=p.maxHp));
  for(const e of events.filter(e=>e.type==='crystal'&&e.kind==='heart'&&e.value>0))assert.equal(e.actor,1);
 }
 assert.ok(b.party[1].hp>1);assert.ok(b.party.some(p=>p.bb>0));
});


test('같은 유닛의 동시 타격도 원본의 타깃·대기 프레임 비교 조건을 따른다',()=>{
 const b=fresh();queueAction(b,0,'attack',0,catalog,{at:0});
 b.pendingHits.push({...b.pendingHits[0],hit:1});
 assert.ok(advanceCombat(b,Infinity).filter(e=>e.type==='impact').every(e=>e.spark));
});
test('결정은 날아가는 동안 수치를 바꾸지 않고 도착할 때 한 번만 반영된다',()=>{
 let found=false;
 for(let seed=1;seed<=80&&!found;seed++){
  const b=fresh();b.seed=seed;
  queueAction(b,0,'attack',0,catalog,{at:0});const hitAt=b.pendingHits[0].at;
  const events=advanceCombat(b,hitAt),crystal=events.find(e=>e.type==='crystal'&&e.kind==='battle');if(!crystal)continue;
  found=true;const p=b.party[crystal.actor],before=p.bb;
  advanceCombat(b,crystal.at-1);assert.equal(p.bb,before);
  const collected=advanceCombat(b,crystal.at).filter(e=>e.type==='crystal-collect');
  assert.ok(collected.length);const gained=collected.filter(e=>e.kind==='battle'&&e.actor===crystal.actor).reduce((n,e)=>n+e.value,0);assert.ok(gained>0);assert.equal(p.bb,before+gained);
  advanceCombat(b,crystal.at+1);assert.equal(p.bb,before+gained);
 }
 assert.ok(found);
});
