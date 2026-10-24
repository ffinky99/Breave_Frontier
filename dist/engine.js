// Pure offline rules. Original statistics and Korean names live in units.json.
// Combat formula, growth curve, quests, rewards and summon rules are web adaptations.
export const SAVE_KEY = 'brave-frontier-ko.v1';
export const ELEMENTS = {
  fire:{name:'불', color:'#ff8465', symbol:'불'}, water:{name:'물',color:'#73cfff',symbol:'물'},
  earth:{name:'숲',color:'#9bd47e',symbol:'숲'},thunder:{name:'번개',color:'#ffdc6e',symbol:'번개'},
  light:{name:'빛',color:'#f8edba',symbol:'빛'},dark:{name:'어둠',color:'#c699ff',symbol:'어둠'},
};
// Authored offline route; not represented as recovered original missions.
export const QUESTS = [
 {id:'grass-1',name:'소환사의 첫걸음',subtitle:'초원 입구',recommend:1,waves:[['10030','30030'],['20030','40030'],['10050','30030','10030']],rewardUnit:'20030'},
 {id:'grass-2',name:'초원의 작은 수호자',subtitle:'초원 깊은 곳',recommend:3,waves:[['30030','30050','30030'],['10050','20050'],['30031','30030']],rewardUnit:'30050'},
 {id:'grass-3',name:'물결을 가르는 창',subtitle:'강가의 길',recommend:5,waves:[['20030','20050'],['20050','20030','20050'],['20050','40050','20050']],rewardUnit:'20050'},
 {id:'grass-4',name:'뇌우의 그림자',subtitle:'바람 부는 언덕',recommend:8,waves:[['40030','40050','40030'],['40031','40050'],['40031','40050','40031']],rewardUnit:'40050'},
 {id:'grass-5',name:'황혼에 깨어난 자',subtitle:'해질녘의 초원',recommend:11,waves:[['60030','60050','60030'],['60031','60050'],['60031','60050','60031']],rewardUnit:'60050'},
 {id:'grass-6',name:'초원의 왕',subtitle:'마지막 관문',recommend:14,waves:[['30031','40031'],['50031','60031'],['30031','60031','40031']],rewardUnit:'30031'},
 {id:'training-metal',name:'메탈의 비밀 정원',subtitle:'성장 재료 탐험',recommend:8,extra:true,waves:[['60132','60132'],['60133','60132'],['60133','60133']],rewardUnit:'60132'},
 {id:'training-jewel',name:'주얼의 보물 정원',subtitle:'젤 수집 탐험',recommend:8,extra:true,waves:[['50131','50131'],['50132','50131'],['50133','50132']],rewardUnit:'50131'},
];
export function makeCatalog(data){return Object.fromEntries(data.units.map(u=>[u.id,u]));}
export function newSave(starterId,catalog,name='소환사'){
  if(!['10011','20011','30011','40011'].includes(starterId))throw Error('선택할 수 없는 영웅입니다.');
  const support=['10030','20030','30030','40030'].filter(id=>catalog[id].element!==catalog[starterId].element).slice(0,2);
  const ids=[starterId,...support];
  return {version:1,name:String(name).trim().slice(0,12)||'소환사',starterId,units:Object.fromEntries(ids.map(id=>[id,{id,level:1,xp:0}])),party:ids,zel:2500,karma:800,gems:6,clears:{},summons:0,battles:0,sound:false,volume:0.35,speed:1,tutorialSeen:false,updatedAt:Date.now()};
}
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export function validateSave(raw,catalog){
  if(!raw||raw.version!==1||typeof raw.name!=='string'||!raw.units||Array.isArray(raw.units)||!Array.isArray(raw.party))throw Error('지원하지 않는 저장 파일입니다.');
  if(raw.party.length<1||raw.party.length>6||new Set(raw.party).size!==raw.party.length)throw Error('편성 정보가 올바르지 않습니다.');
  for(const key of ['zel','karma','gems','summons','battles'])if(!integer(raw[key],0,1e9))throw Error('재화 정보가 올바르지 않습니다.');
  const cleanUnits={};
  if(Object.keys(raw.units).length>Object.keys(catalog).length)throw Error('유닛 목록이 올바르지 않습니다.');
  for(const [id,u] of Object.entries(raw.units)){
    if(!Object.hasOwn(catalog,id)||!u||u.id!==id||!integer(u.level,1,20)||!integer(u.xp,0,1e7))throw Error('유닛 정보가 올바르지 않습니다.');
    cleanUnits[id]={id,level:u.level,xp:u.xp};
  }
  if(raw.party.some(id=>typeof id!=='string'||!Object.hasOwn(cleanUnits,id)))throw Error('편성 유닛을 찾을 수 없습니다.');
  const clears={};for(const [id,info] of Object.entries(raw.clears||{})){
    if(!QUESTS.some(q=>q.id===id)||!info||!integer(info.count,1,1e7)||!integer(info.stars,1,3))throw Error('탐험 기록이 올바르지 않습니다.');
    clears[id]={count:info.count,stars:info.stars};
  }
  return {version:1,name:raw.name.slice(0,12)||'소환사',starterId:Object.hasOwn(cleanUnits,raw.starterId)?raw.starterId:raw.party[0],units:cleanUnits,party:[...raw.party],zel:raw.zel,karma:raw.karma,gems:raw.gems,clears,summons:raw.summons,battles:raw.battles,sound:raw.sound===true,volume:Number.isFinite(raw.volume)?Math.max(0,Math.min(1,raw.volume)):0.35,speed:raw.speed===2?2:1,tutorialSeen:raw.tutorialSeen===true,updatedAt:Date.now()};
}
export function stats(unit,catalog){
  const d=catalog[unit.id],progress=(unit.level-1)/19;
  return Object.fromEntries(['hp','atk','def','rec'].map(k=>[k,Math.round(d.base[k]+(d.max[k]-d.base[k])*progress)]));
}
export function growthCost(unit){return {zel:100+unit.level*35,karma:40+unit.level*18};}
export function grow(save,id){
  const u=save.units[id];if(!u)throw Error('유닛을 찾을 수 없습니다.');if(u.level>=20)throw Error('최대 레벨입니다.');
  const cost=growthCost(u);if(save.zel<cost.zel||save.karma<cost.karma)throw Error('젤 또는 카르마가 부족합니다.');
  save.zel-=cost.zel;save.karma-=cost.karma;u.level++;return u;
}
export function setParty(save,ids){
  if(!Array.isArray(ids)||ids.length<1||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>!save.units[id]))throw Error('한 명 이상, 여섯 명 이하로 편성해 주세요.');
  save.party=[...ids];
}
export function elementMultiplier(a,b){
  const stronger={fire:'earth',earth:'thunder',thunder:'water',water:'fire',light:'dark',dark:'light'};
  if(stronger[a]===b)return 1.5;
  if(stronger[b]===a&&a!=='light'&&a!=='dark')return .75;
  return 1;
}
export function isUnlocked(q,save){const index=QUESTS.indexOf(q);return q.extra?!!save.clears['grass-2']:index===0||!!save.clears[QUESTS[index-1]?.id];}
export function random(b){let x=b.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;b.seed=x>>>0;return b.seed/4294967296;}
function enemiesFor(b,catalog){
  const q=QUESTS.find(q=>q.id===b.questId),index=QUESTS.indexOf(q);
  const factor=q.extra ? .95 : .63+index*.21;
  return q.waves[b.wave].map((id,i)=>{
    const d=catalog[id],boss=b.wave===q.waves.length-1&&i===0;
    const stat={hp:Math.round(d.base.hp*factor*(boss?1.65:1)),atk:Math.round(d.base.atk*factor*.8),def:Math.round(d.base.def*factor*.72),rec:0};
    if(q.extra){stat.atk=155;stat.def=100;stat.hp=Math.round(d.base.hp*.55);}
    return {id,index:i,...stat,maxHp:stat.hp,element:d.element,boss,dead:false};
  });
}
export function createBattle(save,questId,catalog,seed=Date.now()){
  const q=QUESTS.find(q=>q.id===questId);if(!q||!isUnlocked(q,save))throw Error('아직 열리지 않은 지역입니다.');
  const leader=catalog[save.party[0]],buffs=leader.leader?.effects||[];
  const party=save.party.map(id=>{
    const s=stats(save.units[id],catalog),d=catalog[id];
    for(const ef of buffs){if(ef['elements buffed']?.includes(d.element)){s.atk=Math.round(s.atk*(1+(ef['atk% buff']||0)/100));s.def=Math.round(s.def*(1+(ef['def% buff']||0)/100));}}
    return {id,...s,maxHp:s.hp,element:d.element,bb:0,bbCost:d.skill.cost,guard:false,acted:false,level:save.units[id].level};
  });
  const b={questId,seed:(seed>>>0)||1234567,wave:0,turn:1,phase:'player',party,enemies:[],damage:0,maxCombo:0,claimed:false,attackBuff:0,defenseBuff:0,itemsUsed:0,events:[],turnActions:0};
  b.enemies=enemiesFor(b,catalog);return b;
}
function hit(b,actor,target,power,guard=false,spark=false){
  const critical=random(b)<.1,element=elementMultiplier(actor.element,target.element);
  const value=Math.max(1,Math.floor((actor.atk*power*element-target.def*.35)*(.9+random(b)*.2)*(critical?1.5:1)*(guard ? .5 : 1)*(spark?1.2:1)));
  const actual=Math.min(target.hp,value);target.hp=Math.max(0,target.hp-value);
  return {value,actual,critical,element,spark};
}
function determine(b){
  if(b.enemies.every(e=>e.hp<=0)){b.phase='waveclear';return;}
  if(b.party.every(p=>p.hp<=0)){b.phase='defeat';return;}
  if(b.party.every(p=>p.hp<=0||p.acted))b.phase='enemyPending';
}
export function act(b,index,mode,targetIndex,catalog,spark=false){
  const actor=b.party[index];if(b.phase!=='player'||!actor||actor.hp<=0||actor.acted)throw Error('지금은 행동할 수 없습니다.');
  const info=catalog[actor.id];if(!['attack','guard','burst'].includes(mode))throw Error('알 수 없는 행동입니다.');
  if(mode==='burst'&&(!actor.bbCost||actor.bb<actor.bbCost))throw Error('필살기 게이지가 부족합니다.');
  const events=[];actor.acted=true;b.turnActions++;
  if(mode==='guard'){actor.guard=true;actor.bb=Math.min(actor.bbCost,actor.bb+2);events.push({type:'guard',actor:index});}
  else{
    const skill=info.skill;
    if(mode==='burst')actor.bb=0;
    if(mode==='burst'&&skill.kind.includes('buff')){
      if(skill.kind==='attack-buff')b.attackBuff=3;else b.defenseBuff=3;
      events.push({type:'buff',actor:index,kind:skill.kind});
    }else{
      const living=b.enemies.map((e,i)=>({e,i})).filter(x=>x.e.hp>0);
      const chosen=living.find(x=>x.i===targetIndex)||living[0];
      const targets=mode==='burst'&&skill.target==='aoe'?living:[chosen];
      for(const {e,i} of targets){
        const power=(mode==='burst'?1+skill.bonus/100:1)*(b.attackBuff?1.5:1);
        const damage=hit(b,actor,e,power,false,spark);b.damage+=damage.actual;
        const hits=mode==='burst'?skill.hits:info.hits;b.maxCombo=Math.max(b.maxCombo,hits);
        events.push({type:'hit',actor:index,target:i,mode,hits,...damage});
      }
      if(mode==='attack')actor.bb=Math.min(actor.bbCost,actor.bb+4);
      if(random(b)<.22){const heal=Math.round(actor.rec*.35);actor.hp=Math.min(actor.maxHp,actor.hp+heal);events.push({type:'heal',actor:index,value:heal});}
    }
  }
  determine(b);return events;
}
export function enemyTurn(b){
  if(b.phase!=='enemyPending')throw Error('적의 차례가 아닙니다.');
  const events=[];
  for(let i=0;i<b.enemies.length;i++){
    const enemy=b.enemies[i];if(enemy.hp<=0)continue;
    const live=b.party.map((p,j)=>({p,j})).filter(x=>x.p.hp>0);if(!live.length)break;
    const {p,j}=live[Math.floor(random(b)*live.length)];
    const burst=enemy.boss&&b.turn%3===0;
    const damage=hit(b,enemy,p,(burst?1.6:1)*(b.defenseBuff ? .7 : 1),p.guard);
    p.bb=Math.min(p.bbCost,p.bb+2);events.push({type:'enemy-hit',enemy:i,actor:j,burst,...damage});
  }
  if(b.party.every(p=>p.hp<=0)){b.phase='defeat';return events;}
  b.turn++;b.attackBuff=Math.max(0,b.attackBuff-1);b.defenseBuff=Math.max(0,b.defenseBuff-1);
  b.party.forEach(p=>{p.acted=false;p.guard=false;});b.phase='player';b.turnActions=0;return events;
}
export function nextWave(b,catalog){
  if(b.phase!=='waveclear')throw Error('전투가 끝나지 않았습니다.');
  const q=QUESTS.find(q=>q.id===b.questId);
  if(b.wave+1>=q.waves.length){b.phase='victory';return false;}
  b.wave++;b.turn=1;b.party.forEach(p=>{if(p.hp>0)p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.15));p.acted=false;p.guard=false;});
  b.enemies=enemiesFor(b,catalog);b.phase='player';return true;
}
export function usePotion(b,index){
  if(b.phase!=='player'||b.itemsUsed>=3)throw Error('회복약을 사용할 수 없습니다.');
  const p=b.party[index];if(!p||p.hp<=0||p.hp>=p.maxHp)throw Error('체력이 줄어든 생존 유닛을 선택해 주세요.');
  const heal=Math.min(p.maxHp-p.hp,Math.round(p.maxHp*.5));p.hp+=heal;b.itemsUsed++;return heal;
}
export function claimVictory(save,b,catalog){
  if(b.phase!=='victory'||b.claimed)throw Error('이미 받았거나 받을 수 없는 보상입니다.');
  b.claimed=true;const q=QUESTS.find(q=>q.id===b.questId),i=QUESTS.indexOf(q),first=!save.clears[q.id];
  const reward={zel:350+i*140+(q.id==='training-jewel'?1500:0),karma:180+i*60+(q.id==='training-metal'?650:0),gems:first?3:0,xp:70+i*40,unit:first?q.rewardUnit:null,first,stars:b.party.every(p=>p.hp>0)?3:b.party.some(p=>p.hp>0)?2:1};
  save.zel+=reward.zel;save.karma+=reward.karma;save.gems+=reward.gems;save.battles++;
  const old=save.clears[q.id];save.clears[q.id]={count:(old?.count||0)+1,stars:Math.max(old?.stars||0,reward.stars)};
  for(const id of save.party){const u=save.units[id];u.xp+=reward.xp;while(u.level<20&&u.xp>=u.level*80){u.xp-=u.level*80;u.level++;}}
  if(reward.unit&&!save.units[reward.unit])save.units[reward.unit]={id:reward.unit,level:1,xp:0};
  else if(reward.unit){save.karma+=120;reward.duplicate=true;}
  return reward;
}
export function summon(save,kind,catalog,roll=Math.random()){
  if(!['regular','hero'].includes(kind))throw Error('알 수 없는 소환입니다.');
  const heroes=['10011','20011','30011','40011'];
  let pool;
  if(kind==='hero'){if(save.gems<3)throw Error('보석이 부족합니다.');save.gems-=3;pool=heroes.filter(id=>!save.units[id]);if(!pool.length)pool=heroes;}
  else{if(save.zel<350)throw Error('젤이 부족합니다.');save.zel-=350;pool=Object.keys(catalog).filter(id=>!heroes.includes(id));}
  const id=pool[Math.min(pool.length-1,Math.floor(Math.max(0,roll)*pool.length))],duplicate=!!save.units[id];
  if(duplicate)save.karma+=kind==='hero'?500:200;else save.units[id]={id,level:1,xp:0};
  save.summons++;return {id,duplicate,karma:duplicate?(kind==='hero'?500:200):0};
}
