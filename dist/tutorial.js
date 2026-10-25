// Korean localization of the user's APK: tuto1.txt and tuto9.txt.
// Every line number is retained for comparison with docs/tutorial-source.json.
// Enemy IDs/stats now come from identified 2014 GL captures. Guided damage and
// temporary allies still enforce the script; see docs/튜토리얼-복원.md for limits.
// The rehearsal never spends or grants the player's currencies.
import {stats, act, enemyTurn, usePotion, elementMultiplier} from './engine.js';
import {TUTORIAL_ENCOUNTERS} from './tutorial-encounters.js';

const story=(line,text,face=0,extra={})=>({line,text,face,kind:'story',...extra});
const say=(line,text,focus=null,extra={})=>({line,text,focus,kind:'say',...extra});
const action=(line,text,input,index,focus,extra={})=>({line,text,input,index,focus,kind:'action',...extra});
const free=(line,text,extra={})=>({line,text,kind:'free',...extra});
export const TUTORIALS=[
 {id:1,name:'전투의 기초',file:'tuto1.txt',summary:'공격 · 적 선택 · 하트 결정 · 보물상자 · 회복약',steps:[
  story(17,'…{name}…',0,{wake:true,enter:'wave0'}),
  story(24,'…{name}…?',0,{wake:true}),
  story(31,'이봐, {name}!!',2,{wake:true}),
  story(45,'정말… 이제 좀 일어나라고!!!',2,{speaker:'???'}),
  story(48,'…응? 나 말이야? 네 길잡이잖아!\n루시어스 님께 못 들었어? 흥…',8,{speaker:'???'}),
  story(50,'나는 여신 티리스야.\n너를 도와줄 길잡이로 임명됐지.',0),
  story(53,'어디를 안내하냐고? 당연히 그랑가이아지!\n게이트를 넘을 힘은 있으면서, 모르는 게 참 많네?',3),
  story(55,'아무튼 이 초원부터 건너야 해.\n자세한 이야기는 나중에 하자.',7),
  story(57,'저, 저건 뭐야?!',3,{after:'show-enemies'}),
  story(71,'위험해!! 괴, 괴물이잖아!\n어서 뭐라도 해 봐! 유닛을 소환해!',4),
  story(73,'…뭐? 어떻게 하는지 모른다고?',3),
  story(76,'너 소환사 맞잖아?!\n정신을 집중해 봐!!',2,{after:'show-party'}),
  story(88,'휴… 그래. 바로 그렇게 하는 거야…',0),
  story(90,'잠깐, 어떻게 {leader}까지 소환한 거야?!',3),
  story(92,'지금은 그게 중요한 게 아니지!\n저 녀석이 덤비기 전에 먼저 공격해!',2),
  story(94,'뭘 기다리고 있어?! 어서 공격해!',0),
  say(113,'소환한 유닛으로 적을 공격해.\n적의 체력을 0으로 만들면 쓰러뜨릴 수 있어!','enemy-life'),
  say(121,'공격은 간단해. 아래의 행동 버튼을 누르면\n그 유닛이 적에게 달려가서 공격해.','unit-2'),
  action(125,'자, 직접 해 봐!\n가운데 행동 버튼을 눌러 봐.','attack',2,'unit-2'),
  action(139,'공격을 시작했어! 다른 행동 버튼도 누르면\n남은 유닛들이 함께 공격할 수 있어.','attack',0,'unit-0'),
  action(151,'마지막 유닛도 이어서 공격해 봐!','attack',1,'unit-1',{kill:true}),
  say(160,'완벽해! 내가 잘 가르쳐 준 덕분이지?\n…그 표정은 뭐야? 됐어, 어서 가자!'),
  action(170,'또 나타났네… 뒤쪽 녀석부터 공격하자!\n뒤에 있는 적을 눌러 목표로 정해 봐.','target',1,'enemy-1',{enter:'wave1'}),
  say(174,'목표를 바꿨어! 적을 누르면 언제든\n공격할 대상을 바꿀 수 있다는 걸 기억해.','enemy-1'),
  action(183,'어서 행동 버튼을 눌러 공격해!','attack',2,'unit-2'),
  action(193,'위쪽 유닛도 함께 공격해!','attack',0,'unit-0'),
  action(206,'아래쪽 유닛도 공격해!','attack',1,'unit-1',{kill:true}),
  say(221,'공격받으면 유닛의 체력이 줄어들어.\n체력이 0이 되면 싸울 수 없으니 조심해!','hp-2',{enter:'enemy-strike'}),
  action(230,'좋아, 이제 한 마리 남았어. 끝내 버리자!','attack',2,'unit-2',{heart:true}),
  action(240,'다른 유닛도 이어서 공격해!','attack',0,'unit-0'),
  action(253,'마지막 공격이야!','attack',1,'unit-1',{kill:true}),
  say(264,'전투 중 떨어지는 하트 결정은 체력을 회복시켜 줘.\n많이 공격할수록 얻을 기회도 많아져.','heart',{enter:'heart'}),
  say(271,'괴물에게서 보물상자가 나오기도 해.\n상자를 누르면 열 수 있어. 무엇이 들었을까?','chest',{enter:'chest'}),
  action(275,'어서 보물상자를 눌러 열어 봐!','chest',null,'chest'),
  say(282,'상자에는 여러 가지 물건이 들어 있어.\n가끔 괴물이 숨어 있기도 하니까 조심하고!','chest'),
  say(290,'이번엔 우두머리야!\n만만치 않을 테니 마음 단단히 먹어!','enemy-0',{enter:'wave2'}),
  say(302,'이대로면 유닛이 쓰러지겠어!\n이럴 때를 위해 회복 아이템을 준비하는 거야.','hp-2',{enter:'boss-strike'}),
  action(305,'아이템 칸의 회복약을 쓰면 체력이 회복돼.\n회복약을 눌러 봐!','item',null,'item'),
  action(315,'회복약을 골랐어!\n이제 체력을 회복할 유닛을 눌러 줘.','heal',2,'unit-2'),
  say(321,'좋아! 체력이 회복됐어!\n이제 힘을 합쳐 적을 쓰러뜨리자!','hp-2'),
  free(327,'유닛을 눌러 공격해!\n모두 행동하면 적의 차례가 돌아와.'),
  {kind:'complete',line:328,text:'첫 번째 전투 훈련을 마쳤어!'},
 ]},
 {id:2,name:'속성과 필살기',file:'tuto9.txt',summary:'여섯 속성 · 유리한 공격 · 전투 결정 · 필살기',steps:[
  story(23,'이봐! 내가 얼마나 기다렸는지 알아?!',2,{enter:'wave0'}),
  story(25,'오! 유닛도 강화했구나?\n전보다 강해 보이는걸!',1),
  story(27,'앞으로 갈 길은 아주 멀어.\n적도 점점 강해질 테니 유닛 강화를 잊지 마.',7),
  story(29,'그럼 전투의 기본을 더 배워 보자.\n준비됐어? 초원을 건너가자!',0),
  say(48,'이번에는 유닛의 속성이야.\n알아 두면 전투에서 큰 도움이 돼!','elements'),
  say(54,'모든 유닛에는 속성이 있어.\n불 · 물 · 숲 · 번개 · 빛 · 어둠, 이렇게 여섯 가지야.','elements'),
  say(60,'괴물에게도 속성이 있어. 이 녀석은 물 속성이네.\n각 속성에는 강한 상대와 약한 상대가 있어.','enemy-current',{enter:'water-target'}),
  say(65,'적을 선택하면 더 큰 피해를 줄 수 있는\n유닛에게 유리한 속성 표시가 나타나.','unit-1'),
  action(71,'번개는 물에 강해!\n번개 속성 유닛으로 물 속성 적을 공격해 봐.','attack',1,'unit-1',{kill:true}),
  say(78,'잘했어! 내가 있어서 다행이지?\n나머지 속성의 관계도 보여 줄게.'),
  say(81,'불 → 숲 → 번개 → 물 → 불\n화살표가 가리키는 속성에 강해. 빛과 어둠은 서로에게 강해!','diagram'),
  say(85,'속성은 전투에 큰 영향을 줘.\n상성을 생각해서 부대를 꾸려야 해. 자, 남은 적도 쓰러뜨리자!'),
  free(90,'남아 있는 유닛으로 공격해!'),
  say(97,'더 강한 적이 나타났네.\n특별한 기술, 필살기를 가르쳐 줄 때가 됐어!','bb-2',{enter:'wave1'}),
  say(104,'적을 공격하면 전투 결정이 떨어지기도 해.\n결정은 무작위로 동료에게 들어가 필살기 게이지를 채워 줘.','crystal'),
  say(109,'아직 게이지가 부족하네.\n이번 한 번만 내 마법으로 도와줄게. 고요한 빛이여…','bb-2'),
  say(114,'전투 결정의 입맞춤!!!','crystal',{enter:'fill-bb',rainbow:true}),
  action(126,'후후, 대단하지? 이제 필살기를 쓸 수 있어!\n가운데 행동 버튼을 길게 눌러 봐.','hold',2,'unit-2'),
  action(132,'게이지가 가득 찼을 때 길게 누르면 기술 창이 열려.\n이제 오른쪽 위로 밀어 봐!','burst',2,'unit-2'),
  say(141,'잘했어! 유닛마다 고유한 필살기가 있어.\n게이지를 채워서 사용할 수 있지.'),
  say(142,'공격과 회복처럼 서로를 도울 수 있는\n필살기를 가진 유닛들을 함께 편성해 봐.'),
  say(149,'또 우두머리야! 지금까지 배운 걸 모두 써서\n이번 적도 쓰러뜨려 봐!','enemy-0',{enter:'wave2'}),
  free(152,'속성을 확인하고, 결정이 모이면 필살기도 써 봐!'),
  {kind:'complete',line:153,text:'속성과 필살기 훈련을 마쳤어!'},
 ]},
];

export class TutorialSession {
 constructor(save,catalog,chapter=1,wave=0){
  this.quest=TUTORIALS.find(q=>q.id===chapter);if(!this.quest||![0,1,2].includes(wave))throw Error('훈련을 찾을 수 없습니다.');
  this.catalog=catalog;this.name=save.name;this.leader=save.starterId;this.stepIndex=0;
  this.target=0;this.waiting=false;this.pendingNext=false;this.pendingEnemy=false;this.selectedItem=false;this.commandOpen=false;this.chestOpen=false;this.chestVisible=false;this.crystal=null;
  this.visibleParty=chapter===2;this.visibleEnemies=chapter===2;
  // Temporary rehearsal allies. They do not change the player's owned roster.
  // initPartyStatus() orders fire support / thunder support / selected leader.
  const ids=['10030','40030',this.leader];
  this.battle={questId:'tutorial-'+chapter,seed:72157,turn:1,wave:0,phase:'player',party:ids.map(id=>{
   const d=catalog[id],s=stats({id,level:chapter===2?2:1},catalog);
   return {id,...s,maxHp:s.hp,element:d.element,bb:0,bbCost:d.skill.cost,guard:false,acted:false,level:chapter===2?2:1};
  }),enemies:[],damage:0,maxCombo:0,claimed:false,attackBuff:0,defenseBuff:0,itemsUsed:0,events:[],turnActions:0};
  if(wave){this.stepIndex=this.quest.steps.findIndex(s=>s.enter==='wave'+wave);this.visibleParty=true;this.visibleEnemies=true;}
  this.enter();
 }
 get step(){return this.quest.steps[this.stepIndex];}
 get complete(){return this.step.kind==='complete';}
 get checkpoint(){return {chapter:this.quest.id,wave:this.battle.wave};}
 text(){return this.step.text.replaceAll('{name}',this.name).replaceAll('{leader}',this.catalog[this.leader].name);}
 wave(n){
  this.battle.wave=n;this.battle.turn=1;this.battle.phase='player';this.battle.turnActions=0;
  this.battle.party.forEach(p=>{p.acted=false;p.guard=false;});
  // Preserve captured array order. Original screen-slot coordinates are unknown.
  this.battle.enemies=TUTORIAL_ENCOUNTERS[this.quest.id][n].map((enemy,index)=>
   ({...enemy,index,maxHp:enemy.hp,rec:0,boss:n===2}));
  this.target=0;this.chestVisible=false;this.crystal=null;
 }
 enter(){
  const s=this.step;const events=[];
  if(s.enter?.startsWith('wave'))this.wave(Number(s.enter.at(-1)));
  if(s.enter==='water-target')this.target=this.battle.enemies.findIndex(e=>e.element==='water');
  if(['enemy-strike','boss-strike'].includes(s.enter)){
   const p=this.battle.party[2],enemy=Math.max(0,this.battle.enemies.findIndex(e=>e.hp>0));
   const hp=Math.round(p.maxHp*(s.enter==='boss-strike'?.23:.58)),value=Math.max(0,p.hp-hp);p.hp=hp;
   this.battle.party.forEach(p=>{p.acted=false;p.guard=false;});this.battle.turn++;this.battle.phase='player';
   events.push({type:'enemy-hit',enemy,actor:2,value,actual:value,burst:s.enter==='boss-strike'});
  }
  if(s.enter==='heart'){
   const p=this.battle.party[2],value=Math.min(p.maxHp-p.hp,Math.round(p.rec*.35));p.hp+=value;this.crystal='heart';
   events.push({type:'heal',actor:2,value},{type:'crystal',kind:'heart',actor:2});
  }
  if(s.enter==='chest'){this.chestVisible=true;this.crystal=null;}
  if(s.enter==='fill-bb'){
   this.battle.party.forEach(p=>p.bb=p.bbCost);this.crystal='battle';events.push(...this.battle.party.map((_,actor)=>({type:'crystal',kind:'battle',actor})));
  }
  if(s.kind==='free'){this.crystal=null;this.commandOpen=false;this.battle.phase='player';}
  return events;
 }
 allowed(type,index){
  if(this.waiting||this.complete)return false;
  const s=this.step;
  if(s.kind==='story'||s.kind==='say')return type==='next';
  if(s.kind==='free')return ['attack','guard','burst','target','item','heal','hold'].includes(type);
  return s.input===type&&(s.index==null||s.index===index);
 }
 advance(){
  if(this.step.after==='show-enemies')this.visibleEnemies=true;
  if(this.step.after==='show-party')this.visibleParty=true;
  this.stepIndex=Math.min(this.stepIndex+1,this.quest.steps.length-1);
  return this.enter();
 }
 strike(index,burst=false){
  const b=this.battle,p=b.party[index],info=this.catalog[p.id],s=this.step;
  const targets=burst?b.enemies.map((e,i)=>({e,i})).filter(x=>x.e.hp>0):[{e:b.enemies[this.target],i:this.target}];
  const events=[];p.acted=true;
  for(const {e,i} of targets){
   const value=s.kill||burst?e.hp:Math.min(e.hp-1,Math.ceil(e.maxHp/3));e.hp-=value;b.damage+=value;
   events.push({type:'hit',actor:index,target:i,mode:burst?'burst':'attack',hits:burst?info.skill.hits:info.hits,value,actual:value,critical:false,element:elementMultiplier(p.element,e.element),spark:false});
  }
  if(burst){p.bb=0;this.commandOpen=false;this.crystal=null;}
  else p.bb=Math.min(p.bbCost,p.bb+4);
  if(b.enemies[this.target].hp<=0)this.target=Math.max(0,b.enemies.findIndex(e=>e.hp>0));
  b.maxCombo=Math.max(b.maxCombo,burst?info.skill.hits:info.hits);return events;
 }
 perform(type,index){
  if(!this.allowed(type,index))return {accepted:false,events:[]};
  const s=this.step,b=this.battle;let events=[];
  if(type==='next')events=this.advance();
  else if(type==='target'){
   if(!b.enemies[index]||b.enemies[index].hp<=0)return {accepted:false,events:[]};
   this.target=index;if(s.kind!=='free')events=this.advance();
  }else if(type==='item'){
   if(b.itemsUsed>=3||b.phase!=='player')return {accepted:false,events:[]};
   this.selectedItem=!this.selectedItem;if(s.kind!=='free')events=this.advance();
  }else if(type==='heal'){
   if(!this.selectedItem)return {accepted:false,events:[]};
   const value=usePotion(b,index);this.selectedItem=false;events.push({type:'heal',actor:index,value});
   if(s.kind!=='free')this.pendingNext=true;
  }else if(type==='chest'){
   this.chestOpen=true;events.push({type:'chest'});this.pendingNext=true;
  }else if(type==='hold'){
   this.commandOpen=true;this.commandIndex=index;if(s.kind!=='free')events=this.advance();
  }else if(s.kind==='free'){
   events=act(b,index,type,this.target,this.catalog);
   if(b.enemies[this.target]?.hp<=0)this.target=Math.max(0,b.enemies.findIndex(e=>e.hp>0));
   if(b.phase==='waveclear')this.pendingNext=true;
   if(b.phase==='enemyPending')this.pendingEnemy=true;
   this.commandOpen=false;
  }else if(type==='attack'||type==='burst'){
   events=this.strike(index,type==='burst');this.pendingNext=true;
  }
  if(events.length)this.waiting=true;
  return {accepted:true,events};
 }
 settle(){
  this.waiting=false;let events=[];
  if(this.pendingNext){this.pendingNext=false;events=this.advance();}
  else if(this.pendingEnemy){this.pendingEnemy=false;events=enemyTurn(this.battle);}
  if(events.length)this.waiting=true;
  return {accepted:true,events};
 }
}
