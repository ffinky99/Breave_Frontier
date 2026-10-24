import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QUESTS,makeCatalog,newSave,validateSave,stats,growthCost,grow,setParty,elementMultiplier,isUnlocked,createBattle,act,enemyTurn,nextWave,usePotion,claimVictory,summon} from '../dist/engine.js';
import {SpritePlayer} from '../dist/sprites.js';

const data=JSON.parse(readFileSync(new URL('../dist/units.json',import.meta.url)));
const catalog=makeCatalog(data);
const fresh=(id='10011')=>newSave(id,catalog);
function finish(b){
  let actions=0;
  while(!['victory','defeat'].includes(b.phase)&&actions++<1000){
    if(b.phase==='waveclear'){nextWave(b,catalog);continue;}
    if(b.phase==='enemyPending'){enemyTurn(b);continue;}
    const i=b.party.findIndex(p=>p.hp>0&&!p.acted),p=b.party[i];
    if(p.hp<p.maxHp*.35&&b.itemsUsed<3)usePotion(b,i);
    act(b,i,p.bbCost&&p.bb>=p.bbCost?'burst':'attack',0,catalog);
  }
  assert.ok(actions<1000,'전투가 유한한 행동 수 안에 끝나야 한다');
  return b;
}

test('네 시작 영웅은 서로 다른 속성의 지원 유닛 두 명과 시작한다',()=>{
  for(const id of data.starterIds){const s=fresh(id);assert.equal(s.party.length,3);assert.equal(s.party[0],id);assert.equal(new Set(s.party.map(x=>catalog[x].element)).size,3);assert.equal(s.gems,6);}
  assert.throws(()=>fresh('60133'));
});
test('모든 시작 영웅은 서로 다른 난수 60개에서 첫 모험을 완주한다',()=>{
  for(const id of data.starterIds)for(let seed=1;seed<=60;seed++){
    const b=finish(createBattle(fresh(id),'grass-1',catalog,seed));
    assert.equal(b.phase,'victory',`${id}, seed ${seed}`);
    assert.equal(b.wave,2);assert.ok(b.party.every(p=>p.hp>=0&&p.hp<=p.maxHp));
  }
});
test('한 차례에는 한 번만 행동하며 부족한 필살기 게이지는 상태를 바꾸지 않는다',()=>{
  const b=createBattle(fresh(),'grass-1',catalog,17),before=structuredClone(b);
  assert.throws(()=>act(b,0,'burst',0,catalog));assert.deepEqual(b,before);
  act(b,0,'attack',0,catalog);assert.equal(b.party[0].bb,4);assert.throws(()=>act(b,0,'attack',0,catalog));
});
test('속성 유리, 불리, 빛과 어둠의 상호 상성이 적용된다',()=>{
  assert.equal(elementMultiplier('fire','earth'),1.5);assert.equal(elementMultiplier('earth','fire'),.75);
  assert.equal(elementMultiplier('light','dark'),1.5);assert.equal(elementMultiplier('dark','light'),1.5);assert.equal(elementMultiplier('water','water'),1);
});
test('방어는 같은 난수의 적 공격 피해를 절반으로 줄인다',()=>{
  const s=fresh();setParty(s,['10011']);const normal=createBattle(s,'grass-1',catalog,123),guarded=structuredClone(normal);
  normal.phase='enemyPending';guarded.phase='enemyPending';guarded.party[0].guard=true;
  const a=enemyTurn(normal),b=enemyTurn(guarded);
  assert.deepEqual(b.map(e=>e.value),a.map(e=>Math.max(1,Math.floor(e.value/2))));
  assert.equal(guarded.party[0].guard,false);assert.equal(guarded.phase,'player');assert.equal(guarded.turn,2);
});
test('전체 공격 필살기는 살아 있는 모든 적을 공격하고 게이지를 소모한다',()=>{
  const b=createBattle(fresh(),'grass-1',catalog,55);b.party[0].bb=b.party[0].bbCost;
  const events=act(b,0,'burst',0,catalog).filter(e=>e.type==='hit');assert.equal(events.length,2);assert.equal(b.party[0].bb,0);assert.ok(events.every(e=>e.hits===5));
});
test('회복약은 생존한 부상 유닛에만 최대 세 번 사용한다',()=>{
  const b=createBattle(fresh(),'grass-1',catalog,1),p=b.party[0];assert.throws(()=>usePotion(b,0));
  for(let i=0;i<3;i++){p.hp=1;const heal=usePotion(b,0);assert.equal(heal,Math.round(p.maxHp*.5));}
  p.hp=1;assert.throws(()=>usePotion(b,0));assert.equal(b.itemsUsed,3);
  b.itemsUsed=0;p.hp=0;assert.throws(()=>usePotion(b,0));
});
test('전멸은 패배로 끝나며 보상과 다음 웨이브를 열지 않는다',()=>{
  const s=fresh(),b=createBattle(s,'grass-1',catalog,1);b.party.forEach(p=>p.hp=1);b.enemies.forEach(e=>e.atk=100000);b.phase='enemyPending';
  for(let i=0;i<3&&b.phase!=='defeat';i++){enemyTurn(b);if(b.phase!=='defeat')b.phase='enemyPending';}
  assert.equal(b.phase,'defeat');assert.throws(()=>claimVictory(s,b,catalog));assert.throws(()=>nextWave(b,catalog));assert.equal(s.battles,0);
});
test('승리 보상은 한 번만 지급되고 다음 모험을 열며 재도전 보석은 지급하지 않는다',()=>{
  const s=fresh(),b=finish(createBattle(s,'grass-1',catalog,1));const r=claimVictory(s,b,catalog);
  assert.equal(r.gems,3);assert.equal(s.zel,2850);assert.equal(s.gems,9);assert.ok(isUnlocked(QUESTS[1],s));
  const before=structuredClone(s);assert.throws(()=>claimVictory(s,b,catalog));assert.deepEqual(s,before);
  const repeat=claimVictory(s,finish(createBattle(s,'grass-1',catalog,2)),catalog);assert.equal(repeat.gems,0);assert.equal(s.clears['grass-1'].count,2);
  assert.throws(()=>createBattle(fresh(),'grass-6',catalog));
});
test('강화 비용 차감과 최대 레벨이 적용되며 실패하면 재화가 그대로다',()=>{
  const s=fresh(),cost=growthCost(s.units['10011']);grow(s,'10011');assert.equal(s.units['10011'].level,2);assert.equal(s.zel,2500-cost.zel);
  s.zel=0;const before=structuredClone(s);assert.throws(()=>grow(s,'10011'));assert.deepEqual(s,before);
  s.units['10011'].level=20;assert.deepEqual(stats(s.units['10011'],catalog),catalog['10011'].max);assert.throws(()=>grow(s,'10011'));
});
test('편성은 보유한 서로 다른 동료 한 명에서 여섯 명만 허용한다',()=>{
  const s=fresh();for(const p of [[],['10011','10011'],['60133']])assert.throws(()=>setParty(s,p));
  setParty(s,[s.party[1],'10011']);assert.equal(s.party[1],'10011');
});
test('영웅 소환은 미보유 영웅을 우선 지급하고 중복은 카르마가 된다',()=>{
  const s=fresh();s.gems=12;for(let i=0;i<3;i++){const r=summon(s,'hero',catalog,0);assert.equal(r.duplicate,false);}
  assert.ok(data.starterIds.every(id=>s.units[id]));const r=summon(s,'hero',catalog,.999);assert.equal(r.duplicate,true);assert.equal(r.karma,500);assert.equal(s.gems,0);
  const before=structuredClone(s);assert.throws(()=>summon(s,'hero',catalog));assert.deepEqual(s,before);
});
test('일반 소환은 영웅 외 20종을 지급하며 재화가 부족하면 변경하지 않는다',()=>{
  const s=fresh();s.zel=100000;const seen=new Set();for(let i=0;i<20;i++)seen.add(summon(s,'regular',catalog,(i+.5)/20).id);
  assert.equal(seen.size,20);assert.ok([...seen].every(id=>!data.starterIds.includes(id)));
  s.zel=0;const before=structuredClone(s);assert.throws(()=>summon(s,'regular',catalog));assert.deepEqual(s,before);
});
test('저장 파일은 정상 복원되고 잘못된 재화, 레벨, 편성, 기록은 거부된다',()=>{
  const s=fresh();assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s)),catalog).party,s.party);
  for(const mutate of [x=>x.zel=-1,x=>x.gems=NaN,x=>x.units['10011'].level=21,x=>x.party=['constructor'],x=>x.party=['10011','10011'],x=>x.clears={'grass-1':null}]){const raw=structuredClone(s);mutate(raw);assert.throws(()=>validateSave(raw,catalog));}
  const raw=structuredClone(s);raw.volume=NaN;assert.equal(validateSave(raw,catalog).volume,.35);
});
test('최대 성장한 여섯 명의 부대로 모든 웹판 모험을 완주할 수 있다',()=>{
  const s=fresh();const ids=[...data.starterIds,'30050','40050'];s.units=Object.fromEntries(ids.map(id=>[id,{id,level:20,xp:0}]));setParty(s,ids);
  for(const q of QUESTS){const b=finish(createBattle(s,q.id,catalog,2048));assert.equal(b.phase,'victory',q.id);claimVictory(s,b,catalog);}
  assert.equal(Object.keys(s.clears).length,8);
});
test('원본 모션의 0 길이 프레임과 누락된 이동 모션을 안전하게 재생한다',()=>{
  const animations=JSON.parse(readFileSync(new URL('../dist/animations.json',import.meta.url))),player=new SpritePlayer(animations);
  assert.ok(player.duration('10011','move')>0);assert.deepEqual(animations['30050'].fallbackActions,['move']);
  for(const id of Object.keys(animations))for(const action of ['idle','move','atk'])for(const time of [0,100,1e6])assert.ok(player.getFrame(id,action,time)[0]<animations[id].frames.length);
});
