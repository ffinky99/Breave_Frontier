import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCatalog,newSave,validateSave,advanceJourney,completeJourneyBattle,resumeJourneyState} from '../dist/engine.js';
import {JOURNEY_STEPS,journeyStep} from '../dist/tutorial-journey.js';
import {TutorialSession} from '../dist/tutorial.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const catalog=makeCatalog(json('../dist/units.json'));
const sources=json('../docs/preservation-tutorials.json');
const native=json('../docs/sources/tutorial-native-proof.json');
const roundtrip=save=>validateSave(JSON.parse(JSON.stringify(save)),catalog);
function finishBattle(save,chapter){
 const t=new TutorialSession(save,catalog,chapter);let n=0;
 while(!t.complete&&n++<300){
  const s=t.step;
  if(['story','say'].includes(s.kind))t.perform('next');
  else if(s.kind==='action')t.perform(s.input,s.index);
  else if(s.kind==='free'){
   assert.notEqual(t.battle.phase,'defeat');
   const i=t.battle.party.findIndex(p=>p.hp>0&&!p.acted),p=t.battle.party[i];
   t.perform(p.bb>=p.bbCost?'burst':'attack',i);
  }
  for(let wait=0;t.waiting&&wait<10;wait++)t.settle();
 }
 assert.equal(t.complete,true);
 Object.assign(save.tutorial,t.checkpoint);save.tutorial.active=false;
 if(!save.tutorial.completed.includes(chapter))save.tutorial.completed.push(chapter);
 assert.equal(completeJourneyBattle(save,chapter),true);
 assert.equal(completeJourneyBattle(save,chapter),false,'completed battle cannot advance twice');
}
function next(save){const s=journeyStep(save.journey);return advanceJourney(save,s.id,s.kind==='story'?'next':s.kind==='gate'?'gate-finished':s.action,catalog,0);}
function arrive(id){const save=newSave('10011',catalog);finishBattle(save,1);finishBattle(save,2);while(save.journey.step!==id)next(save);return save;}
test('기본 경로는 파일 이름순이 아닌 APK 실제 분기 1→9→15→16→홈을 따른다',()=>{
 assert.deepEqual(native.mainline.map(s=>s.script),['tuto1.txt','tuto9.txt','tuto15.txt','tuto16.txt',null]);
 assert.deepEqual(JOURNEY_STEPS.filter(s=>s.nativeChapter).map(s=>s.nativeChapter),[1,9,12]);
 for(const s of JOURNEY_STEPS.filter(s=>s.source)){
  const line=sources[s.source]?.split('\n')[s.line-1];assert.ok(line,s.source+':'+s.line);
  if(s.kind==='story')assert.match(line,/type=MSGDRAW/);
  assert.match(s.text||s.title,/[가-힣]/);
 }
});
test('네 시작 영웅이 6개 전투부터 소환·작별·홈까지 연결되고 모든 경계에서 복원된다',()=>{
 for(const id of ['10011','20011','30011','40011']){
  let save=newSave(id,catalog);const gems=save.gems,count=Object.keys(save.units).length;
  for(const chapter of [1,2]){finishBattle(save,chapter);save=roundtrip(save);}
  let n=0;while(save.journey.active&&n++<40){
   next(save);const before=structuredClone(save.journey);save=roundtrip(save);
   assert.deepEqual(save.journey,before);assert.equal(resumeJourneyState(save),false);
  }
  assert.equal(save.journey.step,'complete');assert.equal(save.gems,gems);
  assert.equal(save.summons,1);assert.equal(Object.keys(save.units).length,count+1);
 }
});
test('잘못된 조작과 연속 클릭은 선물 지급·소환 지불을 반복하지 않는다',()=>{
 let save=arrive('t15-71');const before=save.gems;
 assert.throws(()=>advanceJourney(save,'t15-71','confirm-summon',catalog));assert.equal(save.gems,before);
 next(save);assert.equal(save.gems,before+5);
 assert.throws(()=>advanceJourney(save,'t15-71','next',catalog));assert.equal(save.gems,before+5);
 save=roundtrip(save);while(save.journey.step!=='t15-108')next(save);
 next(save);assert.equal(save.gems,before);assert.equal(save.summons,1);
 const paid=structuredClone(save);assert.throws(()=>advanceJourney(save,'t15-108','confirm-summon',catalog));assert.deepEqual(save,paid);
 const restored=roundtrip(save);assert.deepEqual(restored.journey.summonResult,save.journey.summonResult);
 next(restored);assert.equal(restored.journey.step,'summon-result');assert.equal(restored.summons,1);
});
test('잔액 부족의 확인 실패는 저장을 바꾸지 않고 재개 시 원본처럼 작별로 간다',()=>{
 const save=arrive('t15-108');save.gems=4;const before=structuredClone(save);
 assert.throws(()=>next(save));assert.deepEqual(save,before);
 assert.equal(resumeJourneyState(save),true);assert.equal(save.journey.step,'t16-18');
 assert.equal(save.gems,4);assert.equal(save.summons,0);assert.ok(roundtrip(save));
 while(save.journey.active)next(save);assert.ok(roundtrip(save));
 const paid=arrive('summon-gate');paid.gems=0;
 assert.equal(resumeJourneyState(paid),false);assert.equal(paid.journey.step,'summon-gate');
});
test('이전 저장은 안내를 강제 시작하거나 보상·부대·진행을 초기화하지 않는다',()=>{
 const old=newSave('30011',catalog);delete old.journey;old.gems=73;old.tutorial.completed=[1,2];
 const migrated=roundtrip(old);assert.equal(migrated.journey,null);
 for(const key of ['gems','units','party','tutorial','clears','summons','battles'])assert.deepEqual(migrated[key],old[key]);
 assert.equal(completeJourneyBattle(migrated,1),false);assert.equal(resumeJourneyState(migrated),false);
});
test('선물·완료·소환 결과의 불가능한 저장 순서를 거부한다',()=>{
 const save=newSave('10011',catalog);
 for(const change of [{step:'missing'},{active:false},{giftClaimed:true},{step:'summon-gate',giftClaimed:true},{summonResult:{id:'10011',duplicate:false,karma:0}}]){
  assert.throws(()=>roundtrip({...save,journey:{...save.journey,...change}}));
 }
 const result=arrive('summon-result');result.journey.summonResult.karma=99;
 assert.throws(()=>roundtrip(result));
});
