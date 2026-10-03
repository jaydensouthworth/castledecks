import {PLAY_DESTINATIONS,destinationForMode,playDestinationURL,canPurchaseInArmory} from './player-hub.mjs';
import {observeBattlefield} from './engine/battle-director.mjs';
import {drawGorath} from './gorath-art.mjs';
import {createSpecialMotionController} from './special-unit-motion.mjs';
import {createRecruitShowcaseOptions,prepareRecruitShowcaseBattle} from './recruit-showcase.mjs';
import {createCompanionUI} from './companion-ui.mjs';
import {buildArmoryRecords} from './armory-catalog-data.mjs';
import {createArmorySnapshot} from './armory-catalog-model.mjs';
import {createArmoryCatalogUI} from './armory-catalog.mjs';
import {RECRUIT_SKILLS,COMPANIONS} from './engine/recruitment.mjs';
import {placeLoadoutAbility,recoverDuplicateBindings,abilityCategory,ABILITY_CATEGORIES} from './loadout-ui-model.mjs';
import {createLoadoutDrag} from './loadout-drag.mjs';
import {slotToKey,eventToSlot} from './keyboard-layout.mjs';
import {elementalNotice,drawElementalNotice,drawReactiveElement,drawElementalDragon} from './elemental-feedback.mjs?build=37';
import {createPortraitView,portraitViewBounds,drawBattleOverview,portraitOffscreenStatus} from './portrait-view.mjs';
import {updateCombatHud} from './combat-hud.mjs?build=37';
import {frameCombatCamera} from './combat-camera.mjs';
import {createMidgameDemoBattleOptions,prepareMidgameDemoBattle} from './midgame-demo.mjs?build=37';
import {skillIcon} from './skill-icons.mjs';
import {createMovementOwners} from './movement-input.mjs';
import {liveBarState,liveSlotStatus} from './live-action-model.mjs';
import {createLiveSkillAdapter} from './live-skill-adapter.mjs';
import {drawFortification,drawFortificationCollision,garrisonStation,fortificationGeometry} from './fortress-art.mjs?build=37';
import {boundSkillRefs,contextualHudState,priorityFlagAlert,shortNames} from './quiet-hud-model.mjs';
import {drawAlternateAimGuide} from './alternate-aim-guides.mjs';
import {autoAimFeedback} from './auto-aim-feedback.mjs';
import {sampleManualAim,drawManualAimGuide} from './manual-aim-guide.mjs';
import {createCombatPoseController,drawCombatTroop} from './combat-poses.mjs?build=37';
import {createWorldCamera,screenToWorld,getBackingStoreSize,extendTerrainForCamera} from './world-camera.mjs';
import {flagDescription,heroExperience,summonMessage} from './hud-state.mjs';
import {markTestingProfiles,grantTestGold,unlockTestSkills,readyTestSkills,protectTestBattle,finishTestBattle,selectTestLevel} from './testing.mjs';
import {combatNotice,drawCombatNotice,drawStatusBadges} from './combat-feedback.mjs?build=37';
import {ActionBarLayout} from './engine/action-bar-layout.mjs';
import {BattleAudio} from './audio.mjs';
import {CampaignBattle} from './engine/first-battle.mjs';
import {SimulationClock} from './engine/clock.mjs';
import {aimVector} from './engine/ballistics.mjs';
import {PlayerProfile,SKILLS} from './engine/progression.mjs';
import {CampaignProfiles} from './engine/profile-manager.mjs';
const $=selector=>document.querySelector(selector),canvas=$('#battlefield'),ctx=canvas.getContext('2d');
const audio=new BattleAudio();
let portraitCenter=null,portraitOverview=false;
let worldCamera=createWorldCamera(2000,1000),backingStore=getBackingStoreSize(worldCamera);
function measureScene(rect=canvas.getBoundingClientRect()){
 worldCamera=createWorldCamera(rect.width,rect.height);
 if(rect.width<rect.height&&battle?.terrain?.samples?.length){
  const movement=$('.live-movement')?.getBoundingClientRect();
  const floor=Math.min(rect.height*.58,Number.isFinite(movement?.top)?movement.top-rect.top-26:rect.height*.58);
  worldCamera=createPortraitView(rect.width,rect.height,{heroX:battle.hero.x,center:portraitCenter,overview:portraitOverview,groundY:Math.max(...battle.terrain.samples),groundBottom:floor});
 }
 if(rect.width>rect.height&&rect.height<=500&&battle?.terrain?.samples?.length){
  const dock=$('.live-action-bar')?.getBoundingClientRect(),vitals=$('.live-vitals')?.getBoundingClientRect(),standard=$('.live-battle-standard')?.getBoundingClientRect();
  const groundY=Math.max(...battle.terrain.samples),tops=battle.structures.map(b=>fortificationGeometry(b)?.body.y).filter(Number.isFinite);
  const origins=battle.structures.map(b=>b.y+b.shotOffset.y);origins.push(Math.min(...battle.terrain.samples)-30);
  if(dock&&vitals&&standard)worldCamera=frameCombatCamera(worldCamera,{groundY,structureTopY:Math.min(...tops),aimOriginTopY:Math.min(...origins),top:rect.width>=700?Math.max(6,Math.min(vitals.top,standard.top)-rect.top):Math.max(vitals.bottom,standard.bottom)-rect.top+6,bottom:dock.top-rect.top-6});
 }
 if(aimCamera&&aimCamera.width===rect.width&&aimCamera.height===rect.height)worldCamera=aimCamera;
 backingStore=getBackingStoreSize(worldCamera,window.devicePixelRatio??1);
 if(worldCamera.renderable){if(canvas.width!==backingStore.width)canvas.width=backingStore.width;if(canvas.height!==backingStore.height)canvas.height=backingStore.height;}
 return worldCamera;
}

let visualDirty=true,lastPaint=null,aimPointerId=null,aimPressPoint=null,aimCamera=null,aimGuideVisible=false,loadGeneration=0,movementTap=null;
const background=typeof Image==='undefined'?null:new Image();if(background){background.onload=()=>visualDirty=true;background.src='./images/illustrated-highlands.png';}
const requestedMode=new URLSearchParams(window.location?.search??'').get('mode');
let testingMode=requestedMode==='test',demoMode=requestedMode==='demo';
let recruitShowcase=demoMode&&new URLSearchParams(window.location?.search??'').get('showcase')==='companions';
let activeDestination=destinationForMode({demoMode,recruitShowcase,testingMode});
let selectedDestination=activeDestination,hubOpen=true,pendingDestination=null;
const destinationSessions=new Map();
const makeDemo=options=>(recruitShowcase?createRecruitShowcaseOptions:createMidgameDemoBattleOptions)(options);
const demoAim=new URLSearchParams(window.location?.search??'').get('aim');
let demoLaunch=demoMode?makeDemo({shootingMode:['classic','anywhere','point_aim','auto_aim'].includes(demoAim)?demoAim:'classic'}):null;
if(demoMode)document.title='Castledecks · Midgame demo';
let testingProtection=false,testingCollision=false;
const GAME_BUILD='37';
let profiles=new CampaignProfiles({profiles:demoLaunch?[demoLaunch.profile]:[],defaultName:testingMode?'Playground':demoMode?'Midgame Demo':'Castledecks'});
let profile=profiles.active,battle,clock,combatPoses,specialMotion,started=false,angle=20,power=100,now=performance.now(),notices=[],barSignature='',liveSkills,selectedWrapper=null,editorBar=0,loadoutOrigin='preparation',toastUntil=0,openPanelId=null,panelResume=false,activationPulse=0,heldSpace=false,loadoutReturnPanel=null,pendingDelete=null,bindingLayout=null,pauseMessage="Take your time. Your battlefield is frozen.",panelFocus=null;
const movementOwners=createMovementOwners(()=>battle?.input??{});
const descriptions={...Object.fromEntries(Object.entries(RECRUIT_SKILLS).map(([id,item])=>[id,item.description])),arrow:'Fast-reloading standard shot. Earn gold and experience from hits.',fireArrow:'Fire damage and a lingering burn.',iceArrow:'Ice damage that slows affected targets.',pierceArrow:'A heavy piercing projectile.',bombArrow:'A blast on impact with nearby damage.',flakArrow:'Press Space while airborne to scatter shrapnel.',bombWave:'Explosions travel along the ground.',iceWave:'Waves of ice damage and slowing frost sweep outward.',fireWave:'Burning waves travel over the terrain.',healWave:'Restores nearby friendly living units.',thunderArrow:'Press Space to form a lightning cloud.',meteorArrow:'Calls down falling fire and rock.',cometArrow:'Calls down falling ice.',grunt:'Four foot soldiers. Each squad costs 20 gold and 4 reserve.',archer:'Four archers. Each squad costs 20 gold and 4 reserve.',tallGrunt:'Three heavy infantry. Each squad costs 30 gold and 3 reserve.',mount:'Four mounted fighters. Each squad costs 30 gold and 4 reserve.',trebuchet:'One siege engine. Costs 70 gold and 1 reserve recruit.',priest:'Two healers. Each squad costs 30 gold and 2 reserve.'};
const companionUI=createCompanionUI({document,getBattle:()=>battle,canAct:()=>started&&!battle.paused&&!battle.outcome&&!battle.summary&&!openPanelId,onChange:()=>{visualDirty=true;if(openPanelId==='#shopPanel')renderShop();},notify:text=>status(text)});
function status(text){$('#battleStatus').textContent=text;if(/out of range|not enough|need \d|need more|reloads in|queue is full|unavailable|not ready|begin inside|view changed|wait for|no population|cannot|failed/i.test(text)&&started&&!openPanelId){$('#hudToast').textContent=text;$('#hudToast').classList.remove('hidden');toastUntil=performance.now()+2200;visualDirty=true;}}
function completedCampaignLabel(){return profiles.profiles.length>1?'Retire and choose campaign':'Start new campaign';}
function renderHub(){
 const current=PLAY_DESTINATIONS.find(item=>item.id===activeDestination),selected=PLAY_DESTINATIONS.find(item=>item.id===selectedDestination);
 $('#introTitle').textContent='Player lobby';
 $('#introText').textContent='Choose where to play. Manage the loadout, army and settings for this session below.';
 $('#hubSessionTitle').textContent=`${current.name} · ${profile.name}`;
 $('#hubSessionState').textContent=battle.summary?.campaignComplete?'Campaign complete':battle.summary?`Battle ${battle.level} ${battle.summary.outcome} · ready to ${battle.summary.outcome==='victory'?'continue':'retry'}`:started?`Battle ${battle.level} paused · your battlefield is preserved`:`Battle ${battle.level} ready · combat has not started`;
 $('#hubSessionResources').textContent=`Rank ${profile.rank} · ${Math.floor(profile.gold).toLocaleString()} gold${profile.cheated?' · Assisted':''}`;
 if(!$('#hubDestinations').children.length){
  $('#hubDestinations').innerHTML=PLAY_DESTINATIONS.map(item=>`<button id="${item.buttonId}" data-hub-destination="${item.id}" aria-pressed="false"><small>${item.kind}</small><strong>${item.name}</strong><span>${item.id===activeDestination?'This session':'Open lobby'}</span></button>`).join('');
  for(const button of $('#hubDestinations').querySelectorAll('[data-hub-destination]'))button.onclick=()=>{selectedDestination=button.getAttribute('data-hub-destination');$('#introNotice').textContent='';renderHub();};
 }
 for(const button of $('#hubDestinations').querySelectorAll('[data-hub-destination]')){const id=button.getAttribute('data-hub-destination');button.setAttribute('aria-pressed',String(id===selectedDestination));button.querySelector('span').textContent=id===activeDestination?'This session':destinationSessions.has(id)?'Kept in this tab':'Open lobby';}
 $('#hubDestinationDescription').textContent=selected.description;
 $('#start').textContent=selectedDestination!==activeDestination?`Open ${selected.name.toLowerCase()}`:battle.summary?.campaignComplete?completedCampaignLabel():battle.summary?`${battle.summary.outcome==='victory'?'Start':'Retry'} battle ${battle.summary.outcome==='victory'?battle.level+1:battle.level}`:started?`Resume battle ${battle.level}`:`Start battle ${battle.level}`;
 $('#hubLaunchNote').textContent=selectedDestination!==activeDestination?'Switch to this lobby in the same tab. Your current session is kept in memory.':started&&!battle.summary?'Resume this exact battlefield when you are ready.':battle.summary?'Review your loadout before the next battle.':'Combat begins only when you choose Start.';
 $('#introArmory').disabled=!!battle.summary?.campaignComplete;$('#hubOpenSeparate').classList[selectedDestination===activeDestination?'add':'remove']('hidden');
}
function openDestination(id,notice=$('#introNotice')){
 if(id===activeDestination)return;
 const item=PLAY_DESTINATIONS.find(item=>item.id===id),url=playDestinationURL(id,profile.shootingMode);
 let opened=null;try{opened=window.open?.(url,'_blank');if(opened)opened.opener=null;}catch{}
 if(opened)notice.textContent=`${item.name} opened in a separate tab. This session stays here.`;
 else notice.innerHTML=`This session is still here. <a href="${html(url)}" target="_blank" rel="noopener">Open ${html(item.name.toLowerCase())} in a new tab</a>.`;
}
function startMidgameDemo(showcase=false){const id=showcase===true?'allies':'midgame';showHub();selectedDestination=id;renderHub();requestDestination(id);}
function showHub(){
 if(battle.outcome&&!battle.summary){status('Counting the battle result. The lobby opens when rewards are settled.');return;}
 cancelPendingImport();clearInput();loadoutDrag.cancel();
 if(openPanelId){panelResume=false;panel(openPanelId,false);}
 loadoutReturnPanel=null;precisionReturnPanel=null;armoryReturnFromLoadout=false;
 if(started&&!battle.summary)pause(true);
 hubOpen=true;selectedDestination=activeDestination;
 $('#restartConfirm').classList.add('hidden');$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');
 renderHub();syncPause();$('#start').focus?.();visualDirty=true;
}
function startFromHub(){
 if(!hubOpen||openPanelId||pendingDestination)return;
 if(selectedDestination!==activeDestination){requestDestination(selectedDestination);return;}
 if(battle.summary){$('#replay').onclick();return;}
 if(started){hubOpen=false;$('#intro').classList.add('hidden');pause(false);return;}
 begin();
}
function armoryPurchasesAllowed(){return canPurchaseInArmory({started,summary:battle.summary});}
function requestDestination(id){
 if(id===activeDestination||!PLAY_DESTINATIONS.some(item=>item.id===id))return;
 if(battle.outcome&&!battle.summary){status('Wait for the battle result before switching sessions.');return;}
 if(started&&!battle.summary){
  pendingDestination=id;const item=PLAY_DESTINATIONS.find(item=>item.id===id);
  $('#switchSessionText').textContent=`Open ${item.name.toLowerCase()}? Your current Battle ${battle.level} stays paused in this tab. Select ${PLAY_DESTINATIONS.find(item=>item.id===activeDestination).name.toLowerCase()} in the lobby to return to this exact battlefield.`;
  $('#switchSessionConfirm').classList.remove('hidden');$('#intro').inert=true;$('#pauseOverlay').inert=true;$('#cancelSessionSwitch').focus?.();return;
 }
 switchDestination(id);
}
function cancelSessionSwitch(){pendingDestination=null;$('#switchSessionConfirm').classList.add('hidden');syncPanelShield();$('#start').focus?.();}
function switchDestination(id){
 if(id===activeDestination)return;
 clearInput();cancelPendingImport();loadoutDrag.cancel();if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();liveSkills?.dispose();
 destinationSessions.set(activeDestination,{profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trajectory:$('#trajectory').value,shooterAngleMode:battle.shooter.angleMode,showAssist:$('#showAssist').checked});
 activeDestination=id;selectedDestination=id;demoMode=['midgame','allies'].includes(id);testingMode=id==='training';recruitShowcase=id==='allies';
 pendingDestination=null;$('#switchSessionConfirm').classList.add('hidden');
 const saved=destinationSessions.get(id);
 if(saved){
  ({profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview}=saved);
  hubOpen=true;barSignature='';bindingLayout=null;selectedWrapper=null;armoryReturnFromLoadout=false;precisionReturnPanel=null;loadoutReturnPanel=null;
  syncSessionMenus();$('#trajectory').value=saved.trajectory;$('#showAssist').checked=saved.showAssist;attachLiveSkills();drawHotbar();
 }else{
  testingProtection=false;testingCollision=false;angle=20;power=100;$('#trajectory').value='1';$('#showAssist').checked=false;demoLaunch=demoMode?makeDemo({shootingMode:profile.shootingMode}):null;
  profiles=new CampaignProfiles({profiles:demoLaunch?[demoLaunch.profile]:[],defaultName:testingMode?'Playground':'Castledecks'});profile=profiles.active;setup();
 }
 document.title=demoMode?'Castledecks · Midgame demo':testingMode?'Castledecks · Training':'Castledecks · Campaign';
 window.history?.replaceState(null,'',playDestinationURL(activeDestination,profile.shootingMode));
 $('#battleTitle').textContent=`${testingMode?'Playground · ':profile.cheated?'Assisted · ':''}Battle ${battle.level}${profile.cheated?'':' · Capture the flag'}`;
 $('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;$('#battleAngle').value=String(angle);$('#battleAngleOut').textContent=angle+'°';$('#battlePower').value=String(power);updatePowerMode();if(saved)battle.shooter.angleMode=saved.shooterAngleMode;$('#battleFire').classList[$('#showAssist').checked?'remove':'add']('hidden');now=performance.now();lastPaint=null;showHub();
}
function restartMidgameDemo(){
 if(!demoMode)return;
 demoLaunch=makeDemo({shootingMode:profile.shootingMode});profiles=new CampaignProfiles({profiles:[demoLaunch.profile],defaultName:'Midgame Demo'});profile=profiles.active;started=false;setup();showHub();
 status('Midgame demo reset · prepare Battle 13 · assisted');
}
function returnFromDemo(){if(!demoMode)return;if(destinationSessions.has('campaign')){showHub();selectedDestination='campaign';renderHub();requestDestination('campaign');return;}if(window.parent&&window.parent!==window){window.parent.postMessage({type:'bowmaster-preview-exit-demo'},window.location.origin);return;}$('#demoReturnNote').textContent='Your campaign is in its original tab. If this tab stays open, close it to return.';try{window.close?.();}catch{}}
function cancelPendingImport(){loadGeneration++;if($('#introNotice').textContent==='Reading campaign file…')$('#introNotice').textContent='';for(const id of ['#saveStatus','#endingSaveStatus'])if($(id).textContent==='Reading campaign file…')$(id).textContent='Load cancelled. Your current campaign has been kept.';}

function clearInput(){battle?.cancelPlayerShots();aimCamera=null;movementOwners.clear();liveSkills?.clear();aimPressPoint=null;aimGuideVisible=false;movementTap=null;const pointerId=aimPointerId;aimPointerId=null;if(pointerId!==null&&canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);battle.input={left:false,right:false,up:false,down:false,mouseDown:false,digits:[],space:false};battle.queuedAim=null;battle.queuedSelection=null;battle.hotbar.wheel=0;activationPulse=0;heldSpace=false;battle.shooter.cancel();}
function syncPanelShield(){for(const [id,panelId] of [['#pauseSkills','#skillsPanel'],['#openAim','#aimPanel']])$(id).setAttribute('aria-expanded',String(openPanelId===panelId));const active=!!openPanelId;$('#panelShield').classList[active?'remove':'add']('hidden');for(const selector of ['.topbar','.battle-screen','.command-deck','#intro','#pauseOverlay','#ending','#restartConfirm','#switchSessionConfirm'])$(selector).inert=active||!!pendingDestination&&selector!=='#switchSessionConfirm';}
function syncPause(){syncPanelShield();const visible=started&&battle.paused&&!battle.outcome&&!openPanelId&&!hubOpen;$('#pauseOverlay').classList[visible?'remove':'add']('hidden');$('#pauseReason').textContent=pauseMessage;$('#battlePause').textContent=battle.paused?'▶ Resume':'Ⅱ Pause';$('#battlePause').setAttribute?.('aria-label',battle.paused?'Resume battle':'Pause battle');}
function focusPanel(id){const node=$(id);node?.querySelector?.('button,input,select,[tabindex]')?.focus?.();}

function updateAimGuide(){const guides={classic:['Press the glowing ring at your castle. Pull back, then release to shoot.','Drag from the glowing ring to draw your bow','◎ ← ➶'],anywhere:['Press anywhere, pull opposite your shot, then release. The gold arrow starts at your hero; a longer pull adds power.','Pull anywhere; the gold arrow shows your hero’s launch direction and power','← ➶'],point_aim:['Tap the battlefield to shoot toward that point. Set power in Settings → precise controls.','Tap the battlefield to shoot in that direction','⊙ ➶'],auto_aim:['Tap where the target will be when your arrow arrives. The bow calculates an arc to that point; shots do not track.','Lead moving targets, then tap to fire a calculated arc','⌁ ➶']};const g=guides[profile.shootingMode]??guides.classic;$('#aimGuideTitle').textContent=['point_aim','auto_aim'].includes(profile.shootingMode)?'Choose your target.': 'Draw. Aim. Release.';$('#aimGuide').textContent=g[0];$('#aimTip').textContent=g[1];$('#aimDemo').textContent=g[2];canvas.setAttribute('aria-label',`Battlefield. ${g[0]} Movement and abilities are in the game HUD.`);$('#aimTip').classList.remove('hidden');}
let armoryReturnFromLoadout=false;
function syncSessionMenus(){
 if(testingMode||demoMode)markTestingProfiles(profiles);
 for(const id of ['#openTesting','#introTesting','#pauseTesting','#endingTesting'])$(id).classList[testingMode?'remove':'add']('hidden');$('#launchTesting').classList[testingMode?'add':'remove']('hidden');$('#testModeBadge').classList[profile.cheated?'remove':'add']('hidden');$('#testModeBadge').textContent=demoMode?'DEMO':testingMode?'TEST':'ASSISTED';$('#testModeBadge').setAttribute('aria-label',demoMode?'Assisted midgame demo':testingMode?'Assisted playground':'Assisted profile');
 for(const section of document.querySelectorAll('[data-demo-only]'))section.classList[demoMode?'remove':'add']('hidden');$('#pauseDemo').classList[demoMode?'add':'remove']('hidden');$('#gameShell').dataset.demo=String(demoMode);$('#pauseAlliesDemo').classList[demoMode?'add':'remove']('hidden');$('#demoPresetDescription').textContent=recruitShowcase?'Assisted allies showcase · supplied Fire Dragon already on the field · Gorath hired and ready to summon. Tap his separate control, then command Earthshatter. New recreation mechanics and provisional balance.':'Assisted preset · rank 8 hero/basic arrow · rank 2 acquired skills · heavy infantry and cavalry · automatic army recruitment · 1,500 gold budget.';
 if(demoMode&&destinationSessions.has('campaign')){$('#demoReturn').textContent='Return to campaign lobby';$('#demoReturnNote').textContent='Your campaign is preserved in this tab. Choose Campaign in the player lobby to return.';for(const button of document.querySelectorAll('[data-demo-action="return"]'))button.textContent='Return to campaign lobby';for(const note of document.querySelectorAll('[data-demo-session-note]'))note.textContent='This assisted session has its own profile and gold. Your campaign is preserved in this tab.';}
 if(demoMode&&window.parent&&window.parent!==window){$('#demoReturn').textContent='Back to playground';$('#demoReturnNote').textContent='This is a separate demo inside the viewport lab.';for(const button of document.querySelectorAll('[data-demo-action="return"]'))button.textContent='Back to playground';}
 $('#introText').textContent=testingMode?'Assisted playground. Try any battle or ability with test controls. This separate profile is marked as assisted.':'Defend your flag. Destroy the enemy keep to cut off reinforcements, then defeat the remaining army. Or bring their flag home.';
 cancelPendingImport();$('#saveCode').value='';$('#loadCode').value='';$('#saveCodeArea').classList.add('hidden');openPanelId=null;syncPanelShield();$('#introNotice').textContent='';$('#saveStatus').textContent='Save a campaign file before closing. Progress is kept in this session only.';$('#endingSaveStatus').textContent='Save your progress before leaving. A file resumes at the start of the saved battle.';panelResume=false;loadoutReturnPanel=null;pendingDelete=null;bindingLayout=null;$('#battlePause').disabled=!started;updateAimGuide();$('#pauseOverlay').classList.add('hidden');$('#restartConfirm').classList.add('hidden');for(const id of ['#settingsPanel','#profilesPanel','#shopPanel','#testingPanel','#queuePanel','#savePanel','#skillsPanel','#aimPanel'])$(id)?.classList.add('hidden');
}
function attachLiveSkills(){
 liveSkills=createLiveSkillAdapter(battle,{canAct:()=>started&&!battle.paused&&!battle.outcome&&!battle.summary&&!openPanelId,onSummonResult:({skill,accepted,cancelled})=>{if(cancelled)return;status(accepted?SKILLS[skill.id].name+' squad queued':summonMessage(skill,profile,battle.friendlyQueue));visualDirty=true;}});
}
function setup(level=Math.min(30,Math.max(1,profile.highestLevel))){
 started=false;hubOpen=true;selectedDestination=activeDestination;
 armoryReturnFromLoadout=false;
 if(battle)clearInput();
 const demoOptions=demoLaunch;demoLaunch=null;portraitCenter=null;portraitOverview=false;
 aimCamera=null;aimGuideVisible=false;if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();movementOwners.clear();liveSkills?.dispose();barSignature='';selectedWrapper=null;editorBar=0;
 combatPoses=createCombatPoseController();specialMotion=createSpecialMotionController();
 syncSessionMenus();
 const completed=profile.highestLevel>30,savedProgress=completed?{level:profile.level,scene:profile.scene,highestLevel:profile.highestLevel,highestScene:profile.highestScene}:null;
 const onBattleEvent=event=>{
  combatPoses.event(event);specialMotion.event(event);
  const elementalCue=elementalNotice(event);if(elementalCue)notices.push(elementalCue);
  const cue=combatNotice(event);if(cue)notices.push(cue);if(event.type==='heal'&&event.amount>0)audio.play('heal');
  if(event.type==='sound')audio.play(event.kind);
  if(event.type==='shot'){audio.play('shot');$('#aimTip').classList.add('hidden');}
  if(event.type==='hit')audio.play('hit');
  if(event.type==='damage')notices.push({x:event.target.x,y:event.target.y-event.target.height,text:(event.critical?'! ':'')+Math.floor(event.damage),tick:event.tick,color:event.target.team==='good'?'#e7c29b':'#f4e7ac'});
  if(event.type==='visual'){
   if(event.kind==='bomb-blast'||event.kind==='flak-blast')notices.push({x:event.x,y:event.y,radius:event.width/2||80,tick:event.tick});
   else if(['ground-crack','earth-shard','lightning-bolt','lightning-strike'].includes(event.kind))notices.push({x:event.x,y:event.y,radius:50,tick:event.tick,color:'#b3dfea'});
  }
  if(event.type==='aim-unreachable')status(autoAimFeedback(battle.hero.launchPosition,battle.shooter.pointer,battle.shooter).message??'That target is out of range at this power');
  if(event.type==='enemy-reserves-withdrawn')status('Enemy keep destroyed. Reinforcements cut off. Defeat the remaining army or capture their flag.');
  if(event.type==='outcome')status(event.outcome==='victory'?'Victory! Counting the spoils…':battle.hero.dead?'Your hero fell':'The enemy captured your flag');
  if(event.type==='summary'){
   $('#endingTitle').textContent=(profile.cheated?'Assisted · ':'')+(event.summary.campaignComplete?'Campaign complete':event.summary.outcome==='victory'?'Victory':'Defeat');
   $('#endingText').textContent=event.summary.campaignComplete?(profile.cheated?'Assisted final-battle result. Test profiles can jump ahead; this is not a verified 30-battle playthrough.':'You have completed all 30 battles in this reconstruction. Original-runtime parity remains under review.'):event.summary.outcome==='victory'?`Battle ${battle.level} won. Bonus: ${event.summary.gold} gold and ${event.summary.xp} XP.`:'Keep the gold and experience you earned. Visit the armory, then defend your flag again.';
   $('#replay').textContent=event.summary.campaignComplete?completedCampaignLabel():event.summary.outcome==='victory'?`Continue to battle ${battle.level+1}`:'Retry battle';$('#ending').classList.remove('hidden');$('#replay').focus?.();
  }
 };
 battle=new CampaignBattle({...({profile,level,testing:testingMode,random:Math.random}),...(demoOptions??{}),onEvent:demoOptions?()=>{}:onBattleEvent});
 if(demoOptions){(recruitShowcase?prepareRecruitShowcaseBattle:prepareMidgameDemoBattle)(battle);battle.onEvent=onBattleEvent;}
 if(testingMode)protectTestBattle(battle,testingProtection);
 if(completed){Object.assign(profile,savedProgress);battle.outcome='victory';battle.summary={outcome:'victory',campaignComplete:true,gold:0,xp:0};}
 combatPoses.attach(battle);specialMotion.attach(battle);
 attachLiveSkills();
 clock=new SimulationClock({onTick:()=>{const actorsAdvanced=!battle.paused&&!battle.summary&&!battle.outcome;const tap=movementTap;movementTap=null;if(tap)battle.input[tap]=true;liveSkills.beforeTick();battle.step();liveSkills.afterTick();if(battle.outcome)liveSkills.clear();combatPoses.observeTick({actorsAdvanced});specialMotion.observeTick({actorsAdvanced});if(tap){battle.input[tap]=false;movementOwners.sync();}if(activationPulse>0)--activationPulse;battle.input.space=heldSpace||activationPulse>0;}});notices=[];now=performance.now();barSignature='';
 $('#battleTitle').textContent=`${testingMode?'Playground · ':profile.cheated?'Assisted · ':''}Battle ${battle.level}${profile.cheated?'':' · Capture the flag'}`;renderHub();
 $('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;updatePowerMode();drawHotbar();if(completed){$('#intro').classList.add('hidden');$('#ending').classList.remove('hidden');$('#endingTitle').textContent=(profile.cheated?'Assisted · ':'')+'Campaign complete';$('#endingText').textContent=profile.cheated?'This assisted profile has a final-battle result. Export it to keep the record, or begin a new campaign.':'This saved campaign has completed all 30 battles. Export it to keep the record, or begin a new campaign.';$('#replay').textContent=completedCampaignLabel();}
 syncPause();
}
setup();
$('#pauseAlliesDemo').onclick=()=>startMidgameDemo(true);$('#pauseDemo').onclick=startMidgameDemo;$('#demoReturn').onclick=returnFromDemo;$('#demoRestart').onclick=restartMidgameDemo;
for(const button of document.querySelectorAll('[data-demo-action]'))button.onclick=button.getAttribute('data-demo-action')==='return'?returnFromDemo:restartMidgameDemo;
$('#buildLabel').textContent=`Build ${GAME_BUILD}`;$('#testingBuild').textContent=`Loaded build ${GAME_BUILD}`;
function begin(){if(started||openPanelId||battle.summary?.campaignComplete)return;hubOpen=false;cancelPendingImport();canvas.focus?.();started=true;battle.paused=false;clearInput();$('#pauseOverlay').classList.add('hidden');$('#intro').classList.add('hidden');$('#ending').classList.add('hidden');$('#battlePause').disabled=false;syncPause();drawHotbar();status(profile.shootingMode==='classic'?'Pull back from the castle ring to fire. Watch for enemies carrying your flag.':'Aim on the battlefield. Protect your flag carriers.');now=performance.now();}
function restart(){const level=battle.level;setup(level);begin();}
$('#start').onclick=startFromHub;$('#pauseLobby').onclick=showHub;$('#endingLobby').onclick=showHub;$('#hubOpenSeparate').onclick=()=>openDestination(selectedDestination);$('#cancelSessionSwitch').onclick=cancelSessionSwitch;$('#confirmSessionSwitch').onclick=()=>{if(pendingDestination)switchDestination(pendingDestination);};$('#separateSessionSwitch').onclick=()=>{if(pendingDestination)openDestination(pendingDestination);cancelSessionSwitch();};$('#battleRestart').onclick=()=>{$('#restartConfirm').classList.remove('hidden');$('#confirmRestart').focus?.();};$('#confirmRestart').onclick=()=>{restart();};$('#cancelRestart').onclick=()=>{$('#restartConfirm').classList.add('hidden');$('#resumeGame').focus?.();};$('#replay').onclick=()=>{if(battle.summary?.campaignComplete){if(!profile.cheated&&profile.victories+profile.defeats===0){$('#endingText').textContent='This imported completion has no recorded battles. Choose Profiles to switch campaigns, or Load campaign to use another file.';status('Choose another profile or load a campaign file');return;}const chooseExisting=profiles.profiles.length>1;profile.scene=profile.highestScene=33;profiles.retireCurrent();profile=profiles.active;if(chooseExisting){started=false;setup();if(!battle.summary?.campaignComplete){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}showProfiles();status('Campaign retired. Choose a campaign when you’re ready.');return;}}setup();begin();};
function pause(force,reason){if(!started||battle.summary||battle.outcome)return;const next=typeof force==='boolean'?force:!battle.paused;if(!next&&(hubOpen||openPanelId||!$('#restartConfirm').classList.contains('hidden')))return;battle.paused=next;clearInput();if(reason)pauseMessage=reason;else if(next)pauseMessage='Take your time. Your battlefield is frozen.';now=performance.now();syncPause();if(!next){cancelPendingImport();canvas.focus?.();status('Battle resumed');}else if(!openPanelId)$('#resumeGame').focus?.();}
function displayModeMessage(text){pauseMessage=text;status(text);syncPause();}
$('#toggleFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#gameShell').requestFullscreen)await $('#gameShell').requestFullscreen();else displayModeMessage('Full screen is unavailable here. Turn your device for landscape play.');}catch{displayModeMessage('Full screen could not open. Landscape play still works in the browser.');}};
 document.addEventListener('fullscreenchange',()=>{clearInput();pause(true,'Display mode changed. Resume when you’re ready.');$('#toggleFullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';visualDirty=true;});
 window.addEventListener('orientationchange',()=>{clearInput();pause(true,'The battlefield rotated. Resume when you’re ready.');visualDirty=true;});
 window.addEventListener('resize',()=>{const drawing=aimPointerId!==null;clearInput();if(drawing)status('View changed · draw again');visualDirty=true;});
 $('#battlePause').onclick=()=>pause();$('#resumeGame').onclick=()=>pause(false);
$('#introArmory').onclick=shop;$('#introArmy').onclick=()=>{loadoutReturnPanel=null;panel('#queuePanel',true);renderQueue();};$('#introSave').onclick=()=>showCampaignVault();
$('#introProfiles').onclick=()=>showProfiles();$('#introSettings').onclick=showSettings;$('#introLoad').onclick=()=>$('#loadGame').onclick();
$('#showAssist').addEventListener('change',event=>{$('#battleFire').classList[event.target.checked?'remove':'add']('hidden');visualDirty=true;});
$('#soundToggle').onclick=async()=>{try{const on=await audio.toggle();$('#soundToggle').textContent=on?'Sound: on':'Sound: off';}catch{status('Audio is unavailable in this browser');}};
function queuePlayerShot(aim,skill=battle.activeSkill){if(aim?.canFire&&!battle.queuePlayerShot(aim,skill))status('Shot queue is full');}
function fire(){const r=angle*Math.PI/180,o=battle.hero.launchPosition,speed=profile.shootingMode==='point_aim'?25*power/100:22.8*power/100;const aim=profile.shootingMode==='classic'||profile.shootingMode==='anywhere'?aimVector(o,{x:o.x-180*power/100*Math.cos(r),y:o.y+180*power/100*Math.sin(r)}):{vx:Math.cos(r)*speed,vy:-Math.sin(r)*speed,canFire:true};queuePlayerShot(aim);}
$('#battleFire').onclick=()=>{if(!started||battle.paused||battle.outcome||openPanelId)return;fire();canvas.focus?.();};$('#applyAim').onclick=()=>{updatePowerMode();closePrecision();};$('#activate').onclick=()=>{if(!started||battle.paused||battle.outcome||openPanelId)return;activationPulse=1;battle.input.space=true;canvas.focus?.();};
function syncAimSettings(){const auto=$('#aimMode').value==='auto_aim';$('#trajectory').disabled=!auto;}
function renderArcControl(){
 const button=$('#liveArc'),auto=profile.shootingMode==='auto_aim',high=Number(battle?.shooter?.angleMode)===0;
 button.classList[auto?'remove':'add']('hidden');button.disabled=!started||battle.paused||!!battle.outcome||!!battle.summary||!!openPanelId;
 $('#liveArcLabel').textContent=high?'High arc':'Low arc';button.setAttribute('aria-pressed',String(high));
 button.setAttribute('aria-label',`${high?'High':'Low'} arc selected. Switch to ${high?'low':'high'} arc. Shortcut V.`);
 button.setAttribute('title',`Switch to ${high?'low':'high'} arc · V`);
}
function toggleLiveArc(){
 if(profile.shootingMode!=='auto_aim'||!started||battle.paused||battle.outcome||battle.summary||openPanelId)return;
 // Only the live solver preference changes. Released shot intents and flying
 // projectiles retain the velocity and local gravity captured when fired.
 battle.shooter.angleMode=Number(battle.shooter.angleMode)===0?1:0;
 $('#trajectory').value=String(battle.shooter.angleMode);visualDirty=true;drawHotbar();
 status(`${battle.shooter.angleMode===0?'High':'Low'} arc selected`);canvas.focus?.();
}
$('#liveArc').onclick=toggleLiveArc;
function updatePowerMode(){syncAimSettings();const alternate=profile.shootingMode==='point_aim'||profile.shootingMode==='auto_aim';$('#battlePower').min=alternate?'50':'23';if(alternate&&power<50){power=50;$('#battlePower').value='50';}if(battle?.shooter){battle.shooter.maxPointerY=Infinity;battle.shooter.powerPercent=power;battle.shooter.angleMode=Number($('#trajectory').value??1);}$('#battlePowerOut').textContent=power+'%';}
for(const key of ['Angle','Power'])$('#battle'+key).addEventListener('input',()=>{angle=Number($('#battleAngle').value);power=Number($('#battlePower').value);$('#battleAngleOut').textContent=angle+'°';updatePowerMode();});
$('#aimMode').addEventListener('change',syncAimSettings);
$('#trajectory').addEventListener('change',()=>{if(!$('#trajectory').disabled)battle.shooter.angleMode=Number($('#trajectory').value);});
const point=event=>{const r=canvas.getBoundingClientRect();if(aimCamera&&(aimCamera.width!==r.width||aimCamera.height!==r.height)){clearInput();status('View changed · draw again');return null;}const camera=measureScene(r);return camera.renderable?screenToWorld(camera,{x:event.clientX-r.left,y:event.clientY-r.top}):null;};
function launchRingRadius(){return Math.max(69.2,22/worldCamera.scale);}
function pointerInput(p){battle.input.pointerX=p.x;battle.input.pointerY=p.y;}
// One accepted pointer owns a draw. A second finger can use the HUD without
// changing the held bow or releasing another finger's shot.
canvas.addEventListener('pointerdown',event=>{
 if(!started||battle.paused||battle.outcome||aimPointerId!==null||event.button!==0)return;
 const p=point(event);if(!p)return;const o=battle.hero.launchPosition;
 if(profile.shootingMode==='classic'&&Math.hypot(p.x-o.x+.3,p.y-o.y+.3)>launchRingRadius()){status('Begin inside the ring, then pull back to aim');return;}
 $('#hudToast').classList.add('hidden');toastUntil=0;aimGuideVisible=true;aimPressPoint={...p};aimCamera=worldCamera;aimPointerId=event.pointerId;canvas.focus?.();pointerInput(p);battle.input.mouseDown=true;
 canvas.setPointerCapture(event.pointerId);if(['point_aim','auto_aim'].includes(profile.shootingMode)){battle.shooter.origin=o;battle.shooter.step();battle.shooter.intentSkill=battle.activeSkill;}battle.shooter.press(p);
 // Modern input adaptation: capture the accepted press before a fast move can
 // replace it at the next 33 Hz sample. Source controller algebra is unchanged.
 if(profile.shootingMode==='classic'||profile.shootingMode==='anywhere'){
  battle.shooter.origin=o;battle.shooter.step();
 }
 visualDirty=true;event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{if(aimPointerId!==null&&event.pointerId!==aimPointerId)return;const p=point(event);if(!p)return;aimGuideVisible=started&&!battle.paused&&!battle.outcome;pointerInput(p);battle.shooter.move(p);visualDirty=true;});
canvas.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&aimPointerId===null){aimGuideVisible=false;visualDirty=true;}});
function finishAim(event,cancel=false){if(event.pointerId!==aimPointerId)return;if(cancel){aimGuideVisible=false;aimPressPoint=null;aimCamera=null;}aimPointerId=null;battle.input.mouseDown=false;if(cancel){battle.cancelPlayerShots();battle.shooter.cancel();}else{
 const released=point(event);if(!released){aimCamera=null;aimPressPoint=null;battle.shooter.cancel();return;}
 pointerInput(released);battle.shooter.move(released);visualDirty=true;
 // Browser taps can start and end between 33 Hz samples. Retain one accepted
 // point/auto attempt at the UI boundary; the aiming formulas remain unchanged.
 if(['point_aim','auto_aim'].includes(profile.shootingMode)&&!battle.shooter.fired){battle.shooter.origin=battle.hero.launchPosition;const tap=battle.shooter.step();if(tap)queuePlayerShot(tap,battle.shooter.intentSkill??battle.activeSkill);delete battle.shooter.intentSkill;}
 else if(['classic','anywhere'].includes(profile.shootingMode)&&aimPressPoint){
  // Retain both ends of a browser flick even if no33Hz held sample occurred.
  // This updates only the controller, not world time or the launch formula.
  battle.shooter.origin=battle.hero.launchPosition;
  if(!battle.shooter.active){battle.shooter.move(aimPressPoint);battle.shooter.step();}
  battle.shooter.move(released);battle.shooter.step();
 }
 battle.shooter.release(released);
 // Retain this exact release sample before another press/hover can replace it.
 // The next normal world tick still owns projectile creation and cooldown use.
 if(profile.shootingMode==='classic'||profile.shootingMode==='anywhere'){
  const releasedAim=battle.shooter.step();if(releasedAim)queuePlayerShot(releasedAim);
 }
 aimPressPoint=null;aimCamera=null;
 }}
canvas.addEventListener('pointerup',event=>finishAim(event));
canvas.addEventListener('pointercancel',event=>finishAim(event,true));
canvas.addEventListener('lostpointercapture',event=>finishAim(event,true));
document.addEventListener('pointerup',event=>finishAim(event));
const keyMap={a:'left',d:'right',w:'up',s:'down'};
document.addEventListener('keydown',event=>{
 const key=event.key.toLowerCase(),digitSlot=eventToSlot(event);
 if(key==='escape'){if(event.repeat){event.preventDefault();return;}if(!$('#switchSessionConfirm').classList.contains('hidden'))cancelSessionSwitch();else if(!$('#restartConfirm').classList.contains('hidden'))$('#cancelRestart').onclick();else if(openPanelId){if(openPanelId==='#shopPanel'&&armoryCatalog.back()){}else if(openPanelId==='#skillsPanel')closeLoadout();else if(openPanelId==='#aimPanel')closePrecision();else if(openPanelId===loadoutReturnPanel)closeChildPanel(openPanelId);else panel(openPanelId,false);}else if(document.fullscreenElement){clearInput();pause(true,'Leaving full screen. Resume when you’re ready.');Promise.resolve(document.exitFullscreen?.()).catch(()=>displayModeMessage('Full screen could not close. Use the browser’s exit control.'));}else if(started&&!battle.outcome&&!hubOpen)pause();event.preventDefault();return;}
 const modal=!$('#switchSessionConfirm').classList.contains('hidden')?$('#switchSessionConfirm'):openPanelId?$(openPanelId):!$('#restartConfirm').classList.contains('hidden')?$('#restartConfirm'):!$('#pauseOverlay').classList.contains('hidden')?$('#pauseOverlay'):!$('#intro').classList.contains('hidden')?$('#intro'):!$('#ending').classList.contains('hidden')?$('#ending'):null;
 if(key==='tab'&&modal?.querySelectorAll){const items=[...modal.querySelectorAll('button:not(:disabled),input,select,a[href],[tabindex="0"]')].filter(n=>n.getClientRects().length);if(items.length){const i=items.indexOf(document.activeElement);if(event.shiftKey&&(i<=0)){items.at(-1).focus();event.preventDefault();}else if(!event.shiftKey&&(i<0||i===items.length-1)){items[0].focus();event.preventDefault();}}return;}
 if(['INPUT','SELECT','TEXTAREA'].includes(event.target?.tagName)||event.target?.isContentEditable||event.target?.closest?.('[contenteditable="true"]'))return;
 if(key==='p'&&!event.repeat&&!openPanelId){pause();event.preventDefault();return;}
 if(!started||battle.paused||battle.outcome||modal)return;
 if(key==='g'||key==='v'){
  if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  if(key==='g')companionUI.act();else toggleLiveArc();
  event.preventDefault();return;
 }
 if((key==='['||key===']')&&!event.repeat){cycleBar(key==='['?-1:1);event.preventDefault();return;}
 if(keyMap[key]){movementOwners.keyDown(key,keyMap[key]);event.preventDefault();}
 if(digitSlot!==null){
  // Capture the edge too: a short tap can begin and end between 33 Hz ticks.
  // The existing adapter makes bow selection immediate and retains summon
  // identity if the player changes pages before the engine consumes it.
  if(!event.repeat){const skill=battle.hotbar.bars[battle.hotbar.bar]?.[digitSlot];if(skill)chooseSkill(skill.id);}
  battle.input.digits=[...new Set([...(battle.input.digits??[]),digitSlot])];event.preventDefault();
 }
 if(event.code==='Space'&&event.target?.tagName!=='BUTTON'){heldSpace=true;battle.input.space=true;event.preventDefault();}
});
document.addEventListener('keyup',event=>{const key=event.key.toLowerCase(),digitSlot=eventToSlot(event);if(keyMap[key])movementOwners.keyUp(key);if(digitSlot!==null)battle.input.digits=(battle.input.digits??[]).filter(n=>n!==digitSlot);if(event.code==='Space'){heldSpace=false;battle.input.space=activationPulse>0;}});
for(const button of document.querySelectorAll('[data-key]')){const key=button.dataset.key;if(key==='up'||key==='down')button.addEventListener('click',()=>{if(started&&!battle.paused&&!battle.outcome&&!openPanelId)movementTap=key;});button.addEventListener('pointerdown',event=>{if(!started||battle.paused||battle.outcome||openPanelId)return;movementOwners.pointerDown(event.pointerId,key,button);button.setPointerCapture(event.pointerId);event.preventDefault();});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>movementOwners.pointerEnd(e.pointerId,button));}
canvas.addEventListener('wheel',event=>{if(started&&!battle.paused){battle.hotbar.wheelEvent(-event.deltaY);event.preventDefault();}},{passive:false});
function cycleBar(direction=1){if(!started||battle.paused||battle.outcome||openPanelId)return;battle.hotbar.change(direction);battle.activeSkill=battle.hotbar.active;drawHotbar();canvas.focus?.();}
$('#nextBar').onclick=()=>cycleBar(1);$('#nextBar').setAttribute('title','Next skill bar · ] or mouse wheel');
window.addEventListener('blur',()=>{clearInput();pause(true,'The battlefield lost focus. Resume when you’re ready.');});
document.addEventListener('visibilitychange',()=>{now=performance.now();clearInput();if(document.hidden&&started&&!battle.paused)pause(true,'You left the battlefield. Tap Resume when you’re ready.');else syncPause();});
function chooseSkill(id){
 const ref=boundSkillRefs(battle.hotbar).find(ref=>ref.id===id);if(!ref||!liveSkills.choose(ref.skill))return;
 status(SKILLS[id].summon?SKILLS[id].name+' summon requested':SKILLS[id].name+' selected');
 drawHotbar();canvas.focus?.();
}
function currentAutoAimFeedback(){
 if(profile.shootingMode!=='auto_aim'||!aimGuideVisible||!started||battle.paused||battle.outcome||openPanelId)return null;
 return autoAimFeedback(battle.hero.launchPosition,battle.shooter.guide??battle.shooter.pointer,battle.shooter);
}
function drawHotbar(){
 companionUI.renderLive();
 renderArcControl();
 const state=liveBarState(battle.hotbar,SKILLS),items=state.entries;
 if(state.signature!==barSignature){
  $('#hotbar').innerHTML=items.map(({skill,id,slot})=>`<button id="quick-${id}" class="live-slot" data-hud-surface data-hud-control="primary" aria-label="${SKILLS[id].name}" title="${SKILLS[id].name}"><span class="live-key" aria-hidden="true">${slotToKey(slot)}</span><span class="skill-icon" aria-hidden="true">${skillIcon(id)}</span><span class="live-short-name">${shortNames[id]??SKILLS[id].name}</span><span class="live-countdown hidden" id="quick-cd-${id}" aria-hidden="true"></span><span class="live-cooldown-fill" id="quick-fill-${id}" aria-hidden="true"></span><span class="live-auto hidden" id="quick-auto-${id}" aria-hidden="true"></span></button>`).join('');
  for(const {id} of items)$('#quick-'+id).onclick=()=>chooseSkill(id);
  $('#hotbar').setAttribute('style',`--live-columns:${state.portraitColumns}`);
  barSignature=state.signature;
 }
 const canAct=started&&!openPanelId&&!battle.paused&&!battle.outcome;
 $('.live-action-bar').dataset.livePages=String(state.populatedBars.length);$('.live-action-bar').setAttribute('aria-label',`Equipped skills, bar ${state.bar+1} of 3`);
 $('#barLabel').textContent=state.label;$('#nextBar').setAttribute('aria-label',state.cycleLabel);$('#nextBar').classList[state.canCycle?'remove':'add']('hidden');$('#nextBar').disabled=!canAct;
 $('.live-hud').dataset.armyPage=String(state.currentHasSummons);$('#liveArmyResources').classList[state.currentHasSummons?'remove':'add']('hidden');$('#liveArmyResources').textContent=`${Math.floor(profile.gold)} gold · Army slots ${battle.regularArmyCount}/${battle.friendlyQueue.cap} · Reserve ${battle.friendlyQueue.population} · Queue ${battle.friendlyQueue.queue.length}`;
 for(const {skill,id,slot} of items){const button=$('#quick-'+id),info=liveSlotStatus(skill,SKILLS,profile,battle.friendlyQueue);button.disabled=!canAct;button.setAttribute('aria-pressed',String(skill===battle.activeSkill));button.setAttribute('aria-label',`${info.ariaLabel}, key ${slotToKey(slot)}`);button.dataset.affordable=String(info.affordable);button.dataset.cooling=String(info.remainingSeconds>0);button.dataset.kind=SKILLS[id].summon?'army':'bow';$('#quick-cd-'+id).textContent=info.remainingSeconds?`${info.remainingSeconds}s`:'';$('#quick-cd-'+id).classList[info.remainingSeconds?'remove':'add']('hidden');$('#quick-fill-'+id).style.width=`${100*info.fraction}%`;$('#quick-auto-'+id).classList[skill.autocast?'remove':'add']('hidden');}
 updateCombatHud(battle,{aiming:aimPointerId!==null,angle,power,autoAimStatus:currentAutoAimFeedback()});
}
let loadoutFilter='all',bindingArmed=false,bindingMessage='';
const bindingLabel=binding=>binding<0?'Reserve':`Bar ${Math.floor(binding/10)+1} · key ${slotToKey(binding%10)}`;
function renderAbilityFilters(id,active,entries,onChoose){
 $(id).innerHTML=ABILITY_CATEGORIES.map(([key,label])=>`<button data-ability-filter="${key}" aria-pressed="${key===active}">${label}<span>${entries.filter(([entry])=>key==='all'||abilityCategory(entry,SKILLS)===key).length}</span></button>`).join('');
 for(const button of $(id).querySelectorAll('button'))button.onclick=()=>onChoose(button.getAttribute('data-ability-filter'));
}
function selectLoadoutAbility(wrapper,focusId){
 selectedWrapper=wrapper;bindingArmed=true;bindingMessage='';drawOwnedSkills();if(focusId)$('#'+focusId)?.focus?.();
}
function drawOwnedSkills(){
 companionUI.renderLoadout();
 if(!bindingLayout||bindingLayout.closed)return;
 const wrappers=bindingLayout.dragIcons;selectedWrapper=wrappers.includes(selectedWrapper)?selectedWrapper:wrappers[0];
 $('#skillsResources').textContent=`${Math.floor(profile.gold).toLocaleString()} gold · ${wrappers.length} owned · ${bindingLayout.pending.length} unequipped`;
 renderAbilityFilters('#loadoutFilters',loadoutFilter,wrappers.map(w=>[w.skill.id]),key=>{loadoutFilter=key;drawOwnedSkills();$('#loadoutFilters').querySelector(`[data-ability-filter="${key}"]`)?.focus?.();});
 const visible=wrappers.filter(w=>loadoutFilter==='all'||abilityCategory(w.skill.id,SKILLS)===loadoutFilter);
 $('#inventoryCount').textContent=`${visible.length} abilities`;
 $('#ownedSkillList').innerHTML=visible.length?visible.map(w=>`<button id="owned-${w.skill.id}" class="ability-card" data-drag-ability="${w.skill.id}" aria-pressed="${w===selectedWrapper&&bindingArmed}" aria-label="${SKILLS[w.skill.id].name}, rank ${w.skill.rank}, ${bindingLabel(w.binding)}. Select to arrange."><span class="skill-icon" aria-hidden="true">${skillIcon(w.skill.id)}</span><span class="ability-card-copy">${SKILLS[w.skill.id].name}<small>${bindingLabel(w.binding)}</small></span><span class="ability-drag-handle" data-drag-handle="true" aria-hidden="true">⠿</span></button>`).join(''):'<p class="inventory-empty">No owned abilities in this category.</p>';
 for(const wrapper of visible)$('#owned-'+wrapper.skill.id).onclick=()=>selectLoadoutAbility(wrapper,'owned-'+wrapper.skill.id);
 const skill=selectedWrapper?.skill;
 $('#selectedSkillName').textContent=skill?SKILLS[skill.id].name:'No ability selected';$('#selectedSkillIcon').innerHTML=skill?skillIcon(skill.id):'';$('#selectedSkillDescription').textContent=skill?descriptions[skill.id]:'';
 $('#selectedSkillDetails').textContent=skill?`Rank ${skill.rank} · ${Math.ceil(SKILLS[skill.id].cooldown/66)}s reload · ${bindingLabel(selectedWrapper.binding)}`:'';
 $('#slotInstruction').textContent=bindingArmed&&skill?`${SKILLS[skill.id].name} selected. Choose a destination below.`:'Drag to rearrange, or tap an ability then a slot.';
 $('#bindingGrid').setAttribute('aria-label',`Bar ${editorBar+1}, keys 1 through 9, then 0`);
 $('#bindingGrid').innerHTML=bindingLayout.slots.slice(editorBar*10,editorBar*10+10).map(slot=>{const w=slot.holding,id=w?.skill.id,key=slotToKey(slot.index%10);const action=bindingArmed?(w===selectedWrapper?'Cancel selection':w?(selectedWrapper.binding<0?`Replace ${SKILLS[id].name}; return it to reserve`:`Swap with ${SKILLS[id].name}`):'Move selected ability here'):(w?'Select to move':'Choose an ability first');return `<button id="assign-${slot.index}" class="loadout-slot" data-drop-slot="${slot.index}" ${id?`data-drag-ability="${id}" data-drag-handle="true"`:''} data-current="${w===selectedWrapper&&bindingArmed}" data-empty="${!w}" aria-label="Bar ${editorBar+1}, key ${key}, ${id?SKILLS[id].name:'empty'}. ${action}"><span class="loadout-slot-key" aria-hidden="true">${key}</span><span class="skill-icon" aria-hidden="true">${id?skillIcon(id):'+'}</span><span class="loadout-slot-label">${id?(shortNames[id]??SKILLS[id].name):'Empty'}</span></button>`;}).join('');
 for(const slot of bindingLayout.slots.slice(editorBar*10,editorBar*10+10))$('#assign-'+slot.index).onclick=()=>{if(bindingArmed)moveBinding(slot.index);else if(slot.holding)selectLoadoutAbility(slot.holding,'assign-'+slot.index);else{$('#bindingStatus').textContent='Choose an ability from Your abilities first.';}};
 for(const button of document.querySelectorAll('[data-loadout-bar]'))button.setAttribute('aria-pressed',String(Number(button.getAttribute('data-loadout-bar'))===editorBar));
 $('#unbindSkill').disabled=!selectedWrapper||selectedWrapper.binding<0;$('#cancelBinding').classList[bindingArmed?'remove':'add']('hidden');
 $('#bindingStatus').textContent=bindingMessage||'Occupied slots swap. Reserve abilities stay owned.';
}
const loadoutDrag=createLoadoutDrag({root:$('#skillsPanel'),
 getAbility:id=>bindingLayout?.dragIcons.some(w=>w.skill.id===id)?{name:SKILLS[id].name,icon:skillIcon(id)}:null,
 onStart:id=>{selectedWrapper=bindingLayout.dragIcons.find(w=>w.skill.id===id);bindingArmed=true;},
 onHint:(id,index)=>{const w=bindingLayout.dragIcons.find(w=>w.skill.id===id),target=index===null?null:bindingLayout.slots[index]?.holding;$('#slotInstruction').textContent=index===null?'Drop on a slot. Release outside to cancel.':target===w?'Return to the same slot':target?`${w.binding<0?'Replace':'Swap with'} ${SKILLS[target.skill.id].name}${w.binding<0?' · it returns to reserve':''}`:`Move to ${bindingLabel(index)}`;},
 onDrop:(id,index)=>{selectedWrapper=bindingLayout.dragIcons.find(w=>w.skill.id===id);moveBinding(index);},
 onCancel:()=>{bindingArmed=false;bindingMessage='Move cancelled. Your action bar is unchanged.';drawOwnedSkills();},
 onBar:bar=>{editorBar=bar;drawOwnedSkills();}
});
function showSkills(){
 if(openPanelId==='#shopPanel')armoryReturnFromLoadout=true;
 loadoutDrag.cancel();loadoutOrigin=hubOpen?'lobby':battle.summary?'camp':started?'pause':'preparation';
 panel('#skillsPanel',true);
 const restored=recoverDuplicateBindings(profile.skills);
 const editorActive=battle.activeSkill,editorPage=battle.hotbar.bar;
 bindingLayout=new ActionBarLayout(profile.skills,{refresh:()=>{
  battle.refreshHotbar();
  const preferred=editorActive?.binding>=0?editorActive:profile.skills.find(skill=>skill.id==='arrow'&&skill.binding>=0)??battle.hotbar.bars[editorPage]?.find(Boolean)??battle.hotbar.active;
  if(preferred&&battle.hotbar.bars[Math.floor(preferred.binding/10)]?.[preferred.binding%10]===preferred){battle.hotbar.bar=Math.floor(preferred.binding/10);battle.hotbar.glow=preferred.binding%10;battle.hotbar.active=preferred;battle.activeSkill=preferred;}
 }});selectedWrapper=bindingLayout.dragIcons.find(w=>w.skill===battle.activeSkill)??bindingLayout.dragIcons[0];editorBar=selectedWrapper?.binding>=0?Math.floor(selectedWrapper.binding/10):0;bindingArmed=false;
 bindingMessage=restored.length?`${restored.map(skill=>SKILLS[skill.id].name).join(', ')} restored to reserve from overlapping saved slots. Choose a slot to equip.`:'';
 $('#loadoutStage').textContent=loadoutOrigin==='lobby'?(started&&!battle.summary?'BATTLE PAUSED · LOBBY':'PLAYER LOBBY'):loadoutOrigin==='pause'?'BATTLE PAUSED':loadoutOrigin==='camp'?'ARMORY & LOADOUT':'PREPARE FOR BATTLE';
 $('#closeSkills').textContent=armoryReturnFromLoadout?'Back to armory':loadoutOrigin==='pause'?'Back to Pause':loadoutOrigin==='camp'?'Back to results':loadoutOrigin==='lobby'?'Back to lobby':'Back';$('#closeSkills').setAttribute('aria-label',$('#closeSkills').textContent);
 $('#loadoutContinue').textContent=loadoutOrigin==='lobby'?(started&&!battle.summary?`Resume battle ${battle.level}`:battle.summary?.campaignComplete?'Back to lobby':`${battle.summary?.outcome==='defeat'?'Retry':'Start'} battle ${battle.summary?.outcome==='victory'?battle.level+1:battle.level}`):loadoutOrigin==='pause'?'Done':battle.summary?.campaignComplete?'Back to results':battle.summary?.outcome==='defeat'?`Retry battle ${battle.level}`:`Begin battle ${battle.summary?battle.level+1:battle.level}`;
 $('#loadoutArmory').classList[!battle.summary?.campaignComplete?'remove':'add']('hidden');drawOwnedSkills();
}
function closeLoadout(returnToOrigin=true){const returnToArmory=returnToOrigin!==false&&armoryReturnFromLoadout;armoryReturnFromLoadout=false;loadoutDrag.cancel();panel('#skillsPanel',false);drawHotbar();if(returnToArmory&&!battle.summary?.campaignComplete)shop();}
for(const id of ['#pauseSkills','#introLoadout','#endingLoadout'])$(id).onclick=()=>{armoryReturnFromLoadout=false;showSkills();};$('#shopLoadout').onclick=showSkills;
$('#closeSkills').onclick=closeLoadout;
$('#loadoutContinue').onclick=()=>{const origin=loadoutOrigin;closeLoadout(false);if(origin==='lobby'){selectedDestination=activeDestination;startFromHub();return;}if(origin==='pause'||battle.summary?.campaignComplete)return;if(battle.summary)$('#replay').onclick();else begin();};
$('#loadoutArmory').onclick=shop;
for(const button of document.querySelectorAll('[data-loadout-bar]'))button.onclick=()=>{editorBar=Number(button.getAttribute('data-loadout-bar'));drawOwnedSkills();};
function moveBinding(slot){
 if(!selectedWrapper||!bindingLayout||bindingLayout.closed)return;
 const result=placeLoadoutAbility(bindingLayout,selectedWrapper,slot);if(!result)return;
 const name=SKILLS[selectedWrapper.skill.id].name,other=result.displaced?SKILLS[result.displaced.skill.id].name:'';
 bindingMessage=result.kind==='unchanged'?`${name} stays in ${bindingLabel(slot)}.`:result.kind==='swap'?`${name} and ${other} swapped places.`:result.kind==='replace'?`${name} equipped. ${other} is now in reserve.`:result.kind==='reserve'?`${name} moved to reserve. It is still owned.`:`${name} moved to ${bindingLabel(slot)}.`;
 bindingArmed=false;drawOwnedSkills();barSignature='';$(slot<0?'#unbindSkill':'#assign-'+slot)?.focus?.();
}
$('#unbindSkill').onclick=()=>moveBinding(-1);
$('#cancelBinding').onclick=()=>{bindingArmed=false;bindingMessage='Selection cancelled. Your action bar is unchanged.';drawOwnedSkills();};
let precisionReturnPanel=null;
function closePrecision(){const back=precisionReturnPanel;precisionReturnPanel=null;if(back){panel(back,true);$('#openAim').focus?.();}else panel('#aimPanel',false);}
$('#openAim').onclick=()=>{precisionReturnPanel=openPanelId==='#settingsPanel'?'#settingsPanel':null;panel('#aimPanel',true);};$('#closeAim').onclick=closePrecision;
function showSettings(){$('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;syncAimSettings();panel('#settingsPanel',true);}
function panel(id,show){if(show){cancelPendingImport();if(openPanelId==='#skillsPanel'&&id!=='#skillsPanel'&&bindingLayout&&!bindingLayout.closed){loadoutDrag.cancel();bindingLayout.close();}if(!openPanelId){panelFocus=document.activeElement;panelResume=started&&!battle.paused&&!battle.outcome;}for(const other of ['#settingsPanel','#profilesPanel','#shopPanel','#testingPanel','#queuePanel','#savePanel','#skillsPanel','#aimPanel'])if(other!==id)$(other)?.classList.add('hidden');$(id).classList.remove('hidden');openPanelId=id;pause(true);syncPause();focusPanel(id);}else{if(id==='#skillsPanel'&&bindingLayout&&!bindingLayout.closed)bindingLayout.close();if(id==='#savePanel')cancelPendingImport();$(id).classList.add('hidden');if(openPanelId===id){openPanelId=null;if(panelResume)pause(false);panelResume=false;syncPause();if(hubOpen){renderHub();$('#start').focus?.();}else if(battle.paused)$('#resumeGame').focus?.();else if(panelFocus?.getClientRects?.().length&&!panelFocus.disabled)panelFocus.focus?.();else if(!$('#ending').classList.contains('hidden'))$('#replay').focus?.();else if(!$('#intro').classList.contains('hidden'))$('#start').focus?.();else canvas.focus?.();}}}
function shop(){
 if(battle.summary?.campaignComplete){status('Choose a new campaign to use the armory');return;}
 loadoutReturnPanel=openPanelId==='#skillsPanel'?'#shopPanel':null;loadoutDrag.cancel();
 panel('#shopPanel',true);$('#closeShop').textContent=loadoutReturnPanel?'Back to loadout':hubOpen?'Back to lobby':battle.summary?'Back to results':'Back to Pause';
 $('#shopContinue').textContent=hubOpen?'Back to lobby':!battle.summary?'Back to Pause':battle.summary.outcome==='victory'?`Begin battle ${battle.level+1}`:`Retry battle ${battle.level}`;
 $('#shopStage').textContent=armoryPurchasesAllowed()?'PREPARE YOUR ARSENAL':'BATTLE PAUSED';
 $('#shopStatus').textContent=armoryPurchasesAllowed()?'Unlock an ability, then arrange your loadout.':'Browse and arrange owned cards. Finish this battle before purchasing new cards.';renderShop();
}
const armoryCatalog=createArmoryCatalogUI({
 root:$('#armoryCatalogHost'),records:buildArmoryRecords(SKILLS,COMPANIONS,descriptions),
 getSnapshot:()=>({...createArmorySnapshot(profile),purchaseBlockedReason:armoryPurchasesAllowed()?null:'Finish this battle to purchase'}),icon:skillIcon,nameForId:id=>SKILLS[id]?.name??COMPANIONS[id]?.name??id,keyLabel:slotToKey,bindingLabel,announce:text=>{$('#shopStatus').textContent=text;status(text);},
 startRefined:window.matchMedia?.('(min-width:1101px) and (min-height:601px)').matches??false,
 isPortrait:()=>window.matchMedia?.('(max-width:620px) and (orientation:portrait)').matches??false,
 onPurchase:item=>{
  if(!armoryPurchasesAllowed()||openPanelId!=='#shopPanel')return false;
  const liveItem=(item.kind==='companion'?COMPANIONS:SKILLS)[item.id];
  if(!liveItem||liveItem.price!==item.price){$('#shopStatus').textContent='The card price changed. This purchase was cancelled.';return false;}
  if(item.kind==='companion'){
   if(!profile.recruitCompanion(item.id))return false;
   visualDirty=true;companionUI.renderLive();
   $('#shopStatus').textContent=`${item.name} hired and equipped in the separate companion slot.`;status(`${item.name} hired`);
  }else{
   if(!profile.purchase(item.id))return false;
   battle.refreshHotbar();barSignature='';drawHotbar();
   const skill=profile.skills.find(skill=>skill.id===item.id);
   $('#shopStatus').textContent=`${item.name} unlocked · ${bindingLabel(skill.binding)}. Arrange it in your loadout.`;status(`${item.name} unlocked`);
  }
  updateShopBalance();return true;
 },
 onEquip:(item,destination)=>{
  if(openPanelId!=='#shopPanel'||battle.summary?.campaignComplete||item.kind!=='skill'||!profile.owned.has(item.id)||!Number.isInteger(destination)||destination< -1||destination>29)return false;
  const previous=battle.activeSkill,page=battle.hotbar.bar;recoverDuplicateBindings(profile.skills);const layout=new ActionBarLayout(profile.skills);
  const wrapper=layout.dragIcons.find(w=>w.skill.id===item.id);if(!wrapper){layout.close();return false;}
  const result=placeLoadoutAbility(layout,wrapper,destination);layout.close();battle.refreshHotbar();
  const preferred=previous?.binding>=0?previous:profile.skills.find(skill=>skill.id==='arrow'&&skill.binding>=0)??battle.hotbar.bars[page]?.find(Boolean)??battle.hotbar.active;
  if(preferred&&preferred.binding>=0){battle.hotbar.bar=Math.floor(preferred.binding/10);battle.hotbar.glow=preferred.binding%10;battle.hotbar.active=preferred;battle.activeSkill=preferred;}
  barSignature='';drawHotbar();$('#shopStatus').textContent=`${item.name} · ${bindingLabel(destination)}${result.displaced?`. ${SKILLS[result.displaced.skill.id].name} · ${bindingLabel(result.displaced.skill.binding)}`:''}.`;return true;
 },
 onAutocast:(item,enabled)=>{const skill=profile.skills.find(skill=>skill.id===item.id);if(openPanelId!=='#shopPanel'||battle.summary?.campaignComplete||!skill||!SKILLS[item.id]?.summon)return false;skill.autocast=!!enabled;barSignature='';drawHotbar();$('#shopStatus').textContent=`${item.name} auto-summon ${enabled?'on':'off'}.`;return true;},
 onCompanionEquip:(item,equip)=>{if(openPanelId!=='#shopPanel'||battle.summary?.campaignComplete||battle.companions.unit||!profile.companionOwned.has(item.id))return false;profile.equipCompanion(equip?item.id:null);companionUI.renderLive();$('#shopStatus').textContent=equip?`${item.name} equipped in the companion slot.`:'Companion moved to reserve.';return true;},
 onArrange:item=>{
  if(item.kind==='companion'){showSkills();$('#companionLoadout').scrollIntoView?.({block:'nearest'});$('#equipCompanion')?.focus?.({preventScroll:true});}
  else arrangeArmoryAbility(item.id);
 }
});
function updateShopBalance(){
 $('#shopBalance').textContent=`${Math.floor(profile.gold).toLocaleString()} gold`;
 $('#shopOwnedCount').textContent=`${profile.owned.size} / ${Object.keys(SKILLS).length} abilities · ${profile.companionOwned.size} / ${Object.keys(COMPANIONS).length} companions`;
}
function renderShop(){updateShopBalance();armoryCatalog.refresh();}
function arrangeArmoryAbility(id){
 showSkills();const wrapper=bindingLayout.dragIcons.find(w=>w.skill.id===id);
 if(wrapper){selectedWrapper=wrapper;bindingArmed=true;editorBar=wrapper.binding>=0?Math.floor(wrapper.binding/10):0;loadoutFilter='all';bindingMessage=`${SKILLS[id].name} · ${bindingLabel(wrapper.binding)}. Choose a destination to rearrange.`;drawOwnedSkills();$('#owned-'+id)?.focus?.({preventScroll:true});}
}
$('#shopContinue').onclick=()=>{if(openPanelId!=='#shopPanel')return;const returnToHub=hubOpen,hasResult=!!battle.summary;loadoutReturnPanel=null;armoryReturnFromLoadout=false;panel('#shopPanel',false);if(returnToHub){renderHub();return;}if(hasResult)$('#replay').onclick();};$('#openShop').onclick=shop;$('#endingShop').onclick=shop;$('#closeShop').onclick=()=>closeChildPanel('#shopPanel');$('#openSettings').onclick=showSettings;$('#closeSettings').onclick=()=>panel('#settingsPanel',false);
$('#applySettings').onclick=()=>{battle.applyOptions({difficulty:$('#difficulty').value,shootingMode:$('#aimMode').value});updateAimGuide();updatePowerMode();panel('#settingsPanel',false);status('Settings applied. Export to keep them after closing.');};
$('#downloadSave').onclick=()=>{try{const blob=new Blob([profiles.exportBundle()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=testingMode?'bowmaster-testing.json':'bowmaster-campaign.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#vaultStatus').textContent='Download started. Check that the campaign file was saved.';$('#saveStatus').textContent='Campaign download started. Keep the downloaded file; it restarts the saved battle.';$('#endingSaveStatus').textContent='Download started. Check that your campaign file was saved.';}catch{$('#vaultStatus').textContent='Download could not start. You can show and copy a campaign code instead.';$('#saveStatus').textContent='This campaign could not be exported. Your current session is still available.';$('#endingSaveStatus').textContent='Save failed. Your session is still available; try again before leaving.';}};
function showCampaignVault(restore=false){$('#saveCode').value='';$('#saveCodeArea').classList.add('hidden');panel('#savePanel',true);$('#vaultStatus').textContent=restore?'Paste a saved code below, or choose a campaign file. Loading replaces the profiles in this tab.':'Your progress is in this tab. Keep a file or code before closing it.';if(started&&!battle.summary)$('#vaultStatus').textContent+=' Loading a campaign replaces this paused battlefield and starts the imported battle from the beginning.';if(restore)$('#loadCode').focus?.();}
$('#saveGame').onclick=()=>showCampaignVault();
$('#closeSave').onclick=()=>panel('#savePanel',false);
$('#showSaveCode').onclick=()=>{try{$('#saveCode').value=profiles.exportBundle();$('#saveCodeArea').classList.remove('hidden');$('#vaultStatus').textContent='Campaign code created. Select and copy it somewhere safe; showing it here does not save it elsewhere.';}catch{$('#vaultStatus').textContent='This campaign could not be encoded. Your current session is still available.';}};
$('#selectSaveCode').onclick=()=>{$('#saveCode').focus();$('#saveCode').select?.();$('#vaultStatus').textContent='Code selected. Copy it and keep it somewhere safe.';};
function applyCampaignText(text){profiles.importBundle(text);profile=profiles.active;started=false;setup();if(!battle.summary?.campaignComplete){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}$('#saveStatus').textContent='Campaign imported. Begin to restart its saved battle.';status('Campaign loaded');$('#introNotice').textContent='Campaign loaded. Ready to begin.';$(battle.summary?.campaignComplete?'#replay':'#start').focus?.();}
$('#importCode').onclick=()=>{cancelPendingImport();try{applyCampaignText($('#loadCode').value);}catch{$('#vaultStatus').textContent='That code is not a valid reconstruction campaign. Your current progress has been kept.';}};
$('#endingSave').onclick=()=>$('#saveGame').onclick();$('#endingProfiles').onclick=()=>showProfiles();$('#endingLoad').onclick=()=>$('#loadGame').onclick();$('#loadGame').onclick=()=>showCampaignVault(true);$('#chooseSaveFile').onclick=()=>$('#saveFile').click();
$('#saveFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 const generation=++loadGeneration;event.target.value='';
 $('#saveStatus').textContent='Reading campaign file…';$('#introNotice').textContent='Reading campaign file…';$('#endingSaveStatus').textContent='Reading campaign file…';
 try{
  if(file.size>1048576)throw new Error('too-large');
  const text=await file.text();
  // A later file choice or navigation owns the session. An older asynchronous
  // file read must never replace a newer campaign or a resumed battle.
  if(generation!==loadGeneration)return;
  applyCampaignText(text);
 }catch{
  if(generation!==loadGeneration)return;
  $('#saveStatus').textContent='That file is not a valid reconstruction save. Your current campaign has been kept.';
  $('#introNotice').textContent='That file could not be loaded. Choose a reconstruction campaign file; your current progress has been kept.';
  $('#endingSaveStatus').textContent='That file could not be loaded. Your current campaign has been kept.';
 }
});
const html=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showProfiles(){pendingDelete=null;$('#deleteConfirm').classList.add('hidden');panel('#profilesPanel',true);renderProfiles();}
function renderProfiles(){
 $('#profileSelect').innerHTML=profiles.profiles.map((p,i)=>`<option value="${i}">${html(p.name||'(unnamed)')}${p.cheated?' · assisted':''} · battle ${Math.min(30,p.highestLevel)} · rank ${p.rank}</option>`).join('');$('#profileSelect').value=String(profiles.activeIndex);
 $('#deleteProfile').disabled=profiles.profiles.length<=1;$('#createProfile').disabled=profiles.profiles.length>=9;
 $('#retiredProfiles').innerHTML=profiles.retired.length?profiles.highScores().map(p=>`<div class="record-row"><strong>${html(p.name)}${p.cheated?' · assisted':''}</strong><span>${p.gold.toLocaleString()} score · ${p.victories} wins · ${p.defeats} defeats</span></div>`).join(''):'<p class="footnote">No completed campaigns yet</p>';
 $('#profileStatus').textContent=(started&&!battle.summary?'Choosing or creating a profile replaces this paused battlefield. The selected battle starts from the beginning. ':'')+`${profiles.profiles.length} of 9 active profiles · ${profiles.retired.length} completed. Export to keep this session.`;
}
function useProfile(){profile=profiles.active;started=false;setup();if(!battle.summary?.campaignComplete){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}$('#battlePause').disabled=true;panel('#profilesPanel',false);$('#deleteConfirm').classList.add('hidden');status('Profile selected. Begin to restart its saved battle.');$(battle.summary?.campaignComplete?'#replay':'#start').focus?.();}
$('#openProfiles').onclick=showProfiles;$('#closeProfiles').onclick=()=>panel('#profilesPanel',false);
$('#switchProfile').onclick=()=>{if(profiles.select(Number($('#profileSelect').value)))useProfile();};
$('#createProfile').onclick=()=>{const name=$('#newProfileName').value;if(profiles.create(name,{shootingMode:$('#newAimMode').value||'classic'})){useProfile();$('#newProfileName').value='';}else $('#profileStatus').textContent=name===''?'Enter a profile name first':'Nine active profiles are already available';};
$('#deleteProfile').onclick=()=>{pendingDelete=profiles.profiles[Number($('#profileSelect').value)];if(!pendingDelete)return;$('#deleteConfirmText').textContent=`Remove “${pendingDelete.name}” from this session? Export first if you want to keep it.`;$('#deleteConfirm').classList.remove('hidden');};$('#cancelDelete').onclick=()=>$('#deleteConfirm').classList.add('hidden');
$('#confirmDelete').onclick=()=>{const index=profiles.profiles.indexOf(pendingDelete);if(index<0)return;profiles.select(index);pendingDelete=null;if(profiles.deleteCurrent()){profile=profiles.active;renderProfiles();useProfile();}};
function showTesting(){if(!testingMode)return;loadoutReturnPanel=openPanelId==='#skillsPanel'?'#testingPanel':null;$('#testVictory').disabled=!!battle.outcome;$('#testDefeat').disabled=!!battle.outcome;$('#testLevel').value=String(battle.level);$('#testProtection').checked=testingProtection;$('#testingStatus').textContent=`Battle ${battle.level} · ${Math.floor(profile.gold)} gold. All progress in this playground is assisted.`;panel('#testingPanel',true);}
for(const id of ['#openTesting','#introTesting','#pauseTesting','#endingTesting'])$(id).onclick=showTesting;$('#closeTesting').onclick=()=>closeChildPanel('#testingPanel');
for(const [id,amount] of [['#testGoldSmall',1000],['#testGoldLarge',10000]])$(id).onclick=()=>{if(!testingMode)return;const gold=grantTestGold(battle,amount);$('#testingStatus').textContent=`Granted ${amount.toLocaleString()} test gold. Balance: ${gold.toLocaleString()}.`;};
$('#testUnlock').onclick=()=>{if(!testingMode)return;unlockTestSkills(battle);barSignature='';drawHotbar();$('#testingStatus').textContent='All 25 abilities and Gorath unlocked and ready. Auto-summon is off so you can choose each squad.';};
$('#testReady').onclick=()=>{if(!testingMode)return;readyTestSkills(battle);drawHotbar();$('#testingStatus').textContent='Every owned ability is ready.';};
function showCollision(enabled){if(!testingMode&&!demoMode)return;testingCollision=enabled;$('#testCollision').checked=enabled;visualDirty=true;}
$('#testCollision').addEventListener('change',()=>showCollision($('#testCollision').checked));
window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==window.location.origin||event.data?.type!=='bowmaster-preview-collision'||typeof event.data.enabled!=='boolean')return;showCollision(event.data.enabled);});
$('#testProtection').addEventListener('change',()=>{if(!testingMode)return;testingProtection=$('#testProtection').checked;protectTestBattle(battle,testingProtection);$('#testingStatus').textContent=testingProtection?'Hero damage and natural defeat are disabled. Enemy combat continues.':'Ordinary damage and defeat rules restored.';});
$('#testLevelApply').onclick=()=>{if(!testingMode)return;const level=selectTestLevel(profile,Number($('#testLevel').value));started=false;setup(level);$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');$('#start').focus?.();status(`Assisted battle ${level} is ready`);};
for(const [id,outcome] of [['#testVictory','victory'],['#testDefeat','defeat']])$(id).onclick=()=>{if(!testingMode||battle.outcome)return;panel('#testingPanel',false);if(!started)begin();else{hubOpen=false;$('#intro').classList.add('hidden');pause(false);}finishTestBattle(battle,outcome);status(`Assisted ${outcome}. Finishing the normal battle summary…`);};
function renderQueue(){const queue=battle.friendlyQueue;const summons=profile.skills.filter(skill=>SKILLS[skill.id].summon);$('#armyAutoList').innerHTML=summons.length?summons.map(skill=>`<button id="armyAuto-${skill.id}" aria-pressed="${skill.autocast}">${SKILLS[skill.id].name} auto: ${skill.autocast?'on':'off'}</button>`).join(''):'<p>No troop abilities unlocked yet.</p>';for(const skill of summons)$('#armyAuto-'+skill.id).onclick=()=>{skill.autocast=!skill.autocast;renderQueue();drawHotbar();};$('#queueStatus').textContent=`Army slots ${battle.regularArmyCount}/${battle.friendlyQueue.cap} · Reserve ${queue.population} · ${queue.queue.length} queued · ${battle.goodTeam.filter(u=>u!==battle.hero&&!u.isCompanion&&u.hp>0).length} living`;$('#queueList').innerHTML=queue.queue.length?queue.queue.map((ticket,index)=>`<div class="queue-row"><span>${SKILLS[ticket.type]?.name??ticket.type} · rank ${ticket.rank??0}</span><button id="cancelQueue${index}" aria-label="Cancel queued ${SKILLS[ticket.type]?.name??ticket.type} ${index+1}">Cancel · +${ticket.cost} population</button></div>`).join(''):'<p>No reinforcements are waiting. Summon a squad from its ability button.</p>';queue.queue.forEach((ticket,index)=>{$('#cancelQueue'+index).onclick=()=>{queue.cancel(index);renderQueue();};});}
function closeChildPanel(id){const back=loadoutReturnPanel===id;loadoutReturnPanel=null;panel(id,false);if(back)showSkills();}
for(const id of ['#openQueue','#pauseQueue'])$(id).onclick=()=>{loadoutReturnPanel=openPanelId==='#skillsPanel'?'#queuePanel':null;panel('#queuePanel',true);renderQueue();};$('#closeQueue').onclick=()=>closeChildPanel('#queuePanel');

// Management navigation changes workspaces without resuming the battle.
for(const button of document.querySelectorAll('[data-menu-route]'))button.onclick=()=>{
 const route=button.getAttribute('data-menu-route'),target={loadout:'#skillsPanel',army:'#queuePanel',settings:'#settingsPanel',profiles:'#profilesPanel',vault:'#savePanel'}[route];
 if(!target||openPanelId===target)return;
 loadoutReturnPanel=null;precisionReturnPanel=null;
 if(route==='loadout')showSkills();else if(route==='army'){panel(target,true);renderQueue();}else if(route==='profiles')showProfiles();else if(route==='vault')showCampaignVault();else if(route==='settings')showSettings();else panel(target,true);
};

function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function castle(building){drawFortification(ctx,building,{scale:worldCamera.scale,tick:battle.tick,elevationAt:x=>battle.elevationAt(x)});}
function creature(unit,cloth,dark){const h=unit.height??80;if(unit.type==='gorath'){drawGorath(ctx,unit,{elevationAt:x=>battle.elevationAt(x),record:specialMotion.record(unit)});return;}
 if(unit.airUnit){const motion=specialMotion.air(unit);if(drawElementalDragon(ctx,unit,motion))return;const flap=motion.wingLift,dragon=unit.type!=='air',tint=unit.type.includes('poison')?'#a6b763':unit.type.includes('ice')?'#88c6c8':unit.type.includes('fire')?'#c7926a':cloth;poly([[37,8],[11,-10],[-6,-12],[-19,-4],[-31,0],[-28,11],[-12,10],[9,15]],tint);poly([[7,-6],[33,-37-flap],[2,-18],[-15,-35-flap],[-7,-5]],dark);line(17,11,40,19,tint,4);circle(-21,2,7,tint);circle(-23,0,2,'#ead89e');if(!dragon){circle(6,-21,5,'#d5bf91');line(6,-16,7,-5,cloth,6);}return;}
 const ice=unit.type==='ice_demon',tint=ice?'#87c1c4':'#c58155';poly([[-16,-4],[-20,-50],[-11,-69],[12,-69],[23,-49],[15,-4]],tint);poly([[-14,-65],[-23,-85],[-3,-74],[11,-72],[25,-86],[18,-63]],dark);circle(3,-63,4,'#e8dfa7');line(-10,-9,-17,0,dark,7);line(10,-9,18,0,dark,7);line(15,-45,34,-26,'#dfc780',7);}
function troop(unit){if(combatPoses.draw(ctx,unit))return;if(!Number.isFinite(unit.x)||!Number.isFinite(unit.y)||!unit.visible)return;ctx.save();ctx.translate(unit.x,unit.y);ctx.rotate((unit.collisionRotation??unit.rotation??0)*Math.PI/180);ctx.scale(unit.facing??1,1);const good=unit.team==='good',cloth=good?'#7eb0c5':'#c98465',dark=good?'#304a55':'#633c2d',metal='#c7c7a8';if((unit.airUnit||unit.type==='gorath')&&unit.hp<=0){ctx.globalAlpha=.65;creature(unit,cloth,dark);ctx.restore();return;}if(unit.hp<=0){ctx.globalAlpha=.75;line(-18,-5,18,-2,cloth,7);circle(20,-7,5,'#d2bc8f');ctx.restore();return;}if(unit.airUnit||['gorath','fire_demon','ice_demon'].includes(unit.type)){creature(unit,cloth,dark);ctx.restore();ctx.fillStyle=cloth;ctx.fillRect(unit.x-25,unit.y-unit.height-12,50*Math.max(0,unit.hp/unit.maxHp),4);return;}const phase=(unit.animation?.frame??0)*.7,walk=unit.actionMode==='move'?Math.sin(phase):0;
 if(unit.type==='trebuchet'){const pose=specialMotion.siege(unit);line(-38,-11,38,-11,dark,7);circle(-25,-3,9,'#a6966b');circle(27,-3,9,'#a6966b');line(-14,-13,pose.pivot.x,pose.pivot.y,'#bcaa76',6);line(24,-12,pose.pivot.x,pose.pivot.y,'#bcaa76',6);line(pose.weight.x,pose.weight.y,pose.tip.x,pose.tip.y,'#d7bd82',6);circle(pose.pivot.x,pose.pivot.y,4,metal);ctx.fillStyle=dark;ctx.fillRect(pose.weight.x-8,pose.weight.y-5,16,13);if(pose.loaded)circle(pose.tip.x,pose.tip.y,6,'#615e51');ctx.restore();return;}
 if(unit.type==='mount'){ctx.fillStyle=good?'#bdad85':'#a28b66';ctx.beginPath();ctx.ellipse(0,-20,25,11,0,0,Math.PI*2);ctx.fill();line(-15,-18,-20+walk*5,0,dark,5);line(15,-18,21-walk*5,0,dark,5);poly([[18,-23],[31,-44],[39,-40],[31,-18]],'#b7a079');circle(1,-52,6,'#e0c89b');poly([[-8,-46],[8,-46],[10,-27],[-7,-28]],cloth);line(6,-41,26,-51,metal,3);ctx.restore();return;}
 const tall=unit.type==='tallGrunt',height=unit.type==='hero'?55:tall?60:unit.type==='priest'?36:unit.type==='archer'?40:43,headY=-height+7;
 circle(0,headY,6,tall?metal:'#dac297');poly([[-8,headY+7],[8,headY+7],[11,-14],[-10,-14]],cloth);line(-5,-14,-8+walk*4,0,dark,4);line(5,-14,8-walk*4,0,dark,4);
 if(unit.type==='priest'){poly([[-9,headY+6],[0,headY-10],[9,headY+6]],'#d1c798');line(12,-6,12,-49,'#d6c693',3);circle(12,-50,4,'#d6dfaa');}
 else if(unit.type==='archer'||unit.type==='hero'){ctx.strokeStyle='#e0c78e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(11,-25,14,-1.1,1.1);ctx.stroke();line(17,-37,17,-13,'#e6debd',1);line(3,-28,15,-27,metal,3);}
 else{line(5,-25,17,-29,metal,3);line(18,-13,19,-46,dark,3);if(tall)poly([[19,-47],[30,-46],[29,-32],[19,-33]],metal);else line(19,-45,19,-24,metal,3);circle(-12,-22,tall?10:7,dark);}
 ctx.restore();if(unit!==battle.hero){ctx.fillStyle='#253124';ctx.fillRect(unit.x-14,unit.y-height-11,28,3);ctx.fillStyle=good?'#94c7cc':'#d29a78';ctx.fillRect(unit.x-14,unit.y-height-11,28*unit.hp/unit.maxHp,3);}}
function drawArrow(projectile){const pose=projectile.draw??projectile;if(!Number.isFinite(pose.x)||!Number.isFinite(pose.y))return;ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle??projectile.angle??0);const kind=projectile.kind??'',tint=kind.includes('ice')||kind.includes('comet')?'#a5e1e3':kind.includes('fire')||kind.includes('meteor')?'#f3b263':kind.includes('poison')?'#c4d67e':kind.includes('thunder')?'#e7e6a8':'#f2ddb0';if(kind.endsWith('_wave_arrow')){ctx.scale(Math.max(1,Math.min(2.5,.55/worldCamera.scale)),Math.max(1,Math.min(2.5,.55/worldCamera.scale)));circle(0,0,8,'#17272b');circle(0,0,6,tint);line(-15,0,-6,0,tint+'99',4);poly([[0,-9],[4,-3],[9,0],[4,3],[0,9],[-3,3],[-7,0],[-3,-3]],tint);circle(0,0,2,'#fff5d8');}else if(['meteor','comet','fire_ball','ice_ball'].includes(kind)){circle(0,0,kind==='meteor'||kind==='comet'?15:7,tint);line(-8,0,-36,0,tint+'80',5);}else if(kind==='trebuchet_ammo')circle(0,0,5,'#4b4737');else{const glyphScale=Math.max(1,Math.min(2.5,.38/worldCamera.scale));ctx.scale(glyphScale,glyphScale);const strokeScale=worldCamera.scale*glyphScale;line(-18,0,6,0,'#17272b',2.7/strokeScale);line(-18,0,6,0,tint,1.2/strokeScale);poly([[8,0],[0,-3],[0,3]],'#eee0b9');line(-15,0,-21,-4,'#dbc391',1.2/strokeScale);}ctx.restore();}
function drawBackdrop(width,height){
 if(background?.complete&&background.naturalWidth){const cover=Math.max(width/background.naturalWidth,height/background.naturalHeight),w=background.naturalWidth*cover,h=background.naturalHeight*cover;ctx.drawImage(background,(width-w)/2,(height-h)/2,w,h);}
 else{ctx.save();ctx.scale(width/2000,height/1000);const sky=ctx.createLinearGradient(0,0,0,850);sky.addColorStop(0,'#455e61');sky.addColorStop(.68,'#a6ad8b');sky.addColorStop(1,'#c3bc92');ctx.fillStyle=sky;ctx.fillRect(0,0,2000,1000);circle(1500,170,59,'#e2d69f');poly([[0,620],[150,411],[370,560],[610,280],[840,548],[1070,370],[1280,592],[1570,347],[1800,493],[2000,306],[2000,1000],[0,1000]],'#7a8e7c');poly([[0,694],[170,572],[410,650],[720,495],[940,682],[1170,576],[1410,691],[1760,531],[2000,660],[2000,1000],[0,1000]],'#59765e');ctx.restore();}
}

function changePortraitView(center,overview=false,focus=true){clearInput();portraitCenter=center;portraitOverview=overview;visualDirty=true;if(focus)canvas.focus?.();}
$('#viewCenter').addEventListener('input',()=>changePortraitView(Number($('#viewCenter').value),false,false));
$('#viewHero').onclick=()=>changePortraitView(null);
$('#viewOverview').onclick=()=>changePortraitView(null,!portraitOverview);
function renderPortraitView(camera){
 if(camera.width>=camera.height)return;
 const bounds=portraitViewBounds(camera),map=$('#battleOverview'),r=map.getBoundingClientRect(),width=r.width||camera.width-24,height=44;
 const ratio=Math.min(2,window.devicePixelRatio||1);if(map.width!==Math.round(width*ratio))map.width=Math.round(width*ratio);if(map.height!==Math.round(height*ratio))map.height=Math.round(height*ratio);
 const mc=map.getContext('2d');mc.setTransform(ratio,0,0,ratio,0,0);drawBattleOverview(mc,battle,camera,width,height);
 $('#viewCenter').value=String(Math.max(500,Math.min(1500,(bounds.left+bounds.right)/2)));
 $('#viewOverview').setAttribute('aria-pressed',String(portraitOverview));$('#viewOverview').textContent=portraitOverview?'Close-up':'Whole field';
 const onScreen=battle.hero.x>=bounds.left+30&&battle.hero.x<=bounds.right-30;$('#viewHero').setAttribute('aria-pressed',String(portraitCenter===null&&!portraitOverview));
 $('#viewStatus').textContent=`Battle ${battle.level} · `+(battle.enemies.finalStand?battle.enemies.status(observeBattlefield(battle)):portraitOverview?`${battle.badTeam.length} enemies · ${battle.enemies.remaining} incoming`:!onScreen?'Hero off-screen · tap Hero':portraitOffscreenStatus(battle,camera)||`${battle.badTeam.length} enemies · drag map to look ahead`);
 if(!onScreen&&profile.shootingMode==='classic')$('#combatAimHint').textContent='Tap Hero to return to your bow';
}

function render(){notices=notices.filter(n=>battle.tick-n.tick<(n.life??40));const active=battle.activeSkill;const camera=measureScene();if(!camera.renderable)return;
 ctx.setTransform(backingStore.pixelRatioX,0,0,backingStore.pixelRatioY,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,camera.width,camera.height);drawBackdrop(camera.width,camera.height);
 ctx.save();ctx.translate(camera.offsetX,camera.offsetY);ctx.scale(camera.scale,camera.scale);
 const terrainView=extendTerrainForCamera(battle.terrain.samples,camera),ground=terrainView.surface,groundInk=ctx.createLinearGradient(0,500,0,1200);groundInk.addColorStop(0,'#58694c');groundInk.addColorStop(.45,'#384f43');groundInk.addColorStop(1,'#263e37');poly(terrainView.polygon,groundInk);ctx.strokeStyle='#91a477';ctx.lineWidth=3;ctx.beginPath();ground.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
 for(let i=0;i<40;i++){const x=(i*153.13)%2000,y=battle.elevationAt(x);line(x,y,x+7,y-8-(i%5),'#a8b77c60',2);}for(const building of battle.structures)castle(building);
 for(const flag of [battle.ownFlag,battle.enemyFlag]){if(!Number.isFinite(flag.y))continue;const color=flag===battle.ownFlag?'#93c2d1':'#d99a75';line(flag.x,flag.y,flag.x,flag.y-52,'#e2d9b8',2);poly([[flag.x,flag.y-52],[flag.x+30,flag.y-44],[flag.x,flag.y-34]],color);}
 for(const unit of [...battle.goodTeam,...battle.badTeam]){if(unit===battle.hero&&unit.garrisoned()&&unit.hp>0){const station=garrisonStation(unit.garrisonBuilding);drawCombatTroop(ctx,{...unit,...station.hero,visible:true},combatPoses.pose(unit));}else troop(unit);drawStatusBadges(ctx,unit,{reactiveElements:battle.reactiveElements,scale:camera.scale});}for(const projectile of battle.objects.items)if(projectile.active&&Number.isFinite(projectile.vx)&&projectile.kind)drawArrow(projectile);for(const reactive of battle.reactiveElements)drawReactiveElement(ctx,reactive,camera.scale);for(const spell of battle.spells){if(spell.kind==='thunder_cloud'&&Number.isFinite(spell.x)&&Number.isFinite(spell.y)){circle(spell.x,spell.y,30,'#54697bad');circle(spell.x-26,spell.y+5,21,'#54697bad');circle(spell.x+24,spell.y+5,21,'#54697bad');}}
 const origin=battle.hero.launchPosition,dragMode=profile.shootingMode==='classic'||profile.shootingMode==='anywhere';
 if(!battle.summary&&Number.isFinite(origin.y)&&dragMode){ctx.beginPath();ctx.arc(origin.x-.3,origin.y-.3,launchRingRadius(),0,Math.PI*2);ctx.strokeStyle='#12241de0';ctx.lineWidth=3.5/camera.scale;ctx.stroke();ctx.strokeStyle='#f2e2a6d9';ctx.lineWidth=1.5/camera.scale;ctx.stroke();}
 const showAim=aimGuideVisible&&started&&!battle.paused&&!battle.outcome&&!openPanelId;
 // Preview the same latest pointer that release samples. Never pair a fresh
 // pointer tether with an old sampled angle, or draw a flight ray at the thumb.
 const manualAim=sampleManualAim({mode:profile.shootingMode,origin,anchor:battle.shooter.active?.anchor,pointer:battle.shooter.pointer,powerPercent:battle.shooter.powerPercent});
 drawManualAimGuide(ctx,{origin,aim:manualAim,scale:camera.scale,visible:showAim&&(!dragMode||aimPointerId!==null)});
 if(profile.shootingMode==='auto_aim'){const feedback=currentAutoAimFeedback();drawAlternateAimGuide(ctx,{mode:'auto_aim',guide:battle.shooter.guide,scale:camera.scale,visible:showAim,blocked:!['reachable','assisted'].includes(feedback?.state),trajectory:feedback?.aim});}
 for(const n of notices){if(drawElementalNotice(ctx,n,battle.tick,camera.scale))continue;if(n.kind==='wave'||n.kind==='heal'||n.kind==='blast'){drawCombatNotice(ctx,n,battle.tick);continue;}const age=battle.tick-n.tick;ctx.globalAlpha=1-age/40;if(n.radius){ctx.strokeStyle='#ebce80';ctx.lineWidth=3;ctx.beginPath();ctx.arc(n.x,n.y,n.radius*(.5+age/25),0,Math.PI*2);ctx.stroke();}else{ctx.fillStyle=n.color;ctx.font='17px system-ui';ctx.textAlign='center';ctx.fillText(n.text,n.x,n.y-age*1.2);}ctx.globalAlpha=1;}
 if((testingMode||demoMode)&&testingCollision){for(const building of battle.structures)drawFortificationCollision(ctx,building,{scale:camera.scale});for(const projectile of battle.objects.items)if(projectile.active&&Number.isFinite(projectile.x)&&Number.isFinite(projectile.y)){circle(projectile.x,projectile.y,2.5/camera.scale,'#68fff4');}}
 ctx.restore();
 $('#ownCastleHud').textContent=`Keep ${Math.max(0,Math.ceil(battle.goodCastle.hp))}`;$('#enemyCastleHud').textContent=`Enemy keep ${Math.max(0,Math.ceil(battle.badCastle.hp))}`;$('#ownFlagHud').textContent=flagDescription(battle.ownFlag);$('#enemyFlagHud').textContent=flagDescription(battle.enemyFlag);$('#flagHud').dataset.alert=String(battle.ownFlag.status!==3||battle.enemyFlag.status!==3);
 const xp=heroExperience(profile);$('#heroXpHud').textContent=xp.text;$('#heroXpFill').style.width=`${100*xp.fraction}%`;$('#armyHud').textContent=`Army slots ${battle.regularArmyCount}/${battle.friendlyQueue.cap} · Reserve ${battle.friendlyQueue.population}`;$('#openQueue').textContent=`Army / Queue · ${battle.friendlyQueue.queue.length}`;$('#activeProgress').textContent=active?`Rank ${active.rank} · ${Math.floor(active.xp)} / ${active.threshold} XP`:'';
 $('#heroHud').textContent=`Rank ${battle.profile.rank} · ${Math.max(0,Math.ceil(battle.hero.hp))} HP`;
 $('#goldHud').textContent=`${Math.floor(battle.profile.gold)} gold · ${battle.hero.garrisoned()?'Garrisoned':'On foot'}`;
 $('#enemyHud').textContent=`${observeBattlefield(battle).enemyAlive} enemies · ${battle.enemies.remaining} reserves${battle.enemies.withdrawn?' · '+battle.enemies.withdrawn+' withdrawn':''}`;
 $('#waveHud').textContent=battle.enemies.status(observeBattlefield(battle));
 $('#heroHealth').style.width=`${100*Math.max(0,battle.hero.hp/battle.hero.maxHp)}%`;$('#activeName').textContent=active?SKILLS[active.id].name:'No skill selected';const ready=active&&active.cooldown<=0;$('#reloadFill').style.width=`${100*(active?1-active.cooldown/active.maximum:0)}%`;$('#reloadText').textContent=ready?'Bow ready':'Reloading';$('#battleFire').disabled=!started||!!battle.outcome||!ready||battle.paused||!!openPanelId;$('#activate').disabled=!started||battle.paused||!!battle.outcome||!battle.activationObjects.length;$('#openShop').disabled=!!battle.summary?.campaignComplete;$('#endingShop').disabled=!!battle.summary?.campaignComplete;const hud=contextualHudState(battle),screen=$('.battle-screen');screen.dataset.heroMode=hud.heroMode;screen.dataset.nearGarrison=String(hud.nearGarrison);screen.dataset.aiming=String(aimPointerId!==null);$('#activate').classList[hud.showActivation?'remove':'add']('hidden');$('#activate').textContent=hud.activationLabel;const alert=priorityFlagAlert(battle);if($('#flagHud').textContent!==alert)$('#flagHud').textContent=alert;$('#flagHud').classList[alert?'remove':'add']('hidden');for(const button of document.querySelectorAll('[data-key]')){button.disabled=!started||battle.paused||!!battle.outcome||!!openPanelId;button.dataset.held=String(!!battle.input[button.dataset.key]);}drawHotbar();renderPortraitView(camera);
}
document.addEventListener('click',()=>visualDirty=true);document.addEventListener('input',()=>visualDirty=true);

function frame(time){if(toastUntil&&time>=toastUntil){$('#hudToast').classList.add('hidden');toastUntil=0;visualDirty=true;}const elapsed=Math.min(.25,Math.max(0,(time-now)/1000));now=time;if(started&&!hubOpen&&!battle.paused&&!document.hidden)clock.advance(elapsed);const signature=[battle,battle.tick,started,battle.paused,battle.activeSkill,battle.hotbar.bar,openPanelId];if(visualDirty||!lastPaint||signature.some((v,i)=>v!==lastPaint[i])){render();lastPaint=signature;visualDirty=false;}requestAnimationFrame(frame)}requestAnimationFrame(frame);
