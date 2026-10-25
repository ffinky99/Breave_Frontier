import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INTRO_FLOW,IntroSequence,IntroMessage,IntroParticles,IntroCarousel,cleanName} from '../dist/intro.js';
const params=JSON.parse(readFileSync(new URL('../dist/intro-particle.json',import.meta.url)));
const proof=JSON.parse(readFileSync(new URL('../docs/sources/intro-native-proof.json',import.meta.url)));
function run(sequence,ms){sequence.lastWall??=0;const end=sequence.lastWall+ms;while(sequence.lastWall<end)sequence.update(Math.min(end,sequence.lastWall+1000/60));}
test('도입은 이름과 영웅 선택을 해당 대사 사이에 두고 실제로 확정한 영웅을 보존한다',()=>{
 const intro=new IntroSequence(params,{random:()=>.6});assert.equal(intro.hero,2);
 assert.equal(intro.tap(),false);run(intro,3100);
 for(let i=0;i<3;i++){intro.tap();intro.tap();}
 assert.equal(intro.stage,'name');assert.equal(intro.submitName('  '),false);assert.equal(intro.submitName('한글소환사'),true);
 intro.tap();intro.tap();assert.equal(intro.stage,'hero');assert.equal(intro.chooseHero(3),false);
 run(intro,500);assert.equal(intro.chooseHero(3),true);assert.equal(intro.hero,3);assert.equal(intro.stage,'line4');
 intro.tap();intro.tap();assert.equal(intro.stage,'skip');intro.chooseTutorial(true);run(intro,5900);assert.equal(intro.stage,'exit');run(intro,150);assert.equal(intro.stage,'complete');assert.equal(intro.skip,true);
 assert.equal(INTRO_FLOW.length,10);assert.deepEqual(proof.intro.order.slice(0,6),['TUTORIAL1_1','TUTORIAL1_2','TUTORIAL1_3','nameInput','TUTORIAL1_4','heroSelect']);
});
test('한글 이름은 공백 제거 후 유니코드 문자 8개를 유지한다',()=>{
 assert.equal(cleanName('  가나다라마바사아자차  '),'가나다라마바사아');assert.equal(Array.from(cleanName('가😀나다라마바사아')).length,8);
});
test('speed10은 6업데이트마다 문자, wait20은 20업데이트 대기하고 터치로 남은 대사를 표시한다',()=>{
 const m=new IntroMessage('가<wait=20>나');for(let i=0;i<5;i++)m.update();assert.equal(m.text,'');m.update();assert.equal(m.text,'가');m.update();assert.equal(m.wait,20);
 for(let i=0;i<19;i++)m.update();assert.equal(m.text,'가');m.reveal();assert.equal(m.text,'가나');assert.equal(m.complete,true);
 const intro=new IntroSequence(params);run(intro,3100);const index=intro.index;intro.tap();assert.equal(intro.index,index);assert.equal(intro.message.complete,true);intro.tap();assert.equal(intro.index,index+1);
});
test('탭 숨김은 도입 대기·입자·페이드를 진행시키지 않는다',()=>{
 const intro=new IntroSequence(params);run(intro,1000);const before=intro.time;intro.update(intro.lastWall+60000,{paused:true});assert.equal(intro.time,before);intro.update(intro.lastWall+20);assert.ok(intro.time-before<34);
});
test('입자는 원본 수명0±5와 생성 후 삭제 순서, 40개 상한을 따른다',()=>{
 assert.equal(params.particleLifespan,0);assert.equal(params.particleLifespanVariance,5);assert.equal(params.maxParticles,40);
 const zero=new IntroParticles(params,()=>0);zero.update();assert.equal(zero.particles.length,0);
 const alive=new IntroParticles(params,()=>.75);alive.update();assert.equal(alive.particles.length,40);assert.equal(alive.particles[0].life,2.5);assert.equal(alive.particles[0].age,1/60);
 alive.update(3);assert.equal(alive.particles.length,0,'죽은 입자를 같은 프레임에 다시 만들지 않는다');alive.update();assert.equal(alive.particles.length,40);
});
test('원본 화살표는 감쇠0.92의13업데이트로 다음 페이지에 안착하고 양끝을 순환한다',()=>{
 const c=new IntroCarousel(3),positions=[];c.arrow(1);while(c.moving){c.update();positions.push(c.position-960);assert.ok(positions.length<20);}
 assert.equal(positions.length,13);assert.ok(Math.abs(positions[0]-36.8)<.001);assert.ok(Math.abs(positions[1]-73.6)<.001);assert.equal(positions.at(-1),320);assert.equal(c.page,0);
 c.arrow(-1);while(c.moving)c.update();assert.equal(c.page,3);assert.equal(c.offset(3),0);
});
test('스와이프는 이벤트별 속도 제한을 쓰고 놓으면 원본 페이지 스냅을 시작한다',()=>{
 const c=new IntroCarousel();c.startDrag();c.drag(-100);assert.ok(Math.abs(c.velocity-20.4)<.001);assert.equal(c.position,0,'이동 이벤트가 곧바로 화면 위치를 바꾸지 않는다');c.update();c.endDrag();while(c.moving)c.update();assert.equal(c.page,1);
 c.startDrag();c.drag(-2);c.update();for(let i=0;i<80;i++)c.update();c.endDrag();while(c.moving)c.update();assert.equal(c.page,1,'낮은 속도에서는 가장 가까운 페이지로 돌아간다');
});
