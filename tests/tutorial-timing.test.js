import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCatalog,newSave,queueAction,advanceCombat} from '../dist/engine.js';
import {TutorialSession} from '../dist/tutorial.js';
const catalog=makeCatalog(JSON.parse(readFileSync(new URL('../dist/units.json',import.meta.url))));
function arrive(line,chapter=1){const t=new TutorialSession(newSave('10011',catalog),catalog,chapter);let n=0;while(t.step.line!==line&&n++<300){
 if(t.freeInput){const i=t.battle.party.findIndex(p=>!p.acted);t.perform('attack',i);}
 else if(t.step.kind==='action')t.perform(t.step.input,t.step.index);else t.perform('next');
 if(t.waiting)t.settle();
 }assert.equal(t.step.line,line);return t;}
test('유도 공격은 일반 피해식을 예약하고 다섯 전투 업데이트 뒤 다음 안내에서 멈춘다',()=>{
 const t=arrive(125),hp=t.battle.enemies[0].hp,copy=structuredClone(t.battle);
 queueAction(copy,2,'attack',0,catalog,{at:t.time,duration:1830});t.perform('attack',2);
 assert.deepEqual(t.battle.pendingHits,copy.pendingHits);assert.equal(t.battle.enemies[0].hp,hp);
 for(let i=0;i<5;i++)t.frame();assert.equal(t.step.line,125);assert.equal(t.battle.enemies[0].hp,hp);
 const time=t.time;t.frame();assert.equal(t.step.line,139);assert.equal(t.time,time);assert.equal(t.waiting,false);
 for(let i=0;i<60;i++)t.frame();assert.equal(t.time,time);assert.equal(t.battle.enemies[0].hp,hp);
 t.perform('attack',0);t.settle();assert.equal(t.step.line,151);t.perform('attack',1);t.settle();assert.equal(t.battle.enemies[0].hp,0);
});
test('일시정지와 숨겨진 탭은 타격 예약과 전투 시계를 보존한다',()=>{
 const t=arrive(125);t.tick(0);t.perform('attack',2);t.tick(50);const time=t.time,pending=structuredClone(t.battle.pendingHits);
 t.tick(60050,{paused:true});assert.equal(t.time,time);assert.deepEqual(t.battle.pendingHits,pending);t.tick(60070);assert.ok(t.time-time<=1000/60+1e-6);
});
test('마법은15개 결정을 리더에게 개별 도착시켜 채우고3초 후 길게 누르기를 허용한다',()=>{
 const t=arrive(114,2),before=t.battle.party.map(p=>p.bb);t.perform('next');assert.equal(t.step.line,126);assert.equal(t.allowed('hold',2),false);assert.equal(t.battle.pendingCrystals.length,15);
 assert.ok(t.battle.pendingCrystals.every(c=>c.actor===2&&c.moveAt>=t.time+1500&&c.at>=t.time+2100&&c.at<=t.time+2600));
 const start=t.time;while(t.time<start+2000)t.frame();assert.deepEqual(t.battle.party.map(p=>p.bb),before);
 t.settle();assert.equal(t.battle.party[2].bb,15);assert.deepEqual(t.battle.party.slice(0,2).map(p=>p.bb),before.slice(0,2));assert.equal(t.allowed('hold',2),true);
});
test('자유 전투에서는 타격이 진행 중이어도 다른 미행동 유닛을 누를 수 있다',()=>{
 const t=arrive(327);t.perform('attack',0);assert.equal(t.waiting,true);assert.equal(t.allowed('attack',1),true);assert.equal(t.allowed('attack',0),false);assert.equal(t.perform('attack',1).accepted,true);
});
test('튜토리얼 아군만 최소HP1 보호를 받고 적과 일반 전투는HP0이 된다',()=>{
 const t=arrive(125),b=t.battle;b.phase='player';b.pendingHits=[{side:'enemy',actor:0,target:2,at:0,frame:0,hit:0,value:1e8}];advanceCombat(b,0);assert.equal(b.party[2].hp,1);
 b.tutorialMode=false;b.pendingHits=[{side:'enemy',actor:0,target:2,at:1,frame:1,hit:0,value:10}];advanceCombat(b,1);assert.equal(b.party[2].hp,0);
});
test('실제 소유한 불·번개 부대와 레벨을 재사용하고 훈련이 원본 저장을 바꾸지 않는다',()=>{
 const save=newSave('20011',catalog);save.units['10030'].level=7;save.units['40030'].level=5;const before=structuredClone(save),t=new TutorialSession(save,catalog,2);
 assert.deepEqual(t.battle.party.map(p=>[p.id,p.level]),[['10030',7],['40030',5],['20011',1]]);assert.deepEqual(save,before);
});
