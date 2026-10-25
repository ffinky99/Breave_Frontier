import {SAVE_KEY,ELEMENTS,QUESTS,makeCatalog,newSave,validateSave,stats,growthCost,grow,setParty,isUnlocked,createBattle,act,queueAction,queueEnemyTurn,advanceCombat,attackFrames,enemyTurn,nextWave,usePotion,claimVictory,summon} from './engine.js';
import {SpritePlayer} from './sprites.js';
import {NativeUI} from './ui.js';
import {SamPlayer} from './sam.js';
import {TUTORIALS,TutorialSession} from './tutorial.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Math.round(value).toLocaleString('ko-KR');
const ko=text=>String(text||'').replace(/<br\s*\/?>/gi,' ').replace(/\bHP\b/g,'체력').replace(/\bATK\b/g,'공격력').replace(/\bDEF\b/g,'방어력').replace(/\bREC\b/g,'회복력').replace(/\bBB\b/g,'필살기').replace(/\bBC\b/g,'결정');
const view=$('#view'),modal=$('#modal');
let nativeUI,samPlayer,summonSequence=null,homeSlide=0,unitDetailId=null,detailReturn='units',summonKind='hero',partyReturn='units',lastRenderedScreen=null,transitionToken=0;
const ui=(name,cls='')=>`<canvas data-ui="${name}" class="${cls}" aria-hidden="true"></canvas>`;
let catalog,unitData,sprites,save=null,screen='title',selectedStarter='10011',filter='all',showAllUnits=false,partyDraft=[],detailId=null;
let toastTimer,modalUnit=null,battle=null,battleMode='attack',target=0,auto=false,battleTimer=null,allTimers=[],locked=false,logs=[],battleResult=null;
let tutorial=null,commandIndex=null,holdTimer=null,suppressCommandClickUntil=0;
let prologueIndex=0,prologueName='소환사';
const prologueLines=['나는 루시어스…\n이 게이트를 관장하는 신이다…','나는 네가 이곳에 도착할 날을\n기다려 왔다…','선택받은 자여…\n너의 이름은 무엇인가?','{name}…\n이 문 너머에서\n새로운 힘이 너를 기다리고 있다…','그 힘을 네 것으로 만들어라…\n그리고 그 힘으로\n이 세계에 평화를 가져오너라…'];
const animations=new Map(),particles=[],pickups=[],hitFlashes=new Map(),defeats=new Map();
let effectsUntil=0,lastAttackAt=-10000,lastActor=-1,lastFrame=0,announcement='',battleBackgroundStarted=0;
const images=new Map();
const allyPositions=[[520,260],[554,368],[427,306],[424,218],[455,390],[573,313]];
const enemyPositions=[[125,265],[76,348],[216,345]];
const audio={music:null,musicKey:null,
 async musicFor(key){if(!save?.sound)return;if(this.musicKey===key&&this.music)return;this.music?.pause();this.music=new Audio(`assets/${key}`);this.music.loop=true;this.music.volume=save.volume*.45;this.musicKey=key;try{await this.music.play();}catch{this.musicKey=null;}},
 effect(name='bf300_se_action.mp3'){if(!save?.sound)return;const sound=new Audio(`assets/${name}`);sound.volume=save.volume;void sound.play().catch(()=>{});},
 stop(){this.music?.pause();this.music=null;this.musicKey=null;}
};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function persist(){if(!save)return;save.updatedAt=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{toast('자동 저장 공간이 부족해요. 설정에서 저장 파일을 내려받아 주세요.');}}
function elBadge(id){const d=catalog[id],el=ELEMENTS[d.element];return `<span class="element" style="--element:${el.color}">${el.name}</span>`;}
function unitImage(id,kind='thum'){return `assets/unit_ills_${kind}_${id}.png`;}
function closeModal(){modal.close();modalUnit=null;detailId=null;}
function openModal(title,body,{wide=false}={}){modalUnit=null;modal.innerHTML=`<div class="modal-top"><h2>${esc(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div>${body}`;if(!modal.open)modal.showModal();}
function header(){
  $('#header').hidden=!save||['title','prologue','starter','battle','summon-animation'].includes(screen);
  if(!save)return;
  const rank=1+Math.floor(save.battles/3);
  $('#header').innerHTML=`<div class="native-user">${esc(save.name)}</div><div class="native-rank">소환사</div><div class="native-level">레벨 <b>${rank}</b> <small>동료 ${Object.keys(save.units).length}</small></div><div class="native-exp"><span>경험</span><i style="width:${save.battles%3/3*65}%"></i></div><div class="native-energy"><span>기력</span><b>제한 없음</b></div><div class="native-recovery">모험 ${save.battles}회 완료</div><div class="native-money gems"><b>${fmt(save.gems)}</b></div><div class="native-money zel"><b>${fmt(save.zel)}</b></div><div class="native-money karma"><b>${fmt(save.karma)}</b></div><div class="native-arena">모험</div>`;
}
const footerItems=[['home','home','홈'],['units','unit','유닛'],['village','village','마을'],['shop','shop','상점'],['summon','Summon','소환'],['friends','friend','친구']];
function nav(){
  const hidden=!save||['title','prologue','starter','battle','result','summon-animation'].includes(screen);$('#nav').hidden=hidden;
  if(!hidden)$('#nav').innerHTML=`${ui('button_base.png','footer-texture')}${footerItems.map(([id,asset,label])=>`<button data-action="navigate" data-screen="${id}" ${screen===id?'aria-current="page"':''} aria-label="${label}">${ui(`btn_${asset}_${screen===id?'02':'01'}.png`)}<span>${label}</span></button>`).join('')}`;
}
function navigate(next){if(battle&&next!=='battle')stopBattle();screen=next;closeModal();render();window.scrollTo({top:0,behavior:'instant'});if(save?.sound)void audio.musicFor(next==='summon'?'bf009_village.mp3':'bf009_village.mp3');}
function render(){const previous=lastRenderedScreen;const leaving=previous!==screen&&['party','unit-detail'].includes(previous)?view.cloneNode(true):null;if(leaving){const originals=view.querySelectorAll('canvas');leaving.querySelectorAll('canvas').forEach((c,i)=>{c.getContext('2d').drawImage(originals[i],0,0);c.removeAttribute('data-unit');c.removeAttribute('data-sam');});}document.body.dataset.screen=screen;document.body.dataset.tutorial=!!tutorial;header();nav();view.style.paddingBottom=['title','prologue','starter','battle','result','summon-animation'].includes(screen)?'0':'';const renders={title:renderTitle,prologue:renderPrologue,starter:renderStarter,home:renderHome,quests:renderQuests,units:renderUnits,summon:renderSummon,settings:renderSettings,battle:renderBattle,result:renderResult,village:renderVillage,shop:renderShop,friends:renderFriends,tutorials:renderTutorialHub,'unit-detail':renderUnitDetail,'summon-animation':renderSummonAnimation,party:renderPartyEditor};renders[screen]();if(previous&&previous!==screen&&(['party','unit-detail'].includes(previous)||['party','unit-detail'].includes(screen)))slideWorkLayer(leaving);lastRenderedScreen=screen;}
function slideWorkLayer(leaving){
 document.querySelectorAll('.screen-transition-ghost').forEach(e=>e.remove());view.getAnimations().forEach(a=>a.cancel());const token=++transitionToken;
 if(matchMedia('(prefers-reduced-motion:reduce)').matches){view.inert=false;return;}
 let delay=0;if(leaving){delay=160;leaving.removeAttribute('id');leaving.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));leaving.className='screen-transition-ghost';leaving.setAttribute('aria-hidden','true');leaving.inert=true;leaving.style.cssText=`position:absolute;top:${view.offsetTop}px;left:0;width:100%;z-index:7;pointer-events:none`;$('#shell').appendChild(leaving);leaving.animate([{transform:'translateX(0)'},{transform:'translateX(-100%)'}],{duration:160,easing:'linear'}).finished.catch(()=>{}).finally(()=>leaving.remove());}
 const frames=Array.from({length:17},(_,i)=>({offset:i/16,transform:`translateX(${(1-Math.pow(i/16,1/3.5))*100}%)`}));view.inert=true;view.animate(frames,{duration:160,delay,fill:'backwards',easing:'linear'}).finished.catch(()=>{}).finally(()=>{if(token===transitionToken)view.inert=false;});
}
function renderTitle(){view.innerHTML=`<section class="title-screen"><div class="title-actions"><button data-action="${save?'continue':'begin'}">${save?'모험 이어하기':'화면을 눌러 시작'}</button><span>한국어 웹판</span><button class="text-btn" data-action="about">웹판 정보</button></div></section>`;}
function renderPrologue(){
 view.innerHTML=`<section class="prologue-screen"><div class="prologue-light" aria-hidden="true">${Array.from({length:5},(_,i)=>`<img src="assets/page_1200_3.png" alt="" style="--i:${i}">`).join('')}</div><div class="prologue-words"><p>${esc(prologueLines[prologueIndex].replace('{name}',prologueName)).replaceAll('\n','<br>')}</p>${prologueIndex===2?`<label for="prologue-name">소환사 이름</label><input id="prologue-name" value="${esc(prologueName)}" maxlength="12" autocomplete="off">`:''}<button data-action="prologue-next">${prologueIndex===2?'이 이름으로 시작':'화면을 눌러 계속'} ▼</button></div></section>`;
}
function renderStarter(){view.innerHTML=`<div class="screen-top"><span class="eyebrow">첫 번째 동료</span><h2 style="margin-top:12px">당신과 함께할 영웅은?</h2><p>네 영웅 중 한 명을 선택하세요.<br>다른 영웅들도 모험 중 소환으로 만날 수 있어요.</p></div><div class="starter-grid">${unitData.starterIds.map(id=>{const u=catalog[id];return `<button class="starter ${selectedStarter===id?'selected':''}" data-action="starter" data-id="${id}" aria-pressed="${selectedStarter===id}" style="--tint:${ELEMENTS[u.element].color}40">${elBadge(id)}<img src="${unitImage(id,'full')}" alt="${esc(u.name)}"><strong>${esc(u.name)}</strong><small>${esc(ko(u.leader.desc))}</small></button>`;}).join('')}</div><form class="starter-form" id="starter-form"><label for="summoner-name">소환사 이름</label><input id="summoner-name" name="name" value="${esc(prologueName)}" maxlength="12" autocomplete="off" aria-label="소환사 이름"><button class="gold-button" type="submit">${esc(catalog[selectedStarter].name)}와 모험 시작</button><p class="subtle" style="text-align:center">게임 진행은 이 브라우저에 자동으로 저장됩니다.</p></form>`;}
const homePortals=[['home_win_quest.png','퀘스트'],['home_win_gate.png','차원의 틈'],['home_win_arena.png','아레나'],['home_win_raid_open.png','레이드']];
function renderHome(){
 const slots=[save.party[1],save.party[2],save.party[0],save.party[3],save.party[4]];
 const [art,label]=homePortals[homeSlide];
 view.innerHTML=`<section class="native-home"><div class="native-party">${slots.map((id,i)=>`<button class="native-home-unit" data-action="${id?'unit-detail':'party'}" ${id?`data-id="${id}" aria-label="${esc(catalog[id].name)} 상세"`:'aria-label="빈 편성 칸"'} style="--aura:${id?ELEMENTS[catalog[id].element].color:'#222'}">${id?`<canvas class="native-home-art" data-home-art="${id}" width="128" height="350" role="img" aria-label="${esc(catalog[id].name)}"></canvas>${i===2?'<strong class="native-leader">리더</strong>':''}<span class="native-unit-level">레벨 ${save.units[id].level}</span>${ui('element-'+catalog[id].element,'native-home-element')}`:'<span class="native-empty">편성</span>'}</button>`).join('')}<img class="native-character-frame" src="assets/character_frame.png" alt=""></div><div class="native-home-lower"><div class="home-utility">${[['home_new_btn_menu1.png','메뉴','settings'],['home_new_btn_mission1.png','모험','quests'],['home_new_btn_journal1.png','편성','party'],['home_new_btn_info1.png','안내','guide'],['home_new_btn_box1.png','기록','settings']].map(([img,name,to])=>`<button data-action="${['party','guide'].includes(to)?to:'navigate'}" ${['party','guide'].includes(to)?'':`data-screen="${to}"`}><img src="assets/${img}" alt=""><span>${name}</span></button>`).join('')}</div><div class="portal-carousel"><button class="portal-arrow previous" data-action="home-slide" data-direction="-1" aria-label="이전 콘텐츠">◀</button><button class="home-portal" data-action="home-portal" aria-label="${label}"><img src="assets/${art}" alt=""><span>${label}</span></button><button class="portal-arrow next" data-action="home-slide" data-direction="1" aria-label="다음 콘텐츠">▶</button></div><div class="portal-dots">${homePortals.map((_,i)=>`<span class="${i===homeSlide?'selected':''}"></span>`).join('')}</div></div><div class="native-ticker">${ui('ticker_base.png')}<span>도전할 모험을 선택해 주세요.</span></div></section>`;
}
function renderVillage(){view.innerHTML=`<section class="native-village"><h2>소환사의 마을</h2>${[['유닛 강화','units',22,36],['부대 편성','party',63,47],['소환소','summon',26,59],['모험','quests',67,67],['음악 · 저장','settings',27,80]].map(([label,to,x,y])=>`<button class="village-pin" style="left:${x}%;top:${y}%" data-action="${to==='party'?'party':'navigate'}" ${to==='party'?'':`data-screen="${to}"`}>${label}</button>`).join('')}</section><div class="native-ticker">${ui('ticker_base.png')}<span>마을의 시설을 선택해 주세요.</span></div>`;}
function renderShop(){view.innerHTML=`<div class="screen-top"><h2>상점</h2><p>모험에서 얻은 재화로 동료를 성장시키세요.</p></div><div class="native-menu-list"><button data-action="navigate" data-screen="summon"><strong>인연의 소환</strong><small>젤 350 · 새로운 동료와의 만남</small></button><button data-action="navigate" data-screen="units"><strong>유닛 강화</strong><small>젤과 카르마로 능력치 성장</small></button><button data-action="navigate" data-screen="summon"><strong>영웅의 소환</strong><small>보석 5개 · 네 영웅의 부름</small></button></div><p class="disclosure" style="text-align:center">보석은 모험의 첫 완료 보상으로 얻습니다.</p>`;}
function renderFriends(){view.innerHTML=`<div class="screen-top"><h2>친구</h2><p>소환사와 함께하는 동료들</p></div><div class="native-menu-list"><button data-action="party"><strong>내 부대 편성</strong><small>보유 동료 ${Object.keys(save.units).length}명 · 편성 ${save.party.length}명</small></button><button data-action="navigate" data-screen="settings"><strong>모험 기록 관리</strong><small>저장 파일을 내려받거나 불러올 수 있어요.</small></button></div><p class="disclosure" style="text-align:center;padding:20px">다른 소환사와 연결하는 친구 기능은<br>현재 웹판에 포함되어 있지 않습니다.</p>`;}
function renderQuests(){view.innerHTML=`<div class="map-banner"><div><p>그랑가이아 · 웹판 탐험</p><h2>시작의 초원</h2></div></div><div class="quest-list">${QUESTS.map((q,i)=>{const open=isUnlocked(q,save),clear=save.clears[q.id];return `${i===6?'<p class="quest-tag">✧ 특별 탐험</p>':''}<button class="quest ${open&&!clear?'current':''} ${!open?'locked':''}" data-action="quest-info" data-id="${q.id}" ${!open?'disabled':''}><span class="step"><span>${open?(q.extra?'✧':i+1):'·'}</span></span><div class="quest-info"><h3>${q.name}</h3><p>${q.subtitle} · 권장 레벨 ${q.recommend}</p></div><div class="quest-end">${clear?`<span class="stars">${'★'.repeat(clear.stars)}${'☆'.repeat(3-clear.stars)}</span><br>완료 ${clear.count}회`:open?'전투 3회<br>도전하기 ›':'이전 모험<br>완료 필요'}</div></button>`;}).join('')}</div>`;}
function questInfo(id){const q=QUESTS.find(q=>q.id===id);if(!q||!isUnlocked(q,save))return;const i=QUESTS.indexOf(q);openModal(q.name,`<div class="modal-body"><p>${q.subtitle}<br>연속 전투를 모두 마치면 보상을 받을 수 있어요.</p><div class="stat-grid"><div><small>전투</small><b>${q.waves.length}회</b></div><div><small>권장 레벨</small><b>${q.recommend}</b></div><div><small>부대</small><b>${save.party.length}명</b></div><div><small>회복약</small><b>3개</b></div></div><div class="section-label">마지막 전투의 적</div><div class="squad-strip" style="grid-template-columns:repeat(3,1fr)">${q.waves.at(-1).map(id=>`<div class="squad-slot"><img src="${unitImage(id)}" alt="${esc(catalog[id].name)}"></div>`).join('')}</div><p style="margin-top:15px">첫 완료 보상: 보석 3개와 ${esc(catalog[q.rewardUnit].name)}<br>기본 보상: 젤 ${fmt(350+i*140+(q.id==='training-jewel'?1500:0))} · 카르마 ${fmt(180+i*60+(q.id==='training-metal'?650:0))}</p><button class="gold-button" data-action="start-quest" data-id="${q.id}">모험 출발</button><button class="text-btn" style="width:100%;margin-top:9px" data-action="party">출발 전 편성 변경</button></div>`);}
function renderUnits(){const ids=Object.keys(catalog).filter(id=>(showAllUnits||save.units[id])&&(filter==='all'||catalog[id].element===filter));view.innerHTML=`<div class="screen-top"><h2>소환된 동료들</h2><p>함께 성장하고, 서로의 빈틈을 채워 주세요.</p></div><div class="unit-toolbar"><span>보유 ${Object.keys(save.units).length} / ${Object.keys(catalog).length}</span><button data-action="party">부대 편성</button><button data-action="toggle-codex">${showAllUnits?'보유 유닛만':'전체 도감'}</button></div><div class="filters">${[['all','전체'],...Object.entries(ELEMENTS).map(([k,v])=>[k,v.name])].map(([key,name])=>`<button class="chip ${filter===key?'active':''}" data-action="filter" data-filter="${key}">${name}</button>`).join('')}</div><div class="unit-grid">${ids.map(id=>{const u=catalog[id],owned=save.units[id];return `<button class="unit-card ${owned?'':'unowned'}" data-action="unit-detail" data-id="${id}">${save.party.includes(id)?'<span class="in-party">편성 중</span>':''}<span class="count">${'★'.repeat(u.rarity)}</span><img src="${unitImage(id)}" alt=""><strong>${esc(u.name)}</strong><small>${owned?'레벨 '+owned.level:'미보유'} · ${ELEMENTS[u.element].name}</small></button>`;}).join('')}</div>${ids.length?'':'<div class="empty">이 속성의 동료를 아직 만나지 못했어요.</div>'}`;}
function unitDetail(id){if(!catalog[id])return;if(screen!=='unit-detail')detailReturn=screen;closeModal();unitDetailId=id;screen='unit-detail';render();window.scrollTo({top:0,behavior:'instant'});}
function renderUnitDetail(){
 const id=unitDetailId,u=catalog[id],owned=save.units[id],s=stats(owned||{id,level:1},catalog),cost=owned?growthCost(owned):null;
 const row=(label,value,y,extra='')=>`<div class="native-stat-row" style="top:${(y-173)/6.4}cqw"><span>${label}</span><b>${value}</b>${extra}</div>`;
 view.innerHTML=`<section class="native-unit-detail"><div class="detail-title"><button data-action="detail-back" aria-label="이전 화면">‹</button>${elBadge(id)}<strong>${esc(u.name)}</strong><small>${'★'.repeat(u.rarity)}</small></div>
 ${row('타입','로드',260)}${row('레벨',`${owned?.level||1} / 20`,311)}${row('다음 레벨',owned?fmt(Math.max(0,owned.level*80-owned.xp)):'—',362,`<i><em style="width:${owned?owned.xp/(owned.level*80)*100:0}%"></em></i>`)}
 ${[['hp','체력',454],['atk','공격력',505],['def','방어력',556],['rec','회복력',607]].map(([k,label,y])=>row(label,fmt(s[k]),y)).join('')}
 ${row('스피어','장착 없음',665)}${row('스피어','장착 없음',720)}<div class="detail-cost">코스트 ${u.cost}</div>
 <button class="detail-unit-motion" data-action="unit-preview-motion" aria-label="${esc(u.name)} 공격 모션 보기"><canvas data-unit="${id}" width="430" height="400" aria-label="${esc(u.name)} 원본 모션"></canvas></button><span class="detail-unit-no">유닛 ${id}</span>
 <div class="detail-skills"><div><b>리더 스킬</b><strong>${esc(u.leader.name||'없음')}</strong><p>${esc(ko(u.leader.desc||'리더 스킬이 없습니다.'))}</p></div><div><b>필살기</b><strong>${esc(u.skill.name)}</strong><p>${esc(ko(u.skill.description))}</p></div></div>
 <div class="detail-actions">${owned?`<button class="gold-button" data-action="grow" data-id="${id}" ${owned.level>=20?'disabled':''}>${owned.level>=20?'최대 레벨':'강화 · 레벨 '+(owned.level+1)}</button>${owned.level<20?`<p>젤 ${fmt(cost.zel)} · 카르마 ${fmt(cost.karma)}</p>`:''}<button class="gold-button secondary" data-action="party">부대 편성</button>`:'<p>아직 만나지 못한 동료입니다.</p>'}<button class="text-btn" data-action="detail-back">이전 화면으로</button></div></section>`;
}
function partyEditor(){partyDraft=save.party.slice(0,5);partyReturn=screen;closeModal();screen='party';render();window.scrollTo({top:0,behavior:'instant'});}
function renderPartyEditor(){view.innerHTML=`<section class="native-party-editor"><div class="screen-top"><h2>부대 편성</h2></div>`+`<div class="modal-body"><p style="margin-bottom:15px">첫 번째 동료가 리더입니다. 최대 다섯 명을 선택해 주세요.<br>선택한 동료를 다시 누르면 부대에서 빠집니다.</p><div class="party-lineup">${Array.from({length:5},(_,i)=>{const id=partyDraft[i];return `<div>${id?`<img src="${unitImage(id)}" alt="${esc(catalog[id].name)}">`:'<span>빈 칸</span>'}<small>${i===0?'리더':i+1}</small></div>`;}).join('')}</div><div class="party-editor">${Object.keys(save.units).map(id=>`<button class="unit-card ${partyDraft.includes(id)?'picked':''}" data-action="party-pick" data-id="${id}" aria-pressed="${partyDraft.includes(id)}">${partyDraft.includes(id)?`<span class="party-order">${partyDraft.indexOf(id)+1}</span>`:''}<img src="${unitImage(id)}" alt=""><strong>${esc(catalog[id].name)}</strong><small>레벨 ${save.units[id].level}</small></button>`).join('')}</div><button class="gold-button" data-action="party-save" ${partyDraft.length?'':'disabled'}>${partyDraft.length}명으로 편성 완료</button></div>`+`<button class="text-btn" data-action="party-cancel">편성 취소</button></section>`;}
function renderSummon(){
 const hero=summonKind==='hero',label=hero?'영웅 소환':'인연 소환';
 view.innerHTML=`<section class="native-summon"><div class="screen-top"><h2>소환</h2></div><div class="summon-carousel"><button class="summon-arrow previous" data-action="summon-switch" aria-label="이전 소환">‹</button><div class="summon-original-art"><img src="assets/${hero?'gacha_rare_bg_img.png':'gacha_normal_bg_img.png'}" alt="${label}의 문"><strong>${label}</strong></div><button class="summon-arrow next" data-action="summon-switch" aria-label="다음 소환">›</button><button class="native-summon-button ${hero?'hero':''}" data-action="summon" data-kind="${summonKind}" ${(hero?save.gems<5:save.zel<350)?'disabled':''}><span>${label}</span><small>${hero?'보석 5개':'젤 350'}</small></button></div><div class="summon-page-dots" aria-label="${hero?'첫 번째':'두 번째'} 소환">${hero?'● ○':'○ ●'}</div><div class="native-summon-description"><h3>${label}</h3><p>${hero?'불 · 물 · 숲 · 번개, 네 영웅 중 한 명을 만납니다. 모두 모으기 전까지 새로운 영웅이 등장합니다.':'초원의 동료와 성장 재료 유닛을 만납니다. 중복 동료는 카르마 200으로 바뀝니다.'}</p><p class="subtle">보유 ${hero?'보석 '+fmt(save.gems)+'개':'젤 '+fmt(save.zel)}</p></div></section>`;
}
function doSummon(kind){
 if(summonSequence)return;const result=summon(save,kind,catalog);persist();summonSequence={result,phase:'gate',start:performance.now()};screen='summon-animation';render();audio.effect('bf233_se_skill_action.mp3');
}
function renderSummonAnimation(){view.innerHTML=`<section class="summon-animation-screen"><canvas id="summon-animation-canvas" width="640" height="960" aria-label="원본 소환 게이트 애니메이션"></canvas><button data-action="summon-open" ${summonSequence.phase==='open'?'disabled':''}>${summonSequence.phase==='gate'?'게이트를 눌러 동료를 만나세요':'소환의 문이 열리고 있어요…'}</button></section>`;}
function finishSummon(){const result=summonSequence.result;summonSequence=null;screen='summon';render();audio.effect('bf114_zin_unit_get1.mp3');const u=catalog[result.id];openModal(result.duplicate?'다시 만난 인연':'새로운 동료',`<div class="summon-result"><canvas class="summon-reveal-circle" data-sam="GachaEndCircleGet" width="640" height="640" aria-hidden="true"></canvas><div class="stars">${'★'.repeat(u.rarity)}</div>${u.hasIllustration?`<img src="${unitImage(u.id,'full')}" alt="${esc(u.name)}">`:`<canvas data-unit="${u.id}" width="440" height="250" style="width:100%;height:210px" aria-label="${esc(u.name)}"></canvas>`}<h2>${esc(u.name)}</h2><p>${result.duplicate?`이미 함께하는 동료예요.<br>카르마 ${fmt(result.karma)}을 받았습니다.`:'새로운 인연이 부대에 합류했어요.<br>편성에서 동료를 선택해 보세요.'}</p><button class="gold-button" style="width:100%;margin-top:22px" data-action="close-modal">확인</button></div>`);}
function drawSummon(now){
 const canvas=$('#summon-animation-canvas');if(!canvas||!summonSequence)return;const ctx=canvas.getContext('2d'),t=now-summonSequence.start;ctx.clearRect(0,0,640,960);
 samPlayer.draw(ctx,'GachaEndCircleGet',{time:t,x:0,y:170});
 if(summonSequence.phase==='gate'){const duration=samPlayer.duration('GachaGateClose3');samPlayer.draw(ctx,'GachaGateClose3',{time:t<duration?t:t-duration,label:t<duration?'start':'loop',loop:t>=duration,x:0,y:150});}
 else{samPlayer.draw(ctx,'GachaGateOpen3',{time:t,label:'start',loop:false,x:0,y:150});samPlayer.draw(ctx,'GachaGateOpenAdd',{time:t,label:'start',loop:false,x:0,y:150,additive:true});if(t>=samPlayer.duration('GachaGateOpenAdd'))finishSummon();}
}
function renderSettings(){view.innerHTML=`<div class="screen-top"><h2>소환사의 설정</h2><p>나에게 맞는 속도로 모험을 이어가세요.</p></div><section class="settings-group"><h3>소리와 전투</h3><div class="setting-row"><span>배경 음악 · 효과음</span><button data-action="sound">${save.sound?'켜짐':'꺼짐'}</button></div><div class="setting-row"><label for="volume">소리 크기</label><input id="volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></div><div class="setting-row"><span>기본 전투 속도</span><button data-action="speed">${save.speed}배속</button></div></section><section class="settings-group"><h3>모험 기록</h3><div class="setting-links"><button data-action="export-save">↓ 저장 파일 내려받기</button><button data-action="import-prompt">↑ 저장 파일 불러오기</button><button data-action="guide">티리스의 전투 훈련</button><button data-action="help">조작 방법 알아보기</button><button data-action="about">웹판 정보와 원본 출처</button><button class="danger" data-action="reset-prompt">새 모험 시작하기</button></div><input id="save-file" type="file" accept="application/json,.json" hidden><p class="subtle" style="margin-top:15px">다른 기기에서는 저장 파일을 불러와 이어갈 수 있어요. 일반 모험은 새로고침하면 도전이 취소됩니다. 훈련은 현재 전투의 처음부터 이어집니다.</p></section><div class="settings-version">한국어 웹판 · 판번호 0.3.0</div>`;}
function about(){openModal('이 웹판에 대하여',`<div class="modal-body"><p>업로드된 브레이브 프론티어 게임 파일의 캐릭터 이미지, 모션, 배경, 음악을 이용한 한국어 웹 재구현입니다.</p><div class="skill-box"><strong>원본에서 가져온 것</strong><p>캐릭터 그래픽과 프레임 애니메이션, 배경과 사운드. 유닛 이름·기초 능력치·필살기 설명은 공개된 한국어판 추출 자료와 대조했습니다.</p></div><div class="skill-box"><strong>이 웹판의 규칙</strong><p>일반 공격의 기본 피해·속성·치명타·스파크와 결정 배분은 원본 코드를 대조했습니다. 탐험 경로, 적 배치, 성장 곡선, 보상과 소환 확률은 웹판 규칙입니다. 훈련의 적 능력치는 보존된 2014년 글로벌판 기록을 사용하며, 현재 원본 앱과 같은 버전인지는 확인되지 않았습니다. 원작의 전체 콘텐츠와 온라인 서버는 포함되어 있지 않습니다.</p></div><p class="disclosure">원작 그래픽·음악: 알림·구미<br>한국어 데이터: 블루아크의 공개 추출 자료<br>원본 분석과 변경 내역은 저장소 문서에서 확인할 수 있어요.</p><button class="gold-button" data-action="close-modal">확인</button></div>`);}
function help(){openModal('모험의 길잡이',`<div class="modal-body"><div class="help-steps"><p><b>공격</b><br>적을 눌러 목표를 정하고, 동료의 칸을 누르세요. 한 차례에 동료마다 한 번씩 행동할 수 있어요.</p><p><b>필살기와 방어</b><br>동료 칸을 길게 누른 뒤 오른쪽 위로 밀면 필살기, 아래로 밀면 방어합니다. 아래 행동 버튼으로도 선택할 수 있어요. 필살기에는 결정이 필요합니다.</p><p><b>함께 공격하기</b><br>서로 다른 동료의 타격이 같은 적에게 겹치면 스파크로 피해가 늘어납니다. 일제 공격은 모든 동료가 차례로 공격해요.</p><p><b>속성 상성</b><br>불 → 숲 → 번개 → 물 → 불 순서로 유리합니다. 빛과 어둠은 서로에게 강해요.</p><p><b>회복과 자동 전투</b><br>도전마다 회복약을 세 번 쓸 수 있어요. 자동 전투에서는 준비된 필살기도 사용합니다.</p><p><b>성장과 편성</b><br>모험과 소환으로 동료를 모으세요. 유닛 상세에서 강화할 수 있고, 부대의 첫 동료가 리더가 됩니다.</p></div><button class="gold-button" data-action="close-modal">알겠어요</button></div>`);}
function guide(){navigate('tutorials');}
function exportSave(){const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='브레이브-프론티어-저장.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('저장 파일을 내려받았습니다.');}
function renderTutorialHub(){
 const progress=save.tutorial;
 view.innerHTML=`<section class="tutorial-hub"><div class="screen-top"><h2>티리스의 안내</h2></div><img class="tutorial-hub-portrait" src="assets/navi_chara1_1.png" alt="여신 티리스"><p class="tutorial-hub-intro">${esc(save.name)}, 함께 초원을 건너 볼까?<br>내 안내에 따라 직접 공격하고, 회복약과 필살기도 써 봐!</p>${TUTORIALS.map(q=>`<button class="quest" data-action="tutorial-start" data-chapter="${q.id}" ${q.id===2&&!progress.completed.includes(1)?'disabled':''}><div class="quest-info"><h3>${q.name}</h3><p>${q.summary}</p></div><div class="quest-end">${progress.completed.includes(q.id)?'다시 보기':progress.chapter===q.id&&progress.wave?'이어서 하기':'시작하기'} ›</div></button>`).join('')}<button class="gold-button secondary" data-action="navigate" data-screen="home">마을로 돌아가기</button></section>`;
}
function startTutorial(chapter,resume=true){
 stopBattle();const progress=save.tutorial;
 if(chapter===2&&!progress.completed.includes(1)){toast('전투의 기초부터 배워 봐요.');navigate('tutorials');return;}
 const wave=resume&&progress.chapter===chapter&&!progress.completed.includes(chapter)?progress.wave:0;
 tutorial=new TutorialSession(save,catalog,chapter,wave);battle=tutorial.battle;target=tutorial.target;
 Object.assign(progress,{chapter,wave,active:true});persist();screen='battle';battleMode='attack';logs=[];closeModal();render();
 void audio.musicFor('bf010_map_grass.mp3');window.scrollTo({top:0,behavior:'instant'});
}
function recordTutorial(){
 if(!tutorial)return;const p=save.tutorial,c=tutorial.checkpoint;
 let changed=p.chapter!==c.chapter||p.wave!==c.wave;
 Object.assign(p,c);
 if(tutorial.complete){if(!p.completed.includes(c.chapter)){p.completed.push(c.chapter);save.tutorialSeen=true;}if(p.active){p.active=false;changed=true;audio.effect('bf104_zin_quest_clear_ff.mp3');}}
 if(changed)persist();
}
function tutorialResult(result){
 if(!tutorial||!result.accepted)return;
 target=tutorial.target;battle=tutorial.battle;locked=tutorial.waiting;
 if(result.events.length){effectsUntil=performance.now();animateEvents(result.events);}
 recordTutorial();renderBattle();
 if(tutorial.waiting){clearTimeout(battleTimer);battleTimer=later(()=>{if(tutorial)tutorialResult(tutorial.settle());},Math.max(550,effectsUntil-performance.now()+150));}
}
function tutorialAction(type,index){
 if(!tutorial||modal.open)return;
 try{tutorialResult(tutorial.perform(type,index));}catch(e){toast(e.message);}
}
function tutorialPause(){openModal('훈련을 잠시 멈출까요?',`<div class="modal-body"><p>완료한 전투까지 저장돼요.<br>다시 시작하면 현재 전투의 처음부터 이어집니다.</p><button class="gold-button" data-action="tutorial-resume">계속하기</button><button class="gold-button secondary" data-action="tutorial-exit">훈련 목록으로</button></div>`);}
function focusSelector(focus){
 if(focus==='enemy-current')return `[data-action="target"][data-index="${tutorial.target}"]`;
 if(focus?.startsWith('unit-'))return `[data-action="battle-unit"][data-index="${focus.slice(5)}"]`;
 if(focus?.startsWith('enemy-')&&focus!=='enemy-life')return `[data-action="target"][data-index="${focus.slice(6)}"]`;
 if(focus?.startsWith('hp-'))return `[data-action="battle-unit"][data-index="${focus.slice(3)}"] .gauge`;
 if(focus?.startsWith('bb-'))return `[data-action="battle-unit"][data-index="${focus.slice(3)}"] .gauge.bb`;
 return {'enemy-life':'.native-enemy-bar',item:'.potion-slot',chest:'.tutorial-chest',heart:'.tutorial-gem',crystal:'.tutorial-gem',elements:'.battle-party'}[focus];
}
function placeCommand(index){
 const section=$('.battle-screen'),button=section?.querySelector(`[data-action="battle-unit"][data-index="${index}"]`);if(!button)return;
 const p=battle.party[index],r=button.getBoundingClientRect(),root=section.getBoundingClientRect(),guard=!tutorial||tutorial.step.kind==='free',charged=p.bbCost&&p.bb>=p.bbCost;
 const menu=document.createElement('div');menu.className='brave-command native-sam-command '+(charged?'has-burst':'guard-only');menu.style.left=`${r.left-root.left+r.width*.5+(index<3?16*root.width/640:0)}px`;menu.style.top=`${r.top-root.top+r.height*.5}px`;
 menu.innerHTML=`<canvas class="command-motion ${charged?'bb-motion':'guard-motion'}" data-sam="${charged?'BraveBurstSlideMotion':'GuardSlideMotion'}" width="640" height="640" aria-hidden="true"></canvas><canvas class="command-motion ${charged?'bb-motion':'guard-motion'}" data-sam="${charged?'BraveBurstSlideMotionAdd':'GuardSlideMotionAdd'}" data-additive="true" width="640" height="640" aria-hidden="true"></canvas>${charged?`<button class="command-burst" data-action="command-burst" data-index="${index}" aria-label="필살기 ${esc(catalog[p.id].skill.name)}"></button>`:''}${guard?`<button class="command-guard" data-action="command-guard" data-index="${index}" aria-label="방어"></button>`:''}`;section.appendChild(menu);

}
function renderTutorialOverlay(){
 const section=$('.battle-screen');if(!tutorial){if(commandIndex!==null)placeCommand(commandIndex);return;}
 const s=tutorial.step,text=esc(tutorial.text()).replaceAll('\n','<br>');
 for(const btn of section.querySelectorAll('[data-action="battle-unit"]')){
  const i=Number(btn.dataset.index),input=tutorial.selectedItem?'heal':s.input==='hold'?'hold':s.input==='burst'?'burst':'attack';
  btn.disabled=locked||!tutorial.allowed(input,i)||(s.kind==='free'&&!tutorial.selectedItem&&(battle.party[i].acted||battle.party[i].hp<=0));
 }
 for(const btn of section.querySelectorAll('[data-action="target"]'))btn.disabled=locked||!tutorial.allowed('target',Number(btn.dataset.index));
 const potion=section.querySelector('.potion-slot');potion.disabled=locked||!tutorial.allowed('item');potion.classList.toggle('selected',tutorial.selectedItem);
 const menu=section.querySelector('[data-action="battle-menu"]');menu.disabled=s.kind==='story'||s.kind==='complete';menu.textContent='중단';
 if(tutorial.chestVisible)section.querySelector('.battle-arena').insertAdjacentHTML('beforeend',`<button class="tutorial-chest" data-action="tutorial-chest" aria-label="보물상자 열기" ${tutorial.allowed('chest')?'':'disabled'}>${ui(tutorial.chestOpen?'chest-open':'chest-closed')}</button>`);
 if(tutorial.crystal)section.querySelector('.battle-arena').insertAdjacentHTML('beforeend',`<div class="tutorial-gem ${tutorial.crystal}">${ui(tutorial.crystal==='heart'?'heart-crystal':'battle-crystal')}</div>`);
 const overlay=document.createElement('div');overlay.className='tutorial-overlay';section.appendChild(overlay);
 if(s.kind==='complete'){
  overlay.innerHTML=`<div class="tutorial-complete"><img src="assets/navi_chara1_1.png" alt="기뻐하는 티리스"><h2>훈련 완료</h2><p>${text}</p>${tutorial.quest.id===1?'<button class="gold-button" data-action="tutorial-start" data-chapter="2">속성과 필살기 배우기</button>':''}<button class="gold-button secondary" data-action="tutorial-exit">훈련 목록</button><button class="text-btn" data-action="navigate" data-screen="home">마을로 돌아가기</button></div>`;return;
 }
 if(s.kind==='story'){
  overlay.innerHTML=s.wake?`<button class="tutorial-story tutorial-wake" data-action="tutorial-next"><span class="wake-copy">${text}</span><span class="wake-next">화면을 눌러 계속</span></button>`:`<div class="tutorial-story"><img class="tutorial-person" src="assets/navi_chara1_${s.face}.png" alt="티리스"><button class="story-dialog" data-action="tutorial-next"><span class="story-speaker">${esc(s.speaker||'티리스')}</span>${text}<span class="story-next">▼ 계속</span></button></div>`;
  overlay.insertAdjacentHTML('beforeend','<button class="tutorial-exit" data-action="tutorial-pause">중단</button>');return;
 }
 if(s.kind==='free'){
  overlay.innerHTML=`<div class="tutorial-free-tag">${text}</div>`;
  if(battle.phase==='defeat')overlay.innerHTML=`<div class="tutorial-complete"><h2>다시 도전하자!</h2><p>현재 전투부터 다시 배울 수 있어.</p><button class="gold-button" data-action="tutorial-retry">다시 도전</button><button class="text-btn" data-action="tutorial-exit">훈련 목록</button></div>`;
 }else{
  const selector=focusSelector(s.focus),focused=selector&&section.querySelector(selector);
  if(focused){const r=focused.getBoundingClientRect(),root=section.getBoundingClientRect();overlay.innerHTML=`<div class="tutorial-focus" style="left:${r.left-root.left}px;top:${r.top-root.top}px;width:${r.width}px;height:${r.height}px"></div>`;if(s.kind==='action')overlay.insertAdjacentHTML('beforeend',`<div class="tutorial-point native-motion" style="left:${r.left-root.left+r.width*.5}px;top:${r.top-root.top+r.height*.5}px" aria-hidden="true"><canvas data-sam="${s.input==='hold'?'Hold':'Touch'}" width="160" height="170"></canvas></div>`);}
  else overlay.innerHTML='<div class="tutorial-shade"></div>';
  overlay.insertAdjacentHTML('beforeend','<img class="tutorial-coach-portrait" src="assets/thum_navi_chara1_0.png" alt="티리스">');
  overlay.insertAdjacentHTML('beforeend',s.kind==='say'?`<button class="tutorial-coach ${s.rainbow?'rainbow':''}" data-action="tutorial-next" ${locked?'disabled':''}>${text}<small>${locked?'잠시만 기다려 줘':'▼ 눌러서 계속'}</small></button>`:`<div class="tutorial-coach">${text}<small>${locked?'전투 진행 중…':'빛나는 곳을 조작해 줘'}</small></div>`);
  if(s.focus==='diagram')overlay.insertAdjacentHTML('beforeend',`<div class="tutorial-element-chart"><strong>여섯 속성의 관계</strong><div class="element-ring">${['fire','earth','thunder','water','fire'].map((k,i)=>`<div class="element-orb" style="--element:${ELEMENTS[k].color}">${ELEMENTS[k].name}</div>`).join('')}</div><p class="element-chart-note">불 → 숲 → 번개 → 물 → 불</p><div class="element-ring light-dark"><div class="element-orb" style="--element:#f2d572">빛</div><span>↔</span><div class="element-orb" style="--element:#9855ca">어둠</div></div><p class="element-chart-note">유리한 속성으로 더 큰 피해!</p></div>`);
 }
 if(tutorial.commandOpen&&!locked)placeCommand(tutorial.commandIndex??2);
}
function stopBattle(){battleBackgroundStarted=performance.now();clearTimeout(battleTimer);clearTimeout(holdTimer);allTimers.forEach(clearTimeout);allTimers=[];battle=null;tutorial=null;commandIndex=null;animations.clear();particles.length=0;pickups.length=0;hitFlashes.clear();defeats.clear();effectsUntil=0;lastAttackAt=-10000;lastActor=-1;locked=false;auto=false;document.body.dataset.tutorial=false;}
function later(fn,delay){const current=battle;const handle=setTimeout(()=>{if(battle===current&&battle)fn();},delay);allTimers.push(handle);return handle;}
function startQuest(id){stopBattle();battle=createBattle(save,id,catalog,crypto.getRandomValues(new Uint32Array(1))[0]);screen='battle';battleMode='attack';target=0;logs=['동료를 눌러 공격하세요.'];closeModal();render();announce('전투 시작');void audio.musicFor('bf010_map_grass.mp3');window.scrollTo({top:0,behavior:'instant'});}
function battleMenu(){if(tutorial){tutorialPause();return;}openModal('전투 메뉴',`<div class="modal-body native-battle-menu"><p>${QUESTS.find(q=>q.id===battle.questId).name} · 전투 ${battle.wave+1} / 3</p><button class="gold-button" data-action="attack-all">일제 공격</button><button class="gold-button" data-action="mode" data-mode="attack">일반 공격 선택</button><button class="gold-button" data-action="mode" data-mode="burst">필살기 선택</button><button class="gold-button" data-action="mode" data-mode="guard">방어 선택</button><button class="gold-button" data-action="help">조작 방법</button><button class="gold-button secondary" data-action="retreat-prompt">마을로 돌아가기</button></div>`);}
function renderBattle(){
 if(!battle)return;const q=QUESTS.find(q=>q.id===battle.questId),chosen=battle.enemies[target];
 view.innerHTML=`<section class="battle-screen"><div class="battle-arena"><canvas id="battle-canvas" width="640" height="440" aria-label="동료와 적이 싸우는 전장"></canvas><div class="battle-native-rewards"><span>${ui('reward-zel')}<b>${fmt(battle.collected?.zel||0)}</b></span><span>${ui('reward-karma')}<b>${fmt(battle.collected?.karma||0)}</b></span><span>${ui('reward-unit')}<b>${battle.collected?.units||0}</b></span><button data-action="battle-menu">메뉴</button></div><div class="native-turn">전투 ${battle.wave+1} / 3 · ${battle.turn}번째 차례</div><div class="enemy-targets">${battle.enemies.map((e,i)=>e.hp>0?`<button class="enemy-hitbox ${target===i?'selected':''}" style="left:${enemyPositions[i][0]/640*100-9}%;top:${enemyPositions[i][1]/440*100-30}%" data-action="target" data-index="${i}" aria-label="목표: ${esc(catalog[e.id].name)} · 체력 ${e.hp}"></button>`:'').join('')}</div><div class="battle-tools"><button data-action="auto" class="${auto?'on':''}" aria-label="자동 ${auto?'켜짐':'꺼짐'}">자동</button><button data-action="speed">${save.speed}배속</button></div><div class="battle-announcement" id="announcement"></div></div><div class="native-enemy-bar">${ui('enemy-banner')}<b>${chosen?.hp>0?esc(catalog[chosen.id].name):'전투 종료'}</b>${chosen?.hp>0?ui('element-'+chosen.element,'enemy-element'):''}<div class="enemy-life"><span style="width:${chosen?.hp>0?chosen.hp/chosen.maxHp*100:0}%"></span></div></div><div class="battle-party">${[0,3,2,5,1,4].map(i=>{const p=battle.party[i];if(!p)return `<div class="empty-battle">${ui('unit-dim')}<span>빈 자리</span></div>`;const ready=p.bbCost&&p.bb>=p.bbCost;return `<button class="battle-unit ${p.hp<=0?'dead':''} ${ready?'ready':''}" data-action="battle-unit" data-index="${i}" ${locked||p.acted||p.hp<=0||battle.phase!=='player'?'disabled':''} aria-label="${esc(catalog[p.id].name)} ${battleMode==='burst'?'필살기':battleMode==='guard'?'방어':'공격'}"><img src="${unitImage(p.id,'battle')}" alt=""><div class="battle-unit-info"><b>${ui('element-'+p.element)}${esc(catalog[p.id].name)}</b><small>체력 ${fmt(p.hp)}/${fmt(p.maxHp)}</small><div class="gauge"><span style="width:${p.hp/p.maxHp*100}%"></span></div><em>필살기</em><div class="gauge bb"><span style="width:${p.bbCost?p.bb/p.bbCost*100:0}%"></span></div></div>${ui('unit-normal','battle-unit-frame')}${chosen?.hp>0&&({fire:'earth',earth:'thunder',thunder:'water',water:'fire',light:'dark',dark:'light'})[p.element]===chosen.element?'<span class="element-advantage">유리 ↑</span>':''}<span class="unit-action">${p.hp<=0?'전투 불능':p.guard?'방어':p.acted?'행동 완료':ready?'준비 완료':''}</span></button>`;}).join('')}</div><div class="native-items"><div class="item-caption">아이템</div><button class="potion-slot" data-action="potion" ${locked||battle.itemsUsed>=3||battle.phase!=='player'?'disabled':''} aria-label="회복약 ${3-battle.itemsUsed}개"><img src="assets/item_thum_20000.png" alt=""><b>×${3-battle.itemsUsed}</b><span>회복약</span></button>${Array.from({length:4},()=>'<div class="unused-item"><span>빈 칸</span></div>').join('')}</div><div class="battle-message" aria-live="polite">${locked?'전투 진행 중':`${battleMode==='burst'?'필살기':battleMode==='guard'?'방어':'공격'}할 동료를 선택하세요.`}</div><p class="gesture-hint">길게 누르고 ↗ 필살기 · ↓ 방어 · 숫자 키 1~6</p><div class="battle-log">${logs.slice(-2).map(l=>`<div>${esc(l)}</div>`).join('')}</div></section>`;
 renderTutorialOverlay();
}
function announce(text){announcement=text;const el=$('#announcement');if(el){el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}}
function log(text){logs.push(text);if(logs.length>30)logs.shift();}
function pushParticle(text,x,y,color='#ffefbd',delay=0,size=25){particles.push({text,x,y,color,size,start:performance.now()+delay,life:950,bitmap:/^\+?\d+$/.test(text)?(text[0]==='+'?'recover':'damage'):null});}
function animateEvents(events){
 const now=performance.now(),speed=save.speed;
 for(const event of events){
  if(event.type==='action-start'){
    const actor=battle.party[event.actor],pos=enemyPositions[event.target];
    animations.set('p'+event.actor,{start:event.start,duration:event.duration,travel:event.travel,speed:event.speed,action:'atk',target:pos,mode:event.mode,element:actor.element});
    effectsUntil=Math.max(effectsUntil,event.start+event.duration);
    if(event.mode==='burst'){announce(catalog[actor.id].skill.name);audio.effect('bf233_se_skill_action.mp3');}
  }else if(event.type==='enemy-start'){
    const enemy=battle.enemies[event.enemy];animations.set('e'+event.enemy,{start:event.start,duration:event.duration,travel:event.travel,speed:event.speed,target:allyPositions[event.actor],mode:'enemy',element:enemy.element});effectsUntil=Math.max(effectsUntil,event.start+event.duration);if(event.burst)announce('강력한 공격!');
  }else if(event.type==='enemy-impact'){
    const pos=allyPositions[event.actor];pushParticle(String(event.value),pos[0],pos[1]-60,'#ff9c8c',0,25);hitFlashes.set('p'+event.actor,now+120);if(event.guarded&&event.hit===0)pushParticle('방어',pos[0],pos[1]-98,'#b5edff',0,18);log(`${catalog[battle.enemies[event.enemy].id].name} · ${fmt(event.value)} 피해`);audio.effect('bf201_se_slash1.mp3');
  }else if(event.type==='impact'){
    const pos=enemyPositions[event.target],enemy=battle.enemies[event.target];
    pushParticle(String(event.value),pos[0]+(event.hit%2?12:-8),pos[1]-70,'#fff1bf',0,event.critical?30:25);
    hitFlashes.set('e'+event.target,now+120);
    if(event.spark)pushParticle('스파크!',pos[0],pos[1]-112,'#ffe35a',0,19);
    else if(event.critical&&event.hit===0)pushParticle('치명타!',pos[0],pos[1]-112,'#ffb953',0,17);
    else if(event.element>1&&event.hit===0)pushParticle('약점!',pos[0],pos[1]-112,'#ffae8b',0,16);
    if(event.overkill)pushParticle('추가 타격',pos[0],pos[1]-142,'#dabff7',0,14);
    if(enemy.hp<=0&&!defeats.has(event.target))defeats.set(event.target,now);
    audio.effect('bf201_se_slash1.mp3');
    log(`${catalog[battle.party[event.actor].id].name} · ${fmt(event.value)} 피해${event.spark?' · 스파크':''}${event.overkill?' · 추가 타격':''}`);
  }else if(event.type==='hit'){
    const actor=battle.party[event.actor],pos=enemyPositions[event.target];
    const duration=(sprites.duration(actor.id,'atk')+350)/speed;
    animations.set('p'+event.actor,{start:now,duration,action:'atk',target:pos,mode:event.mode,element:actor.element});effectsUntil=Math.max(effectsUntil,now+duration);
    const info=catalog[actor.id],{frames,weights}=attackFrames(info,event.mode);let used=0;for(let h=0;h<frames.length;h++){const value=event.hitValues?.[h]??(h===frames.length-1?event.value-used:Math.floor(event.value*weights[h]/100));used+=value;pushParticle(String(value),pos[0]+(h%2?14:-8),pos[1]-75,'#fff1bf',(166+frames[h]/60*1000)/speed,event.critical?29:24);}
    if(event.spark)pushParticle('스파크!',pos[0],pos[1]-115,'#fff2a2',100/speed,16);
    if(event.mode==='burst'){announce(catalog[actor.id].skill.name);audio.effect(({fire:'bf206_se_fire1.mp3',water:'bf209_se_water1.mp3',earth:'bf212_se_tree1.mp3',thunder:'bf215_se_thunder1.mp3',dark:'bf221_se_dark1.mp3'})[actor.element]||'bf233_se_skill_action.mp3');}else audio.effect('bf201_se_slash1.mp3');
    log(`${catalog[actor.id].name}${event.mode==='burst'?'의 필살기':'의 공격'} · ${fmt(event.value)} 피해${event.spark?' · 스파크':''}`);
  } else if(event.type==='enemy-hit'){
    const enemy=battle.enemies[event.enemy],pos=allyPositions[event.actor],start=now+event.enemy*250/speed,duration=(sprites.duration(enemy.id,'atk')+300)/speed;
    animations.set('e'+event.enemy,{start,duration,action:'atk',target:pos,mode:'enemy',element:enemy.element});effectsUntil=Math.max(effectsUntil,start+duration);pushParticle(String(event.value),pos[0],pos[1]-60,'#ff9c8c',(event.enemy*250+350)/speed);log(`${catalog[enemy.id].name}${event.burst?'의 강타':'의 공격'} · ${fmt(event.value)} 피해`);if(event.burst)announce('강력한 공격!');
  } else if(event.type==='guard'){const pos=allyPositions[event.actor];pushParticle('방어',pos[0],pos[1]-60,'#98ddf6',0,18);effectsUntil=Math.max(effectsUntil,now+400/speed);log(`${catalog[battle.party[event.actor].id].name}가 방어합니다.`);}
  else if(event.type==='heal'){const pos=allyPositions[event.actor];pushParticle('+'+event.value,pos[0],pos[1]-50,'#a2f0ac',500/speed,19);}
  else if(event.type==='crystal'){
    const to=allyPositions[event.actor],from=enemyPositions[event.target??0];pickups.push({kind:event.kind,from:[from[0],from[1]-35],to:[to[0],to[1]-25],start:now,life:800/speed,value:event.value});
    if(tutorial&&event.kind==='heart'&&event.value)pushParticle('+'+event.value,to[0],to[1]-50,'#a2f0ac',800/speed,19);
    audio.effect(event.kind==='heart'?'bf228_se_heart_drop.mp3':'bf227_se_crystal_drop.mp3');effectsUntil=Math.max(effectsUntil,now+850/speed);
  }
  else if(event.type==='crystal-collect'&&!tutorial&&event.kind==='heart'&&event.value){const to=allyPositions[event.actor];pushParticle('+'+event.value,to[0],to[1]-50,'#a2f0ac',0,19);}
  else if(event.type==='chest'){audio.effect('bf244_se_treasure_open.mp3');pushParticle('열었다!',100,240,'#ffeda2',50,20);effectsUntil=Math.max(effectsUntil,now+650/speed);}
  else if(event.type==='buff'){const p=battle.party[event.actor];announce(catalog[p.id].skill.name);for(const pos of allyPositions.slice(0,battle.party.length))pushParticle(event.kind==='attack-buff'?'공격 상승':'방어 상승',pos[0],pos[1]-50,'#c2edb0',0,13);effectsUntil=Math.max(effectsUntil,now+900/speed);audio.effect('bf233_se_skill_action.mp3');log(catalog[p.id].skill.name+' 발동');}
 }
}
function battleAction(index,mode=battleMode){
 if(tutorial){tutorialAction(tutorial.selectedItem?'heal':mode,index);return;}
 if(!battle||locked||battle.enemies.every(e=>e.hp<=0))return;commandIndex=null;
 const now=performance.now();
 try{const events=queueAction(battle,index,mode,target,catalog,{at:now,speed:save.speed,duration:sprites.duration(battle.party[index]?.id,'atk')+330});lastAttackAt=now;lastActor=index;animateEvents(events);if(battle.enemies[target]?.hp<=0)target=Math.max(0,battle.enemies.findIndex(e=>e.hp>0));renderBattle();if(battle.phase!=='player')settle();}catch(error){toast(error.message);}
}
function settle(){
 clearTimeout(battleTimer);if(!battle)return;locked=true;renderBattle();
 battleTimer=later(()=>{
  if(battle.phase==='waveclear'){
    if(nextWave(battle,catalog)){locked=false;target=0;animations.clear();defeats.clear();renderBattle();announce(battle.wave===2?'마지막 전투':'다음 전투');if(battle.wave===2)void audio.musicFor('bf006_btl_boss.mp3');}
    else{const reward=claimVictory(save,battle,catalog);battleResult={won:true,reward,questId:battle.questId,damage:battle.damage,maxCombo:battle.maxCombo};persist();screen='result';stopBattle();render();audio.effect('bf104_zin_quest_clear_ff.mp3');void audio.musicFor('bf009_village.mp3');}
  }else if(battle.phase==='enemyPending'){
    effectsUntil=performance.now();animateEvents(queueEnemyTurn(battle,catalog,{at:effectsUntil,speed:save.speed,durationFor:id=>sprites.duration(id,'atk')}));renderBattle();announce('적의 공격');
  }
 },Math.max(300,effectsUntil-performance.now()+180));
}
function attackAll(){if(!battle||locked||battle.phase!=='player')return;const available=battle.party.map((p,i)=>({p,i})).filter(({p})=>p.hp>0&&!p.acted);available.forEach(({i},n)=>later(()=>battleAction(i,'attack'),n*140/save.speed));}
function potionDialog(){if(tutorial){tutorialAction('item');return;}if(!battle)return;openModal('회복약 사용',`<div class="modal-body"><p>회복할 동료를 선택하세요. 최대 체력의 절반을 회복합니다.</p><div class="party-editor" style="margin-top:16px">${battle.party.map((p,i)=>`<button class="unit-card" data-action="heal-unit" data-index="${i}" ${p.hp<=0||p.hp>=p.maxHp?'disabled':''}><img src="${unitImage(p.id)}" alt=""><strong>${esc(catalog[p.id].name)}</strong><small>체력 ${fmt(p.hp)} / ${fmt(p.maxHp)}</small></button>`).join('')}</div></div>`);}
function renderResult(){
 const r=battleResult,q=QUESTS.find(q=>q.id===r.questId),reward=r.reward;
 view.innerHTML=`<section class="result-screen"><div class="result-emblem">${r.won?'✦':'◇'}</div><h2>${r.won?'모험 완료':'다시 일어설 때'}</h2>${r.won?`<div class="stars">${'★'.repeat(reward.stars)}${'☆'.repeat(3-reward.stars)}</div>`:''}<p class="subtitle" style="margin-top:16px">${q.name}<br>${r.won?'동료들과 함께 한 걸음 더 나아갔어요.':'동료를 강화하거나 속성을 바꿔 다시 도전해 보세요.'}</p>${r.won?`<div class="reward-grid"><div>젤<b>+${fmt(reward.zel)}</b></div><div>카르마<b>+${fmt(reward.karma)}</b></div><div>동료 경험치<b>+${fmt(reward.xp)}</b></div><div>${reward.first?'첫 완료 보석':'최대 연속 타격'}<b>${reward.first?'+'+reward.gems:r.maxCombo+'회'}</b></div></div>${reward.unit?`<div class="reward-unit"><img src="${unitImage(reward.unit)}" alt=""><div><strong>${esc(catalog[reward.unit].name)}</strong><small>${reward.duplicate?'중복 동료 · 카르마 120 획득':'새로운 동료가 합류했어요!'}</small></div></div>`:''}`:'<div style="height:50px"></div>'}<button class="gold-button" data-action="navigate" data-screen="quests">모험 지도</button><button class="gold-button secondary" data-action="start-quest" data-id="${q.id}">다시 도전</button><button class="text-btn" data-action="navigate" data-screen="home" style="margin:16px">마을로 돌아가기</button><p class="tiny-note">${r.won?'보상을 자동으로 저장했습니다.':'보유 재화와 동료는 그대로 유지됩니다.'}</p></section>`;
}
function drawBattle(now){
 const canvas=$('#battle-canvas');if(!battle||!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,640,440);const bg=images.get('battle');if(bg)ctx.drawImage(bg,0,0,640,440);
 // Tutorial PARAM 42 centers the 640px SAM stage at (160,110) in 320px UI space.
 const backgroundTime=now-battleBackgroundStarted;
 samPlayer.draw(ctx,'BattleDungeon10100CloudBack',{time:backgroundTime,x:0,y:-100});
 samPlayer.draw(ctx,'BattleDungeon10100WindAddBack',{time:backgroundTime,x:0,y:-100,additive:true});
 const entities=[...battle.party.map((p,i)=>({p,i,side:'p',pos:allyPositions[i]})),...battle.enemies.map((p,i)=>({p,i,side:'e',pos:enemyPositions[i]}))].sort((a,b)=>a.pos[1]-b.pos[1]);
 for(const {p,i,side,pos} of entities){
  if(tutorial&&((side==='p'&&!tutorial.visibleParty)||(side==='e'&&!tutorial.visibleEnemies)))continue;
  const a=animations.get(side+i),alive=p.hp>0,active=a&&now>=a.start&&now<a.start+a.duration;
  const dying=side==='e'&&defeats.has(i),pending=side==='e'&&battle.pendingHits?.some(h=>h.target===i);if(!alive&&!active&&!pending&&(!dying||now-defeats.get(i)>750))continue;
  let [x,y]=pos,action='idle',time=now+i*137;
  if(active){const elapsed=now-a.start,travel=a.travel||a.duration*.13,back=elapsed>a.duration-travel;const move=elapsed<travel?elapsed/travel:back?(a.duration-elapsed)/travel:1;x+=(a.target[0]-x)*.72*move;y+=(a.target[1]-y)*.45*move;action=elapsed<travel||back?'move':'atk';time=Math.max(0,elapsed-travel)*(a.speed||save.speed);}
  ctx.fillStyle='#0d181655';ctx.beginPath();ctx.ellipse(x,y+2,34,9,0,0,Math.PI*2);ctx.fill();
  const scale=side==='e'&&p.boss?2.35:side==='p'?1.75:1.9;
  ctx.save();if(hitFlashes.get(side+i)>now)ctx.filter='brightness(2.4)';sprites.draw(ctx,p.id,{x,y,scale,flip:side==='e',action,time,loop:!active,alpha:alive?1:pending?.65:Math.max(0,1-(now-(defeats.get(i)||now))/750)});ctx.restore();
  if(side==='e'&&alive){const w=68;ctx.fillStyle='#091d24bd';ctx.fillRect(pos[0]-w/2,pos[1]+12,w,6);ctx.fillStyle=p.boss?'#e8be6e':'#b1cf73';ctx.fillRect(pos[0]-w/2,pos[1]+12,w*p.hp/p.maxHp,6);ctx.strokeStyle='#c9be8799';ctx.strokeRect(pos[0]-w/2,pos[1]+12,w,6);ctx.font='11px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f6e7b7';ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillText(catalog[p.id].name,pos[0],pos[1]+32);ctx.shadowBlur=0;}
  if(p.guard&&alive){ctx.strokeStyle='#a7e5ee99';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-35,33,50,0,0,Math.PI*2);ctx.stroke();}
  if(active&&a.mode==='burst'){const t=(now-a.start)/a.duration;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.max(0,Math.sin(t*Math.PI))*.7;ctx.strokeStyle=ELEMENTS[a.element].color;ctx.lineWidth=6;ctx.beginPath();ctx.arc(a.target[0],a.target[1]-45,25+80*t,0,Math.PI*2);ctx.stroke();for(let j=0;j<7;j++){const angle=t*5+j*Math.PI*2/7;ctx.beginPath();ctx.moveTo(a.target[0]+Math.cos(angle)*30,a.target[1]-45+Math.sin(angle)*30);ctx.lineTo(a.target[0]+Math.cos(angle)*120,a.target[1]-45+Math.sin(angle)*120);ctx.stroke();}ctx.restore();}
 }
 samPlayer.draw(ctx,'BattleDungeon10100SunShineAddFront',{time:backgroundTime,x:0,y:-100,additive:true});
 for(let i=pickups.length-1;i>=0;i--){const p=pickups[i],t=(now-p.start)/p.life;if(t>=1){pickups.splice(i,1);continue;}const img=images.get(p.kind==='heart'?'heart-crystal':'battle-crystal');if(!img)continue;const w=32,h=p.kind==='heart'?32:64,f=t<.7?0:t<.85?1:2,x=p.from[0]+(p.to[0]-p.from[0])*t,y=p.from[1]+(p.to[1]-p.from[1])*t-Math.sin(t*Math.PI)*95;ctx.save();ctx.globalAlpha=t>.85?(1-t)/.15:1;ctx.drawImage(img,f*w,0,w,h,x-12,y-h*.375,24,h*.75);ctx.restore();}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],dt=now-p.start;if(dt<0)continue;if(dt>p.life){particles.splice(i,1);continue;}ctx.save();ctx.globalAlpha=Math.min(1,(p.life-dt)/250);ctx.textAlign='center';ctx.font=`700 ${p.size}px "Malgun Gothic",sans-serif`;ctx.strokeStyle='#1b1b20';ctx.lineWidth=3;if(p.bitmap&&images.has(p.bitmap)){const digits=p.text.replace('+',''),scale=p.size/23,w=16*scale,img=images.get(p.bitmap),left=p.x-digits.length*w/2;for(let j=0;j<digits.length;j++)ctx.drawImage(img,Number(digits[j])*16,0,16,23,left+j*w,p.y-dt*.055-23*scale,w,23*scale);}else{ctx.strokeText(p.text,p.x,p.y-dt*.055);ctx.fillStyle=p.color;ctx.fillText(p.text,p.x,p.y-dt*.055);}ctx.restore();}
}
function animationLoop(now){
 if(now-lastFrame>15){lastFrame=now;nativeUI?.paint();
  for(const canvas of document.querySelectorAll('canvas[data-home-art]:not([data-painted])')){
   const id=canvas.dataset.homeArt,img=images.get('full-'+id);if(!img)continue;
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,350);ctx.drawImage(img,...catalog[id].homeCrop,0,0,128,350);canvas.dataset.painted='true';
  }
  if(screen==='battle'&&battle&&!tutorial&&(!locked||battle.phase==='enemyAnimating')){
    const previous=battle.phase,events=advanceCombat(battle,now);if(events.length){animateEvents(events);if(battle.enemies[target]?.hp<=0)target=Math.max(0,battle.enemies.findIndex(e=>e.hp>0));renderBattle();}
    if(previous==='enemyAnimating'&&battle.phase!=='enemyAnimating'){
      if(battle.phase==='defeat'){battleResult={won:false,questId:battle.questId};screen='result';stopBattle();render();void audio.musicFor('bf009_village.mp3');}
      else{locked=false;animations.clear();renderBattle();}
    }else if(!locked&&battle.phase!=='player')settle();
  }
  if(screen==='battle')drawBattle(now);
  if(screen==='summon-animation')drawSummon(now);
  for(const canvas of document.querySelectorAll('canvas[data-sam]')){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const name=canvas.dataset.sam;if(!canvas.dataset.started)canvas.dataset.started=now;const elapsed=now-Number(canvas.dataset.started),intro=samPlayer.duration(name,'start');samPlayer?.draw(ctx,name,{time:elapsed<intro?elapsed:elapsed-intro,label:elapsed<intro?'start':'loop',loop:elapsed>=intro,x:name==='Touch'||name==='Hold'?-240:0,y:name==='Touch'||name==='Hold'?-210:0,koreanCommands:true,additive:canvas.dataset.additive==='true'});}
  for(const canvas of document.querySelectorAll('canvas[data-unit]')){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const previewTime=canvas.dataset.motion==='atk'?now-Number(canvas.dataset.started):now,action=canvas.dataset.motion==='atk'&&previewTime<sprites.duration(canvas.dataset.unit,'atk')?'atk':'idle';sprites?.draw(ctx,canvas.dataset.unit,{x:canvas.width/2,y:canvas.height*.82,scale:2.6,action,time:action==='atk'?previewTime:now,loop:action==='idle'});}
  if(auto&&battle&&!locked&&!modal.open&&battle.phase==='player'&&now-lastAttackAt>650/save.speed){const index=battle.party.findIndex(p=>p.hp>0&&!p.acted);if(index>=0){const p=battle.party[index];battleAction(index,p.bbCost&&p.bb>=p.bbCost?'burst':'attack');}}
 }
 requestAnimationFrame(animationLoop);
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
 const a=button.dataset.action,id=button.dataset.id;
 if(a.startsWith('command-')&&event.detail!==0&&performance.now()<suppressCommandClickUntil)return;
 try{
  if(a==='navigate')navigate(button.dataset.screen);
  else if(a==='begin'){prologueIndex=0;screen='prologue';render();}
  else if(a==='prologue-next'){if(prologueIndex===2)prologueName=$('#prologue-name').value.trim().slice(0,12)||'소환사';if(++prologueIndex===prologueLines.length)screen='starter';render();}
  else if(a==='continue'){if(save.tutorial.active)startTutorial(save.tutorial.chapter);else navigate('home');}
  else if(a==='starter'){const name=$('#summoner-name')?.value;selectedStarter=id;renderStarter();$('#summoner-name').value=name||'소환사';}
  else if(a==='close-modal')closeModal();
  else if(a==='help')help();
  else if(a==='about')about();
  else if(a==='guide')guide();
  else if(a==='tutorial-start')startTutorial(Number(button.dataset.chapter));
  else if(a==='tutorial-next')tutorialAction('next');
  else if(a==='tutorial-chest')tutorialAction('chest');
  else if(a==='tutorial-pause')tutorialPause();
  else if(a==='tutorial-resume')closeModal();
  else if(a==='tutorial-retry')startTutorial(tutorial.quest.id);
  else if(a==='tutorial-exit'){save.tutorial.active=false;persist();navigate('tutorials');}
  else if(a==='command-burst'){battleAction(Number(button.dataset.index),'burst');}
  else if(a==='command-guard'){battleAction(Number(button.dataset.index),'guard');}
  else if(a==='quest-info')questInfo(id);
  else if(a==='start-quest')startQuest(id);
  else if(a==='unit-detail')unitDetail(id);
  else if(a==='detail-back')navigate(detailReturn);
  else if(a==='unit-preview-motion'){const canvas=button.querySelector('canvas');canvas.dataset.motion='atk';canvas.dataset.started=performance.now();}
  else if(a==='filter'){filter=button.dataset.filter;renderUnits();}
  else if(a==='toggle-codex'){showAllUnits=!showAllUnits;renderUnits();}
  else if(a==='grow'){grow(save,id);persist();header();if(screen==='units')renderUnits();else if(screen==='home')renderHome();unitDetail(id);audio.effect('bf224_se_cure.mp3');toast('레벨이 올랐어요!');}
  else if(a==='party')partyEditor();
  else if(a==='party-pick'){if(partyDraft.includes(id))partyDraft=partyDraft.filter(v=>v!==id);else if(partyDraft.length<5)partyDraft.push(id);else{toast('일반 부대에는 다섯 명까지 편성할 수 있어요.');return;}renderPartyEditor();}
  else if(a==='party-save'){setParty(save,partyDraft);persist();navigate(partyReturn);toast('편성을 저장했어요.');}
  else if(a==='party-cancel')navigate(partyReturn);
  else if(a==='summon-open'&&summonSequence?.phase==='gate'){summonSequence.phase='open';summonSequence.start=performance.now();renderSummonAnimation();audio.effect('bf114_zin_unit_get1.mp3');}
  else if(a==='summon-switch'){summonKind=summonKind==='hero'?'regular':'hero';renderSummon();}
  else if(a==='summon')doSummon(button.dataset.kind);
  else if(a==='sound'){save.sound=!save.sound;persist();header();if(screen==='settings')renderSettings();if(save.sound)void audio.musicFor(screen==='battle'?'bf010_map_grass.mp3':'bf009_village.mp3');else audio.stop();toast(save.sound?'소리를 켰어요.':'소리를 껐어요.');}
  else if(a==='speed'){if(battle?.pendingHits?.length||battle?.actionEnds?.length||battle?.pendingCrystals?.length){toast('공격이 끝나면 속도를 바꿀 수 있어요.');return;}save.speed=save.speed===1?2:1;persist();if(screen==='settings')renderSettings();else if(screen==='battle')renderBattle();}
  else if(a==='export-save')exportSave();
  else if(a==='import-prompt'){$('#save-file').click();}
  else if(a==='reset-prompt'){openModal('새 모험을 시작할까요?',`<div class="modal-body"><p>현재 모험을 이어갈 수 있도록 먼저 저장 파일을 내려받아 주세요.<br>새 모험을 시작하면 이 브라우저의 진행 상황이 바뀝니다.</p><button class="gold-button secondary" data-action="export-save">현재 모험 저장 파일 내려받기</button><button class="gold-button" data-action="reset-confirm">새 모험 시작</button></div>`);}
  else if(a==='reset-confirm'){closeModal();stopBattle();save=null;prologueIndex=0;screen='prologue';audio.stop();render();}
  else if(a==='target'){if(tutorial)tutorialAction('target',Number(button.dataset.index));else{target=Number(button.dataset.index);renderBattle();}}
  else if(a==='mode'){battleMode=button.dataset.mode;closeModal();renderBattle();}
  else if(a==='attack-all'){closeModal();attackAll();}
  else if(a==='battle-menu')battleMenu();
  else if(a==='home-slide'){homeSlide=(homeSlide+Number(button.dataset.direction)+homePortals.length)%homePortals.length;renderHome();}
  else if(a==='home-portal'){if(homeSlide<2)navigate('quests');else openModal(homePortals[homeSlide][1],'<div class="modal-body"><p>이 모드는 현재 웹판에 포함되어 있지 않습니다.<br>퀘스트에서 모험을 이어갈 수 있어요.</p><button class="gold-button" data-action="navigate" data-screen="quests">퀘스트로 이동</button></div>');}
  else if(a==='auto'){auto=!auto;renderBattle();}
  else if(a==='potion')potionDialog();
  else if(a==='heal-unit'){const i=Number(button.dataset.index),heal=usePotion(battle,i);closeModal();const p=allyPositions[i];pushParticle('+'+heal,p[0],p[1]-65,'#b7f7a5',0,23);audio.effect('bf224_se_cure.mp3');log(`${catalog[battle.party[i].id].name}의 체력 ${fmt(heal)} 회복`);renderBattle();}
  else if(a==='retreat-prompt'){openModal('마을로 돌아갈까요?',`<div class="modal-body"><p>현재 도전은 취소됩니다. 아직 받지 않은 전투 보상은 얻을 수 없어요.</p><button class="gold-button" data-action="navigate" data-screen="home">마을로 돌아가기</button><button class="gold-button secondary" data-action="close-modal">계속 전투</button></div>`);}
  else if(a==='confirm-import'){const raw=JSON.parse(modal.dataset.pendingSave);save=validateSave(raw,catalog);persist();closeModal();navigate('home');toast('모험 기록을 불러왔어요.');}
  else if(a==='battle-unit'&&event.detail===0)battleAction(Number(button.dataset.index));
 }catch(error){toast(error.message||'작업을 완료하지 못했어요.');}
});
let gesture=null;
document.addEventListener('pointerdown',event=>{
 const btn=event.target.closest('[data-action="battle-unit"]');if(!btn||btn.disabled)return;
 clearTimeout(holdTimer);gesture={index:Number(btn.dataset.index),y:event.clientY,x:event.clientX,id:event.pointerId,held:false,start:performance.now()};view.setPointerCapture(event.pointerId);
 holdTimer=setTimeout(()=>{if(!gesture||!battle||locked)return;gesture.held=true;
  if(tutorial){if(tutorial.step.input==='burst'&&tutorial.step.index===gesture.index){tutorial.commandOpen=true;renderBattle();}else tutorialAction('hold',gesture.index);}else{commandIndex=gesture.index;renderBattle();}
 },1000/6);
});
document.addEventListener('pointerup',event=>{
 if(!gesture||gesture.id!==event.pointerId)return;clearTimeout(holdTimer);
 const {index,y,held,start}=gesture;gesture=null;const dy=(event.clientY-y)*320/($('.battle-screen')?.clientWidth||320);if(held)suppressCommandClickUntil=performance.now()+150;
 commandIndex=null;if(tutorial)tutorial.commandOpen=false;
 if(dy<=-30&&performance.now()-start<1000)battleAction(index,'burst');else if(dy>=60)battleAction(index,'guard');else if(!held)battleAction(index);else renderBattle();
});
document.addEventListener('pointercancel',()=>{clearTimeout(holdTimer);gesture=null;commandIndex=null;if(tutorial)tutorial.commandOpen=false;if(screen==='battle')renderBattle();});
document.addEventListener('contextmenu',event=>{if(event.target.closest('[data-action="battle-unit"]'))event.preventDefault();});
document.addEventListener('keydown',event=>{if(screen!=='battle'||modal.open)return;if(event.key==='Escape'){commandIndex=null;if(tutorial)tutorial.commandOpen=false;renderBattle();return;}const focused=event.target.closest('[data-action="battle-unit"]');if(event.key===' '&&focused&&!focused.disabled){event.preventDefault();const i=Number(focused.dataset.index);if(tutorial){if(tutorial.step.input==='burst'&&tutorial.step.index===i){tutorial.commandOpen=true;renderBattle();}else tutorialAction('hold',i);}else{commandIndex=i;renderBattle();}return;}if(/^[1-6]$/.test(event.key)){event.preventDefault();battleAction(Number(event.key)-1);}else if(tutorial&&event.key==='Enter'&&['story','say'].includes(tutorial.step.kind)){event.preventDefault();tutorialAction('next');}else if(tutorial&&event.key===' '&&tutorial.step.input==='hold'){event.preventDefault();tutorialAction('hold',2);}else if(tutorial&&event.key==='ArrowUp'&&tutorial.step.input==='burst'){event.preventDefault();tutorialAction('burst',2);}});
document.addEventListener('submit',event=>{if(event.target.id!=='starter-form')return;event.preventDefault();save=newSave(selectedStarter,catalog,$('#summoner-name').value);persist();startTutorial(1,false);});
document.addEventListener('input',event=>{if(event.target.id==='volume'){save.volume=Number(event.target.value);persist();if(audio.music)audio.music.volume=save.volume*.45;}});
document.addEventListener('change',async event=>{if(event.target.id!=='save-file')return;const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>1000000)throw Error('저장 파일이 너무 큽니다.');const raw=validateSave(JSON.parse(await file.text()),catalog);openModal('모험 기록을 불러올까요?',`<div class="modal-body"><p>${esc(raw.name)} · 동료 ${Object.keys(raw.units).length}명 · 완료 ${raw.battles}회<br>현재 브라우저의 기록을 이 파일의 기록으로 바꿉니다.</p><button class="gold-button secondary" data-action="export-save">현재 기록 먼저 내려받기</button><button class="gold-button" data-action="confirm-import">불러오기</button></div>`);modal.dataset.pendingSave=JSON.stringify(raw);}catch{toast('올바른 저장 파일이 아니에요. 기존 기록은 유지됩니다.');}});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.music?.pause();else if(save?.sound&&audio.music)void audio.music.play().catch(()=>{});});
async function boot(){
 try{
  const [unitsResponse,animationResponse,uiResponse,samResponse]=await Promise.all([fetch('units.json'),fetch('animations.json'),fetch('ui.json'),fetch('sam.json')]);if(!unitsResponse.ok||!animationResponse.ok||!uiResponse.ok||!samResponse.ok)throw Error('게임 데이터를 불러오지 못했어요.');
  unitData=await unitsResponse.json();catalog=makeCatalog(unitData);sprites=new SpritePlayer(await animationResponse.json());nativeUI=new NativeUI(await uiResponse.json());samPlayer=new SamPlayer(await samResponse.json());await Promise.all([nativeUI.load(),samPlayer.load()]);
  await Promise.all([...unitData.units.map(u=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images.set('full-'+u.id,img);resolve();};img.onerror=()=>reject(Error('유닛 일러스트를 불러오지 못했어요.'));img.src=unitImage(u.id,'full');})),...Object.entries({damage:'battle_damage_font.png',recover:'battle_recover_font.png','heart-crystal':'drop_heart_crystal.png','battle-crystal':'drop_battle_crystal.png'}).map(([key,file])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(key,image);resolve();};image.onerror=reject;image.src='assets/'+file;})),sprites.load(Object.keys(catalog)),new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images.set('battle',img);resolve();};img.onerror=()=>reject(Error('전투 배경을 불러오지 못했어요.'));img.src='assets/dungeon_battle_10100.jpg';})]);
  let stored=null;try{stored=localStorage.getItem(SAVE_KEY);}catch{toast('자동 저장을 사용할 수 없어요. 설정에서 저장 파일을 내려받아 주세요.');}if(stored){try{save=validateSave(JSON.parse(stored),catalog);}catch{toast('저장 기록을 읽지 못했어요. 새 모험을 시작하거나 저장 파일을 불러와 주세요.');}}
  render();requestAnimationFrame(animationLoop);
 }catch(error){view.innerHTML=`<div class="loading"><p>${esc(error.message)}</p><button class="gold-button" onclick="location.reload()">다시 불러오기</button></div>`;}
}
boot();
