// The supplied GL APK starts chapters 1 -> 9 -> 10 -> 11 -> 12 (home).
// Native chapter 10 selects tuto15, chapter 11 selects tuto16. Historical
// fusion/antidote scripts are separate branches, not this new-player route.
const story=(line,text,who='karl',face=0)=>({id:`t15-${line}`,kind:'story',source:'tuto15.txt',line,text,who,face,background:who==='tilith'?'grass':'town'});
const farewell=(line,text,face=0)=>({id:`t16-${line}`,kind:'story',source:'tuto16.txt',line,text,who:'karl',face,background:'town'});
export const JOURNEY_STEPS=[
 {id:'battle-1',kind:'battle',chapter:1,nativeChapter:1,title:'전투의 기초'},
 {id:'battle-2',kind:'battle',chapter:2,nativeChapter:9,title:'속성과 필살기'},
 story(23,'이제 내가 가르쳐 줄 건 다 알려 준 것 같아.\n남은 초원은 네 힘으로 빠져나가 보는 게 어때?','tilith'),
 story(25,'초원 너머의 동굴에 도착하면\n내가 다시 찾아갈게.','tilith'),
 story(27,'그때까지 더 강해져 있어야 해!\n할 수 있지, {name}?','tilith',1),
 story(67,'아, 돌아왔구나.\n너에게 전할 소식이 있어.', 'karl',2),
 story(68,'모르간에 또 강력한 마신이 나타났어.\n소환원에서는 다시 마신 토벌대를 꾸리기로 했지.', 'karl',2),
 story(69,'나도 그 일원으로 선발됐어.\n이번 원정은 꽤 길어질 것 같아.', 'karl',2),
 story(71,'떠나기 전에, 이걸 네게 줄게.\n그랑가이아의 보물… 보석이야.', 'karl',1),
 {...story(78,'보석 5개를 받았다.'),who:null,gift:true},
 story(81,'이걸로 든든한 동료를 소환해 봐!\n방법은 내가 알려 줄게.', 'karl',1),
 {id:'t15-93',kind:'action',source:'tuto15.txt',line:93,screen:'village',action:'open-summon',selector:'#nav [data-action="navigate"][data-screen="summon"]',text:'소환할 때 어떤 동료가 나올지는 고를 수 없어.\n강한 동료를 만날 수도 있지. 아래의 소환을 눌러 봐.'},
 {id:'t15-102',kind:'action',source:'tuto15.txt',line:102,screen:'summon',action:'summon-details',selector:'[data-action="summon"][data-kind="hero"]',text:'여기가 소환소야. 방금 받은 보석으로\n동료를 소환할 수 있어. 소환 버튼을 눌러 봐.'},
 {id:'t15-108',kind:'confirm',source:'tuto15.txt',line:108,action:'confirm-summon',title:'레어 소환',text:'보석 5개로 동료 한 명을 소환합니다.'},
 {id:'summon-gate',kind:'gate',source:'tuto15.txt',line:109,title:'소환의 문'},
 {id:'summon-result',kind:'result',source:'tuto15.txt',line:109,action:'accept-summon',title:'소환 결과'},
 story(114,'잘했어! 보석 5개가 있으면 언제든 소환할 수 있어.\n하지만 보석은 귀하니까 소중하게 쓰도록 해.'),
 farewell(18,'그럼, 이제 헤어질 시간이 된 것 같네.',1),
 farewell(19,'나는 마신 토벌대가 됐지만,\n언젠가 너도 소환군에 들어오게 될지 모르지.',1),
 farewell(21,'우리가 싸울 곳은 다르더라도 목적은 같아.\n이 세계를 지키는 것!',0),
 farewell(23,'그러니 더 강해져, {name}.\n언젠가 같은 적과 싸우게 된다면…\n서로의 등을 맡길 수 있었으면 좋겠어.',2),
 farewell(25,'그럼, 다시 만날 날까지…',0),
 {id:'complete',kind:'complete',nativeChapter:12,title:'새로운 모험',text:'티리스와 칼의 안내를 모두 마쳤어요.\n이제 홈에서 모험을 이어가세요.'},
];
export const journeyStep=j=>JOURNEY_STEPS.find(s=>s.id===j?.step)||null;
export const initialJourney=()=>({version:1,step:'battle-1',active:true,giftClaimed:false,summonResult:null});
export function validateJourney(raw,catalog){
 if(raw==null)return null;
 const step=journeyStep(raw);
 if(!raw||raw.version!==1||!step||typeof raw.active!=='boolean'||typeof raw.giftClaimed!=='boolean')throw Error('첫 모험 안내 기록이 올바르지 않습니다.');
 if(raw.active!==(step.kind!=='complete'))throw Error('안내 완료 상태가 올바르지 않습니다.');
 const position=JOURNEY_STEPS.indexOf(step),gift=JOURNEY_STEPS.findIndex(s=>s.gift);
 if(raw.giftClaimed!==(position>=gift))throw Error('보석 선물 기록이 올바르지 않습니다.');
 let summonResult=null;
 if(raw.summonResult!=null){
  const r=raw.summonResult;
  if(typeof r.id!=='string'||!Object.hasOwn(catalog,r.id)||typeof r.duplicate!=='boolean'||r.karma!==(r.duplicate?500:0))throw Error('안내 소환 기록이 올바르지 않습니다.');
  summonResult={id:r.id,duplicate:r.duplicate,karma:r.karma};
 }
 const gate=JOURNEY_STEPS.findIndex(s=>s.kind==='gate'),afterSummon=JOURNEY_STEPS.findIndex(s=>s.id==='t15-114');
 if(summonResult&&position<gate)throw Error('소환 순서가 올바르지 않습니다.');
 if(position>=gate&&position<=afterSummon&&!summonResult)throw Error('소환 결과가 없습니다.');
 return {version:1,step:raw.step,active:raw.active,giftClaimed:raw.giftClaimed,summonResult};
}
