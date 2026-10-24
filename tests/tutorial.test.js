import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newSave,makeCatalog,validateSave} from '../dist/engine.js';
import {TUTORIALS,TutorialSession} from '../dist/tutorial.js';
const catalog=makeCatalog(JSON.parse(readFileSync(new URL('../dist/units.json',import.meta.url))));
const source=JSON.parse(readFileSync(new URL('../docs/tutorial-source.json',import.meta.url)));
const drain=t=>{for(let i=0;t.waiting&&i<5;i++)t.settle();assert.equal(t.waiting,false);};
function play(t){
 let count=0;const history=[];
 while(!t.complete&&count++<200){
  const s=t.step;history.push({line:s.line,wave:t.battle.wave,input:s.input||s.kind});
  if(s.kind==='say'||s.kind==='story')assert.equal(t.perform('next').accepted,true);
  else if(s.kind==='action')assert.equal(t.perform(s.input,s.index).accepted,true);
  else if(s.kind==='free'){
   assert.notEqual(t.battle.phase,'defeat');
   const i=t.battle.party.findIndex(p=>p.hp>0&&!p.acted);assert.ok(i>=0);
   const p=t.battle.party[i];t.perform(p.bb>=p.bbCost?'burst':'attack',i);
  }
  drain(t);
 }
 assert.equal(t.complete,true);assert.equal(t.battle.wave,2);return history;
}
test('원본 스크립트의 줄 번호와 한국어 대사를 연결한다',()=>{
 for(const q of TUTORIALS)for(const s of q.steps){assert.ok(source[q.file].split('\n')[s.line-1],q.file+':'+s.line);assert.match(s.text,/[가-힣]|\{name\}/);}
});
test('네 시작 영웅 모두 튜토리얼 두 장의 전투 여섯 번을 끝까지 진행한다',()=>{
 for(const id of ['10011','20011','30011','40011'])for(const chapter of [1,2]){
  const save=newSave(id,catalog),before=structuredClone(save),t=new TutorialSession(save,catalog,chapter);
  const h=play(t);assert.deepEqual(new Set(h.map(s=>s.wave)),new Set([0,1,2]));assert.deepEqual(save,before,'훈련은 재화·부대·보유 유닛을 바꾸지 않는다');
  if(chapter===1){assert.ok(h.findIndex(s=>s.input==='target')<h.findIndex(s=>s.input==='chest'));assert.ok(h.findIndex(s=>s.input==='chest')<h.findIndex(s=>s.input==='heal'));}
  else assert.ok(h.findIndex(s=>s.input==='hold')<h.findIndex(s=>s.input==='burst'));
 }
});
test('설명 중 공격·잘못된 유닛·다음 버튼으로 필수 조작을 건너뛰지 못한다',()=>{
 const t=new TutorialSession(newSave('10011',catalog),catalog);
 assert.equal(t.perform('attack',2).accepted,false);
 while(t.step.input!=='attack')t.perform('next');
 const before=structuredClone(t.battle),step=t.stepIndex;
 assert.equal(t.perform('attack',0).accepted,false);assert.equal(t.perform('next').accepted,false);
 assert.equal(t.stepIndex,step);assert.deepEqual(t.battle,before);
 assert.equal(t.perform('attack',2).accepted,true);assert.equal(t.perform('attack',2).accepted,false);
 drain(t);assert.equal(t.step.index,0);
});
test('보스 선공 뒤 회복약은 지정한 유닛에게 한 번만 적용한다',()=>{
 const t=new TutorialSession(newSave('20011',catalog),catalog,1,2);
 t.perform('next');drain(t);t.perform('next');
 assert.equal(t.step.input,'item');assert.equal(t.perform('heal',2).accepted,false);
 t.perform('item');const before=t.battle.party[2].hp;
 assert.equal(t.perform('heal',0).accepted,false);t.perform('heal',2);drain(t);
 assert.ok(t.battle.party[2].hp>before);assert.equal(t.battle.itemsUsed,1);
 assert.equal(t.perform('heal',2).accepted,false);
});
test('각 전투 시작 지점에서 다시 시작해도 필수 안내와 완료까지 이어진다',()=>{
 for(const chapter of [1,2])for(const wave of [1,2])play(new TutorialSession(newSave('40011',catalog),catalog,chapter,wave));
});
test('이전 저장 기록을 유지하며 훈련 진행을 검증하고 왕복 복원한다',()=>{
 const old=newSave('30011',catalog);delete old.tutorial;
 const migrated=validateSave(old,catalog);assert.deepEqual(migrated.party,old.party);assert.deepEqual(migrated.tutorial,{chapter:1,wave:0,active:false,completed:[]});
 migrated.tutorial={chapter:2,wave:1,active:true,completed:[1]};
 assert.deepEqual(validateSave(JSON.parse(JSON.stringify(migrated)),catalog).tutorial,migrated.tutorial);
 for(const t of [{chapter:3,wave:0,active:true,completed:[]},{chapter:1,wave:4,active:true,completed:[]},{chapter:1,wave:0,active:true,completed:[1,1]}])assert.throws(()=>validateSave({...migrated,tutorial:t},catalog));
});
