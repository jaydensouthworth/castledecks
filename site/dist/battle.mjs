import {castlePracticeFeedbackState,updateCastlePracticeFeedback} from './castle-practice-feedback.mjs';
import {drawFriendlyHeraldryCue} from './player-heraldry-render.mjs';
import {createCastleLoadoutUI} from './castle-loadout-ui.mjs';
import {CASTLE_CATALOG} from './engine/castle-catalog.mjs';
import {prepareCastleSelection} from './engine/first-battle.mjs';
import {resolvePlayerPalette,validatePlayerPaletteId} from './player-palette.mjs';
import {drawCausewayGround,updateCausewayFeedback,causewayFeedbackState} from './causeway-presentation.mjs';
import {rallyEligible} from './engine/army-orders.mjs';
import {createGameCloudAccounts} from './cloud-account-integration.mjs';
import {drawLevyBadges} from './levy-badges.mjs';
import {createUnitTrial,isUnitTrial,supportsUnitTrial} from './unit-trial.mjs';
import {createStressField,isStressField} from './stress-field.mjs';
import {renderStressField} from './stress-field-ui.mjs';
import {updateLevyFeedback,levyFeedbackState,updateLevyMusterEntry} from './levy-presentation.mjs';
import {drawObjectiveMarkers,updateObjectiveFeedback,objectiveFeedbackState} from './objective-feedback.mjs';
import {createArmyOrdersUI,createLiveRallyPositionUI,drawArmyOrderMarker,armyOrderStatus,armyRallyPositionLabel} from './army-orders-ui.mjs';
import {drawAirFighter} from './flying-unit-art.mjs';
import {createBattleReportRecorder} from './battle-report.mjs';
import {createBattleRenderProfiler,sampleBattleRenderLoad} from './battle-render-profiler.mjs';
import {createBattleReportUI} from './battle-report-ui.mjs';
import {modalFocusCandidates} from './modal-focus.mjs';
import {syncCommandHall} from './command-hall.mjs';
import {createArmyCommandUI} from './army-command.mjs';
import {createControlBindings,controlEventKey,isControlTextTarget,isControlComposition,hasControlModifier} from './control-bindings.mjs';
import {createControlSettings} from './control-settings.mjs';
import {frameTrainingCamera,trainingCoachHeight} from './training-camera.mjs';
import {createTrainingRun,createTrainingBattleOptions,prepareTrainingBattle,trainingLesson,TRAINING_LESSONS,advanceTraining,restartTrainingLesson,drawTrainingTarget} from './guided-training.mjs';
import {createTrainingCoach} from './guided-training-ui.mjs';
import {createCampaignRegionArt} from './campaign-region-art.mjs';
import {EXPEDITION_NAME} from './expedition-data.mjs';
import {ExpeditionProfiles} from './expedition-model.mjs';
import {ExpeditionBattle} from './expedition-battle.mjs';
import {createExpeditionRoute,expeditionLaunchLabel,expeditionResultCopy,renderExpeditionReceipt} from './expedition-ui.mjs';
import {DEFAULT_SKIRMISH,createSkirmish,skirmishFromSearch,skirmishURL} from './skirmish-model.mjs';
import {SkirmishProfiles,SkirmishBattle} from './skirmish-battle.mjs';
import {createSkirmishWorkshop} from './skirmish-ui.mjs';
import {CAMPAIGN_NAME,encounterBrief,campaignProgress,campaignBattleSnapshot,campaignSettlement,canPrepareEncounter} from './campaign-atlas-model.mjs';
import {createCampaignAtlas,renderCampaignRewards} from './campaign-atlas.mjs';
import {createLocalCampaignUI} from './local-campaign-ui.mjs';
import {PLAY_DESTINATIONS,destinationForMode,playDestinationURL,canPurchaseInArmory} from './player-hub.mjs';
import {observeBattlefield} from './engine/battle-director.mjs';
import {drawGorath} from './gorath-art.mjs';
import {createSpecialMotionController} from './special-unit-motion.mjs';
import {createRecruitShowcaseOptions,prepareRecruitShowcaseBattle} from './recruit-showcase.mjs';
import {createCompanionUI} from './companion-ui.mjs';
import {buildArmoryRecords} from './armory-catalog-data.mjs';
import {createArmorySnapshot} from './armory-catalog-model.mjs';
import {createArmoryCatalogUI} from './armory-catalog.mjs';
import {checkoutArmoryCart} from './armory-cart.mjs';
import {RECRUIT_SKILLS,COMPANIONS} from './engine/recruitment.mjs';
import {placeLoadoutAbility,recoverDuplicateBindings} from './loadout-ui-model.mjs';
import {createLoadoutCollectionUI} from './loadout-collection.mjs';
import {createProfileDecks,applyDeck,captureDeck} from './deck-presets-model.mjs';
import {createDeckPresetsUI} from './deck-presets.mjs';
import {createLoadoutDrag} from './loadout-drag.mjs';
import {slotToKey,eventToSlot} from './keyboard-layout.mjs';
import {createDragonCounterGuide} from './dragon-counter-guide.mjs';
import {elementalNotice,drawElementalNotice,drawReactiveElement,drawElementalDragon} from './elemental-feedback.mjs?build=40';
import {createPortraitView,portraitViewBounds,drawBattleOverview,portraitOffscreenStatus} from './portrait-view.mjs';
import {updateCombatHud} from './combat-hud.mjs?build=40';
import {frameCombatCamera} from './combat-camera.mjs';
import {createMidgameDemoBattleOptions,prepareMidgameDemoBattle} from './midgame-demo.mjs?build=40';
import {skillIcon} from './skill-icons.mjs';
import {createMovementOwners} from './movement-input.mjs';
import {liveBarState,liveSlotStatus} from './live-action-model.mjs';
import {createLiveSkillAdapter} from './live-skill-adapter.mjs';
import {drawFortification,drawFortificationCollision,garrisonStation,fortificationGeometry} from './fortress-art.mjs?build=40';
import {boundSkillRefs,contextualHudState,priorityFlagAlert,shortNames} from './quiet-hud-model.mjs';
import {drawAlternateAimGuide} from './alternate-aim-guides.mjs';
import {autoAimFeedback} from './auto-aim-feedback.mjs';
import {sampleManualAim,drawManualAimGuide} from './manual-aim-guide.mjs';
import {createCombatPoseController,drawCombatTroop} from './combat-poses.mjs?build=40';
import {createWorldCamera,screenToWorld,getBackingStoreSize,extendTerrainForCamera} from './world-camera.mjs';
import {flagDescription,heroExperience,summonMessage} from './hud-state.mjs';
import {markTestingProfiles,grantTestGold,unlockTestSkills,readyTestSkills,protectTestBattle,finishTestBattle,selectTestLevel} from './testing.mjs';
import {combatNotice,drawCombatNotice,drawStatusBadges} from './combat-feedback.mjs?build=40';
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
  if(battle.guidedTraining&&!isUnitTrial(trainingRun)){const node=$('#trainingCoach'),coach=node.getBoundingClientRect(),hud=$('.live-topbar').getBoundingClientRect(),geometry={hero:battle.hero.launchPosition,target:battle.guidedTraining.targetPoint(),targetBox:battle.guidedTraining.target?.hitbox,groundY:Math.max(...battle.terrain.samples)},top=coach.top-rect.top,height=trainingCoachHeight(worldCamera,{...geometry,top,bottom:floor});node.style.maxHeight=height+'px';worldCamera=frameTrainingCamera(worldCamera,{...geometry,top:top+height+12,bottom:floor,left:Math.max(12,hud.left-rect.left),right:Math.max(12,rect.width-(hud.right-rect.left))});}
 }
 if((rect.width>=rect.height||isUnitTrial(trainingRun))&&battle?.guidedTraining)$('#trainingCoach').style.maxHeight='';
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
const campaignRegionArt=createCampaignRegionArt({onInvalidate:()=>visualDirty=true});
const regionContrast=window.matchMedia?.('(prefers-contrast: more)');
regionContrast?.addEventListener?.('change',()=>visualDirty=true);
window.addEventListener('pagehide',event=>{if(!event.persisted)campaignRegionArt.dispose();});
const requestedMode=new URLSearchParams(window.location?.search??'').get('mode');
let testingMode=requestedMode==='test',demoMode=requestedMode==='demo',skirmishMode=requestedMode==='skirmish',expeditionMode=requestedMode==='expedition';
let skirmishDescriptor=DEFAULT_SKIRMISH,skirmishInputError='',pendingSkirmish=null;
if(skirmishMode){try{skirmishDescriptor=skirmishFromSearch(window.location?.search??'');}catch(error){skirmishInputError=error.message;}}
let recruitShowcase=demoMode&&new URLSearchParams(window.location?.search??'').get('showcase')==='companions';
let activeDestination=destinationForMode({demoMode,recruitShowcase,testingMode,skirmishMode,expeditionMode});
// A frontpage handoff opens a chooser; it never creates or restores a campaign.
const localSaveEntryRequested=activeDestination==='campaign'&&new URLSearchParams(window.location?.search??'').get('open')==='local-saves';
let selectedDestination=activeDestination,hubOpen=true,pendingDestination=null;
const destinationSessions=new Map();
let cardPracticeOrigin=null;
let stressFieldOrigin=null,stressFieldPreset=null;
let trainingRun=null,trainingSandbox=null,trainingReturnDestination=null,trainingLaunchRequested=false,trainingInviteDismissed=false,trainingEntrySignature='';
function temporarySessionActive(){return !!trainingRun||!!cardPracticeOrigin||!!stressFieldOrigin;}
const makeDemo=options=>(recruitShowcase?createRecruitShowcaseOptions:createMidgameDemoBattleOptions)(options);
const demoAim=new URLSearchParams(window.location?.search??'').get('aim');
let demoLaunch=demoMode?makeDemo({shootingMode:['classic','anywhere','point_aim','auto_aim'].includes(demoAim)?demoAim:'classic'}):null;
if(demoMode)document.title='Castledecks · Midgame demo';if(expeditionMode)document.title='Castledecks · Wayfarer Charter';if(skirmishMode)document.title='Castledecks · Seeded Skirmish';
let testingProtection=false,testingCollision=false;
const GAME_BUILD='78';
let profiles=skirmishMode?new SkirmishProfiles(createSkirmish(skirmishDescriptor)):expeditionMode?new ExpeditionProfiles():new CampaignProfiles({profiles:demoLaunch?[demoLaunch.profile]:[],defaultName:testingMode?'Playground':demoMode?'Midgame Demo':'Castledecks'});
const profileDecks=createProfileDecks();
let localCampaign=null,cloudAccounts=null;
let profile=profiles.active,battle,clock,combatPoses,specialMotion,started=false,angle=20,power=100,now=performance.now(),notices=[],barSignature='',liveSkills,selectedWrapper=null,editorBar=0,loadoutOrigin='preparation',toastUntil=0,openPanelId=null,panelResume=false,activationPulse=0,heldSpace=false,loadoutReturnPanel=null,pendingDelete=null,bindingLayout=null,pauseMessage="Take your time. Your battlefield is frozen.",panelFocus=null;
const movementOwners=createMovementOwners(()=>battle?.input??{});
const battleReports=new WeakMap();
const renderProfiler=createBattleRenderProfiler();let renderProfileBattle=null;
// Invalidate at transitions, even when an entire trial happens between frames.
function invalidateRenderProfile(){renderProfiler.clear();renderProfileBattle=null;}
function getRenderProfiler(){if(renderProfileBattle!==battle){renderProfiler.clear();renderProfileBattle=battle;}return renderProfiler;}
// Explicit read-only diagnostic boundary: only the current battle's validated
// scenario descriptor supplies a seed. Never inspect workshop drafts, URLs,
// profile/run/save objects, or the mutable RNG state.
function getBattleReportContext(){
 const isSkirmish=activeDestination==='skirmish';
 const seed=isSkirmish?battle?.skirmish?.descriptor?.seed:expeditionMode?battle?.expeditionSeed:null;
 const phase=battle?.summary?'settled':battle?.outcome?'settling':!started?'preparation':battle?.paused?'paused':'running';
 return {build:GAME_BUILD,mode:activeDestination,phase,scenarioSeed:Number.isSafeInteger(seed)&&seed>=(isSkirmish?1:0)&&seed<=0xffffffff?seed:null};
}
let battleReportReturn=null;
const battleReportUI=createBattleReportUI({document,window,getState:()=>({battle,recorder:battleReports.get(battle),context:getBattleReportContext(),renderProfiler:getRenderProfiler(),renderContext:{...getBattleReportContext(),assisted:testingMode||demoMode||!!trainingRun||profile.cheated===true,ended:!!battle.outcome||!!battle.stressField?.stopped,synthetic:isStressField(battle)}}),onClose:closeBattleReport});
function showBattleReport(){if(stressFieldOrigin)$('#renderProfileKind').value='controlled-fixture';battleReportReturn=openPanelId==='#testingPanel'?'#testingPanel':null;panel('#battleReportPanel',true);battleReportUI.open();}
function closeBattleReport(){const returnTo=battleReportReturn;battleReportReturn=null;if(returnTo)panel(returnTo,true);else panel('#battleReportPanel',false);}
const controls=createControlBindings(),controlLabel=(action,options)=>controls.label(action,options);
let controlsReturnPanel=null;const heldActivationKeys=new Set();
const controlsUI=createControlSettings({root:$('#controlsPanel'),controls,onApply:result=>{clearInput();syncControlLabels();companionUI.renderLive();renderArcControl();closeControls();$('#controlsSummary').textContent=result.message;status(result.message);},onCancel:closeControls});
function showControls(){controlsReturnPanel=openPanelId;controlsUI.begin();panel('#controlsPanel',true);}
function closeControls(){const back=controlsReturnPanel;controlsReturnPanel=null;controlsUI.discard();if(back){panel(back,true);$('#openControls').focus?.();}else panel('#controlsPanel',false);}
function syncControlLabels(){
 for(const node of document.querySelectorAll('[data-control-label]'))node.textContent=controlLabel(node.getAttribute('data-control-label'),{compact:true});
 $('#pauseControlsReference').textContent=`${controlLabel('left')} / ${controlLabel('right')} move · ${controlLabel('up')} / ${controlLabel('down')} enter / leave · 1–9 then 0 skills · ${controlLabel('previousBar')} / ${controlLabel('nextBar')} change bars · ${controlLabel('activate')} activates airborne skills · ${controlLabel('companion')} commands your companion · ${controlLabel('arc')} switches Auto aim arc · ${controlLabel('armyOrder')} overrides all ground orders · ${controlLabel('pause')} or Escape pauses`;
 $('#trajectoryHint').textContent=`Used only with Auto aim. Switch live with the High / Low arc button or ${controlLabel('arc')}.`;
 $('#loadoutControlsReference').textContent=`Keyboard: Tab and Enter select cards and keys. Inspect opens details without changing your placement selection. During battle, keys 1–9 and 0 activate the current bar; ${controlLabel('companion')} controls your separate companion. Reserve abilities stay owned but do not cool down.`;
 $('#nextBar').setAttribute('title',`Next skill bar · ${controlLabel('nextBar')} or mouse wheel`);
 $('#activate').setAttribute('title',`Activate airborne ability · ${controlLabel('activate')}`);
 $('#battlePause').setAttribute('title',`Pause / resume · ${controlLabel('pause')} or Escape`);
 for(const button of document.querySelectorAll('[data-key]'))button.setAttribute('title',`${button.getAttribute('aria-label')} · ${controlLabel(button.dataset.key)}`);
 $('#controlsSummary').textContent=controls.message||'Keyboard bindings and mouse / touch reference. Preferences stay on this browser.';
 visualDirty=true;
}

const descriptions={...Object.fromEntries(Object.entries(RECRUIT_SKILLS).map(([id,item])=>[id,item.description])),arrow:'Fast-reloading standard shot. Earn gold and experience from hits.',fireArrow:'Fire damage and a lingering burn.',iceArrow:'Ice damage that slows affected targets.',pierceArrow:'A heavy piercing projectile.',bombArrow:'A blast on impact with nearby damage.',flakArrow:'Use airborne activation to scatter shrapnel after firing.',bombWave:'Explosions travel along the ground.',iceWave:'Waves of ice damage and slowing frost sweep outward.',fireWave:'Burning waves travel over the terrain.',healWave:'Restores nearby friendly living units.',thunderArrow:'Use airborne activation to form a lightning cloud after firing.',meteorArrow:'Calls down falling fire and rock.',cometArrow:'Calls down falling ice.',grunt:'Four foot soldiers. Each squad costs 20 gold and 4 reserve.',archer:'Four archers. Each squad costs 20 gold and 4 reserve.',tallGrunt:'Three heavy infantry. Each squad costs 30 gold and 3 reserve.',mount:'Four mounted fighters. Each squad costs 30 gold and 4 reserve.',trebuchet:'One siege engine. Costs 70 gold and 1 reserve recruit.',priest:'Two healers. Each squad costs 30 gold and 2 reserve.'};
const companionUI=createCompanionUI({document,controlLabel,getBattle:()=>battle,canEditLoadout:()=>canMutateLoadout(),canAct:()=>started&&!battle.paused&&!battle.outcome&&!battle.summary&&!openPanelId,onChange:()=>{localCampaign?.checkpoint('loadout');visualDirty=true;if(openPanelId==='#skillsPanel')drawOwnedSkills();if(openPanelId==='#shopPanel')renderShop();},notify:text=>status(text)});
const trainingCoach=createTrainingCoach({document,controlLabel,getController:()=>battle?.guidedTraining,canAct:()=>started&&!battle.paused&&!openPanelId&&!hubOpen,onNext:()=>nextTrainingDrill(false),onSkip:()=>nextTrainingDrill(true),onRestart:restartGuidedDrill,onExit:exitGuidedTraining,onAssist:()=>{if(started&&!battle.paused&&!openPanelId&&!hubOpen){if(isUnitTrial(trainingRun))liveSkills.choose(battle.guidedTraining.contract);else battle.guidedTraining?.assistedShot();canvas.focus?.();}},onLoadout:()=>{if(trainingRun){trainingRun.reviewedLoadout=true;trainingCoach.reset();showSkills();$('#closeSkills').textContent='Back to guided practice';$('#closeSkills').setAttribute('aria-label','Back to guided practice');}}});
function status(text){$('#battleStatus').textContent=text;if(/out of range|not enough|need \d|need more|reloads in|queue is full|unavailable|not ready|begin inside|view changed|wait for|no population|cannot|failed/i.test(text)&&started&&!openPanelId){$('#hudToast').textContent=text;$('#hudToast').classList.remove('hidden');toastUntil=performance.now()+2200;visualDirty=true;}}
function completedCampaignLabel(){if(expeditionMode)return profiles.profiles.length>1?'Archive and choose charter':'Archive and start new charter';return profiles.profiles.length>1?'Retire and choose campaign':'Start new campaign';}
const campaignAtlas=createCampaignAtlas({document,host:$('#campaignAtlasHost'),getState:()=>({profile,battle,started,summary:battle?.summary,destination:activeDestination}),onPrepare:level=>{if(!canPrepareEncounter({profile,level,started,summary:battle.summary,destination:activeDestination}))return;panelResume=false;panel('#campaignPanel',false);setup(level);showHub();$('#introNotice').textContent=`${encounterBrief(level).name} prepared. ${battle.campaignReplay?'Replay: your earned frontier is preserved.':'Review your loadout, then start when ready.'}`;},onReturn:()=>panel('#campaignPanel',false)});
const skirmishWorkshop=createSkirmishWorkshop({host:$('#skirmishWorkshopHost'),getDescriptor:()=>skirmishDescriptor,onPrepare:descriptor=>{if(!skirmishMode||openPanelId!=='#skirmishPanel'||pendingSkirmish)return;if(started&&!battle.summary){pendingSkirmish=descriptor;$('#skirmishWorkshopHost').inert=true;$('#skirmishReplaceConfirm').classList.remove('hidden');$('#skirmishKeepAttempt').focus?.();return;}prepareSkirmish(descriptor);},onClose:closeSkirmishWorkshop});
function closeSkirmishWorkshop(){skirmishWorkshop.invalidate();pendingSkirmish=null;$('#skirmishWorkshopHost').inert=false;$('#skirmishReplaceConfirm').classList.add('hidden');panelResume=false;panel('#skirmishPanel',false);}
function showSkirmishWorkshop(){if(!skirmishMode||battle.outcome&&!battle.summary)return;showHub();pendingSkirmish=null;$('#skirmishWorkshopHost').inert=false;$('#skirmishReplaceConfirm').classList.add('hidden');skirmishWorkshop.open();panel('#skirmishPanel',true);if(skirmishInputError){$('#skirmishStatus').textContent=skirmishInputError+' The default field is shown; choose a valid code before preparing.';skirmishInputError='';}}
function prepareSkirmish(descriptor=skirmishDescriptor){
 if(!skirmishMode)return;
 const scenario=createSkirmish(descriptor),nextProfiles=new SkirmishProfiles(scenario,{shootingMode:profile.shootingMode});
 panelResume=false;panel('#skirmishPanel',false);pendingSkirmish=null;$('#skirmishWorkshopHost').inert=false;$('#skirmishReplaceConfirm').classList.add('hidden');
 skirmishDescriptor=scenario.descriptor;profiles=nextProfiles;profile=profiles.active;setup();showHub();
 window.history?.replaceState(null,'',skirmishURL(skirmishDescriptor));$('#introNotice').textContent='Fresh practice supplies ready. Review your loadout, then Start the field.';
}
function syncSkirmishIdentity(){
 for(const id of ['#introWorkshop','#pauseWorkshop','#endingWorkshop','#hubSkirmishProgress','#skirmishDifficultyNote','#skirmishSessionNote'])$(id).classList[skirmishMode?'remove':'add']('hidden');
 for(const id of ['#localManage','#saveGame','#loadGame','#openProfiles','#introSave','#introProfiles','#introLoad','#endingSave','#endingLoad','#endingProfiles']){const node=$(id);if(node)node.classList[skirmishMode?'add':'remove']('hidden');}
 for(const node of document.querySelectorAll('[data-menu-route="profiles"],[data-menu-route="vault"]'))node.classList[skirmishMode?'add':'remove']('hidden');
 $('.hub-save-note')?.classList[skirmishMode?'add':'remove']('hidden');
 $('#difficulty').disabled=skirmishMode;$('#endingShop').classList[skirmishMode?'add':'remove']('hidden');$('#endingLoadout').classList.remove('hidden');$('#endingLoadout').textContent=skirmishMode?'Inspect / export decks':'Loadout';$('#introLoadout').disabled=false;$('#introLoadout').querySelector('strong').textContent=skirmishMode&&battle.summary?'Saved decks':'Build deck';$('#introLoadout').querySelector('span').textContent=skirmishMode&&battle.summary?'Inspect / export this attempt':'Arrange your cards';if(skirmishMode&&battle.summary)$('#introArmory').disabled=true;if(!skirmishMode)return;
 const scenario=battle.skirmish,castlePractice=castlePracticeFeedbackState(battle);
 $('#battleTitle').textContent=`Skirmish · ${scenario.name}${castlePractice?' · Highwatch comparison':''} · Practice`;$('#testModeBadge').textContent='PRACTICE';
 $('#hubSkirmishProgress').textContent=`${scenario.name} · ${scenario.encounter.roster.length} enemies`;
 $('#hubSessionState').textContent=battle.summary?`Practice ${battle.summary.outcome} · retry ready`:started?'Practice paused':'Practice ready';
 $('#saveStatus').textContent='Keep the seed code to recreate this field. Attempt rewards are temporary.';$('#endingSaveStatus').textContent='No campaign progress was earned. Retry restores the supplied kit and clears this attempt’s saved decks. Export a deck code first.';
 if(selectedDestination===activeDestination){$('#start').textContent=battle.summary?'Prepare same seed':started?'Resume skirmish':'Start skirmish';$('#hubLaunchNote').textContent=castlePractice?'Highwatch comparison: both castles are supplied. Change your castle in Build before Start. Break their keep, clear the company and recover your home flag.':'A fresh supplied kit for each attempt. Open the workshop to inspect, copy or change this seed.';}
 if(battle.summary){const causeway=causewayFeedbackState(battle),levy=levyFeedbackState(battle),objective=objectiveFeedbackState(battle);$('#endingTitle').textContent=castlePractice?castlePractice.status:causeway?causeway.status:levy?levy.status:objective?objective.status:`Practice ${battle.summary.outcome}`;$('#endingText').textContent=`${scenario.name} · ${castlePractice?castlePractice.result:causeway?causeway.result:levy?levy.result:objective?`${objective.resolved}/2 marked engines resolved.${objective.phase==='victory'?' Home flag safe.':objective.reason?' '+objective.reason:''}`:`${battle.stats.shotsFired} basic shots · ${battle.stats.bodyShots+battle.stats.headShots} basic hits.`} This attempt’s gold and XP stay here. Retry the same seed with fresh supplies, or make a new field.`;$('#replay').textContent='Prepare same seed';}
}
const expeditionRoute=createExpeditionRoute({host:$('#expeditionRouteHost'),getRun:()=>profiles.activeRun,getState:()=>({started,summary:battle.summary,pendingOutcome:!!battle.outcome&&!battle.summary}),onChoose:id=>{if(!expeditionMode||!profiles.activeRun.choose(id))return;panelResume=false;panel('#expeditionPanel',false);setup();showHub();$('#introNotice').textContent=`${profiles.activeRun.current.name} chosen. Arrange your loadout, then Start when ready.`;},onReturn:()=>panel('#expeditionPanel',false),onRestart:()=>{if(!expeditionMode)return;panelResume=false;panel('#expeditionPanel',false);profile=profiles.restartCurrent();setup();showHub();$('#introNotice').textContent='Charter restarted with its declared starting supplies. Other banners and sessions are preserved.';}});
function showExpeditionRoute(){if(!expeditionMode||battle.outcome&&!battle.summary)return;showHub();expeditionRoute.open();panel('#expeditionPanel',true);}
function syncExpeditionIdentity(){
 for(const id of ['#introRoute','#pauseRoute','#endingRoute','#hubExpeditionProgress','#expeditionObjective'])$(id).classList[expeditionMode?'remove':'add']('hidden');
 renderExpeditionReceipt($('#expeditionRewards'),expeditionMode?profiles.activeRun:null);
 if(!expeditionMode)return;
 const run=profiles.activeRun,field=run.current;
 $('#battleTitle').textContent=`Leg ${field.leg} / 4 · ${field.name}`;$('#expeditionObjective').textContent=field.objectiveText;
 $('#hubSessionState').textContent=run.complete?'Four legs complete · charter ready to archive':run.choosing?`${field.name} won · choose the next road`:battle.summary?`${field.name} lost · retry available`:started?`${field.name} paused · exact battlefield preserved`:`${field.name} ready · combat has not started`;
 $('#hubExpeditionProgress').textContent=`${run.state.cleared}/4 fields won · ${field.objective==='break-keep'?'Break the enemy keep':'Flag or elimination'} · Seed ${run.state.seed}`;
 if(selectedDestination===activeDestination){$('#start').textContent=expeditionLaunchLabel(run,{started,summary:battle.summary});$('#hubLaunchNote').textContent=run.choosing?'Choose one road. The next field waits for your explicit Start.':run.complete?'Keep a charter file or code, then archive this banner when ready.':started&&!battle.summary?'Resume this exact field. Route changes wait until victory.':'Your charter has its own starter kit, gold and save. Review the route for objective and enemy counters.';}
 if(battle.summary){const copy=expeditionResultCopy(run,battle);$('#endingTitle').textContent=copy.title;$('#endingText').textContent=copy.description;$('#replay').textContent=copy.action;}
}
function showCampaignAtlas(){if(activeDestination!=='campaign'||battle.outcome&&!battle.summary)return;showHub();campaignAtlas.open(battle.summary?.outcome==='victory'?Math.min(30,profile.highestLevel):battle.level);panel('#campaignPanel',true);campaignAtlas.recenter();}
function syncCampaignIdentity(){const isCampaign=activeDestination==='campaign';for(const id of ['#introAtlas','#pauseAtlas','#endingAtlas'])$(id).classList[isCampaign?'remove':'add']('hidden');$('#hubCampaignProgress').classList[isCampaign?'remove':'add']('hidden');if(isCampaign){const progress=campaignProgress(profile),brief=encounterBrief(battle.level);$('#hubCampaignProgress').textContent=`${brief.region.name} · ${progress.cleared}/30 ${progress.assisted?'reached':'cleared'}${battle.campaignReplay?' · Replaying a cleared field':''}`;$('#battleTitle').textContent=`${profile.cheated?'Assisted · ':''}Battle ${battle.level} · ${brief.name}${battle.campaignReplay?' · Replay':''}`;}renderCampaignRewards($('#campaignRewards'),isCampaign?campaignSettlement(battle,battle.campaignStartSnapshot):null);}

function renderHub(){cloudAccounts?.sync();
 localCampaign?.render();
 const current=PLAY_DESTINATIONS.find(item=>item.id===activeDestination),selected=PLAY_DESTINATIONS.find(item=>item.id===selectedDestination);
 $('#introTitle').textContent='The command hall';
 $('#introText').textContent='Prepare your banner, then take the field.';
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
 renderTrainingEntry({force:true});syncCampaignIdentity();syncExpeditionIdentity();syncSkirmishIdentity();if(activeDestination==='campaign'&&battle.campaignReplay&&battle.summary?.outcome==='victory')$('#start').textContent=campaignSettlement(battle,battle.campaignStartSnapshot).nextLabel;
 syncCommandHall({document,current,selected,activeDestination,selectedDestination,started,summary:battle.summary,profile,battle,run:expeditionMode?profiles.activeRun:null,decks:profileDecks.get(profile),sessionIds:[...destinationSessions.keys()],sessions:[...destinationSessions].map(([id,s])=>({id,level:s.battle.level,started:s.started,outcome:s.battle.summary?.outcome,cleared:s.profiles.activeRun?.state.cleared})),onInspectCampaign:level=>{if(activeDestination!=='campaign')return;showCampaignAtlas();campaignAtlas.open(level);campaignAtlas.recenter();}});
 $('#introArmory').disabled=!!battle.summary?.campaignComplete||skirmishMode&&!!battle.summary;$('#hubOpenSeparate').classList[selectedDestination===activeDestination?'add':'remove']('hidden');
}
function openDestination(id,notice=$('#introNotice')){
 if(id===activeDestination)return;
 const item=PLAY_DESTINATIONS.find(item=>item.id===id),url=playDestinationURL(id,profile.shootingMode);
 let opened=null;try{opened=window.open?.(url,'_blank');if(opened)opened.opener=null;}catch{}
 if(opened)notice.textContent=`${item.name} opened in a separate tab. This session stays here.`;
 else notice.innerHTML=`This session is still here. <a href="${html(url)}" target="_blank" rel="noopener">Open ${html(item.name.toLowerCase())} in a new tab</a>.`;
}
function startMidgameDemo(showcase=false){if(stressFieldOrigin){requestDestination(showcase===true?'allies':'midgame');return;}if(cardPracticeOrigin)exitUnitTrial();const id=showcase===true?'allies':'midgame';showHub();selectedDestination=id;renderHub();requestDestination(id);}
function showHub(){
 if(stressFieldOrigin){exitStressField();return;}
 if(cardPracticeOrigin){exitUnitTrial();return;}
 if(battle.outcome&&!battle.summary){status('Counting the battle result. The lobby opens when rewards are settled.');return;}
 cancelPendingImport();clearInput();loadoutDrag.cancel();
 if(openPanelId){panelResume=false;panel(openPanelId,false);}
 loadoutReturnPanel=null;precisionReturnPanel=null;armoryReturnFromLoadout=false;armyReturnFromLoadout=false;
 if(started&&!battle.summary)pause(true);
 hubOpen=true;selectedDestination=activeDestination;
 $('#restartConfirm').classList.add('hidden');$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');
 renderHub();syncPause();$('#start').focus?.();visualDirty=true;
}
function startFromHub(event){
 if(skirmishMode&&event?.detail>1)return;
 if(!hubOpen||openPanelId||pendingDestination)return;
 if(selectedDestination!==activeDestination){requestDestination(selectedDestination);return;}
 if(battle.summary){$('#replay').onclick();return;}
 if(started){hubOpen=false;$('#intro').classList.add('hidden');pause(false);return;}
 begin();
}
function armoryPurchasesAllowed(){if(skirmishMode&&battle.summary)return false;return canPurchaseInArmory({started,summary:battle.summary});}
function requestDestination(id){
 if(id===activeDestination||!PLAY_DESTINATIONS.some(item=>item.id===id))return;
 if(battle.outcome&&!battle.summary){status('Wait for the battle result before switching sessions.');return;}
 if(started&&!battle.summary){
  pendingDestination=id;const item=PLAY_DESTINATIONS.find(item=>item.id===id);
  $('#switchSessionText').textContent=stressFieldOrigin?`Discard this synthetic field and open ${item.name.toLowerCase()}? Your original playground remains preserved. Cancel keeps this paused fixture and its report sample.`:`Open ${item.name.toLowerCase()}? Your current Battle ${battle.level} stays paused in this tab. Select ${PLAY_DESTINATIONS.find(item=>item.id===activeDestination).name.toLowerCase()} in the lobby to return to this exact battlefield.`;
  $('#switchSessionConfirm').classList.remove('hidden');$('#intro').inert=true;$('#pauseOverlay').inert=true;$('#cancelSessionSwitch').focus?.();return;
 }
 switchDestination(id);
}
function cancelSessionSwitch(){pendingDestination=null;trainingLaunchRequested=false;$('#switchSessionConfirm').classList.add('hidden');syncPanelShield();$('#start').focus?.();}
function switchDestination(id){
 if(id===activeDestination)return;
 invalidateRenderProfile();
 if(stressFieldOrigin)exitStressField();
 const guidedOrigin=trainingLaunchRequested?trainingReturnDestination:null;
 clearInput();cancelPendingImport();loadoutDrag.cancel();if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();liveSkills?.dispose();
 destinationSessions.set(activeDestination,{profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trainingRun,trainingSandbox,trainingReturnDestination,trajectory:$('#trajectory').value,shooterAngleMode:battle.shooter.angleMode,showAssist:$('#showAssist').checked});
 activeDestination=id;selectedDestination=id;demoMode=['midgame','allies'].includes(id);testingMode=id==='training';recruitShowcase=id==='allies';expeditionMode=id==='expedition';skirmishMode=id==='skirmish';
 pendingDestination=null;$('#switchSessionConfirm').classList.add('hidden');
 const saved=destinationSessions.get(id);
 if(saved){
  if(skirmishMode)skirmishDescriptor=saved.battle.skirmish.descriptor;
  ({profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview}=saved);trainingRun=saved.trainingRun??null;trainingSandbox=saved.trainingSandbox??null;trainingReturnDestination=saved.trainingReturnDestination??null;
  hubOpen=true;barSignature='';bindingLayout=null;selectedWrapper=null;armoryReturnFromLoadout=false;armyReturnFromLoadout=false;precisionReturnPanel=null;loadoutReturnPanel=null;
  syncSessionMenus();$('#trajectory').value=saved.trajectory;$('#showAssist').checked=saved.showAssist;attachLiveSkills();drawHotbar();
 }else{
  trainingRun=null;trainingSandbox=null;trainingReturnDestination=null;testingProtection=false;testingCollision=false;angle=20;power=100;$('#trajectory').value='1';$('#showAssist').checked=false;demoLaunch=demoMode?makeDemo({shootingMode:profile.shootingMode}):null;
  profiles=skirmishMode?new SkirmishProfiles(createSkirmish(skirmishDescriptor),{shootingMode:profile.shootingMode}):expeditionMode?new ExpeditionProfiles():new CampaignProfiles({profiles:demoLaunch?[demoLaunch.profile]:[],defaultName:testingMode?'Playground':'Castledecks'});profile=profiles.active;setup();
 }
 document.title=skirmishMode?'Castledecks · Seeded Skirmish':expeditionMode?'Castledecks · Wayfarer Charter':demoMode?'Castledecks · Midgame demo':testingMode?'Castledecks · Training':'Castledecks · Campaign';
 window.history?.replaceState(null,'',skirmishMode?skirmishURL(skirmishDescriptor):playDestinationURL(activeDestination,profile.shootingMode));
 $('#battleTitle').textContent=isUnitTrial(trainingRun)?`${SKILLS[trainingRun.cardId].name} · field trial`:`${testingMode?'Playground · ':profile.cheated?'Assisted · ':''}Battle ${battle.level}${profile.cheated?'':' · Capture the flag'}`;
 $('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;$('#battleAngle').value=String(angle);$('#battleAngleOut').textContent=angle+'°';$('#battlePower').value=String(power);updatePowerMode();if(saved)battle.shooter.angleMode=saved.shooterAngleMode;$('#battleFire').classList[$('#showAssist').checked?'remove':'add']('hidden');now=performance.now();lastPaint=null;showHub();if(trainingLaunchRequested&&id==='training'){trainingLaunchRequested=false;trainingReturnDestination=guidedOrigin;enterGuidedTraining();}if(skirmishMode&&!saved)showSkirmishWorkshop();
}
function restartMidgameDemo(){
 if(!demoMode)return;
 demoLaunch=makeDemo({shootingMode:profile.shootingMode});profiles=new CampaignProfiles({profiles:[demoLaunch.profile],defaultName:'Midgame Demo'});profile=profiles.active;started=false;setup();showHub();
 status('Midgame demo reset · prepare Battle 13 · assisted');
}
function returnFromDemo(){if(!demoMode)return;if(destinationSessions.has('campaign')){showHub();selectedDestination='campaign';renderHub();requestDestination('campaign');return;}if(window.parent&&window.parent!==window){window.parent.postMessage({type:'bowmaster-preview-exit-demo'},window.location.origin);return;}$('#demoReturnNote').textContent='Your campaign is in its original tab. If this tab stays open, close it to return.';try{window.close?.();}catch{}}
function cancelPendingImport(){localCampaign?.cancel();loadGeneration++;const reading=text=>text==='Reading campaign file…'||text==='Reading charter file…';if(reading($('#introNotice').textContent))$('#introNotice').textContent='';for(const id of ['#saveStatus','#endingSaveStatus'])if(reading($(id).textContent))$(id).textContent=expeditionMode?'Load cancelled. Your current charter has been kept.':'Load cancelled. Your current campaign has been kept.';}

function clearInput(){battle?.cancelPlayerShots();aimCamera=null;movementOwners.clear();liveSkills?.clear();aimPressPoint=null;aimGuideVisible=false;movementTap=null;const pointerId=aimPointerId;aimPointerId=null;if(pointerId!==null&&canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);battle.input={left:false,right:false,up:false,down:false,mouseDown:false,digits:[],space:false};battle.queuedAim=null;battle.queuedSelection=null;battle.hotbar.wheel=0;activationPulse=0;heldSpace=false;heldActivationKeys.clear();battle.shooter.cancel();}
function syncPanelShield(){for(const [id,panelId] of [['#pauseSkills','#skillsPanel'],['#openAim','#aimPanel']])$(id).setAttribute('aria-expanded',String(openPanelId===panelId));const active=!!openPanelId;$('#panelShield').classList[active?'remove':'add']('hidden');for(const selector of ['.topbar','.battle-screen','.command-deck','#intro','#pauseOverlay','#ending','#restartConfirm','#switchSessionConfirm'])$(selector).inert=active||!!pendingDestination&&selector!=='#switchSessionConfirm';}
function syncPause(){updateLevyMusterEntry(battle,document);syncPanelShield();const visible=started&&battle.paused&&!battle.outcome&&!openPanelId&&!hubOpen;$('#pauseOverlay').classList[visible?'remove':'add']('hidden');$('#pauseReason').textContent=pauseMessage;$('#battlePause').textContent=battle.paused?'▶ Resume':'Ⅱ Pause';$('#battlePause').setAttribute?.('aria-label',battle.paused?'Resume battle':'Pause battle');if(stressFieldOrigin)renderStressField(document,battle);}
function focusPanel(id){const node=$(id);(modalFocusCandidates(node)[0]??node)?.focus?.();}

function updateAimGuide(){const guides={classic:['Press the glowing ring at your castle. Pull back, then release to shoot.','Drag from the glowing ring to draw your bow','◎ ← ➶'],anywhere:['Press anywhere, pull opposite your shot, then release. The gold arrow starts at your hero; a longer pull adds power.','Pull anywhere; the gold arrow shows your hero’s launch direction and power','← ➶'],point_aim:['Tap the battlefield to shoot toward that point. Set power in Settings → precise controls.','Tap the battlefield to shoot in that direction','⊙ ➶'],auto_aim:['Tap where the target will be when your arrow arrives. The bow calculates an arc to that point; shots do not track.','Lead moving targets, then tap to fire a calculated arc','⌁ ➶']};const g=guides[profile.shootingMode]??guides.classic;$('#aimGuideTitle').textContent=['point_aim','auto_aim'].includes(profile.shootingMode)?'Choose your target.': 'Draw. Aim. Release.';$('#aimGuide').textContent=g[0];$('#aimTip').textContent=g[1];$('#aimDemo').textContent=g[2];canvas.setAttribute('aria-label',`Battlefield. ${g[0]} Movement and abilities are in the game HUD.`);$('#aimTip').classList.remove('hidden');}
let armoryReturnFromLoadout=false,armyReturnFromLoadout=false;
let armoryCatalog=null;
function syncSessionMenus(){
 campaignAtlas.leave();
 trainingEntrySignature='';
 armoryCatalog?.leave();
 $('#autoHelp').textContent=skirmishMode?'Automatic recruitment starts off for every practice attempt. Choose Auto orders in Army, or summon manually from your cards.':'Troop auto-summon is on by default. Manage it in Army & queue.';
 $('#restartDescription').textContent=skirmishMode?'Restart this seed with fresh practice supplies. This attempt’s gold, experience and saved decks are discarded. Export a deck code first.':'Enemies reset. Your earned gold and experience stay with this profile.';
 $('#profilesTitle').textContent=expeditionMode?'Charter banners':'Campaign profiles';$('#savePanelTitle').textContent=expeditionMode?'Charter vault':'Campaign vault';
 for(const [id,normal,charter] of [['#introSaveLabel','Save campaign','Save charter'],['#introLoadLabel','Load campaign','Load charter'],['#saveGameLabel','Save campaign','Save charter'],['#loadGameLabel','Load campaign','Load charter'],['#endingSave','Save campaign','Save charter'],['#endingLoad','Load campaign','Load charter'],['#downloadSave','Download campaign file','Download charter file'],['#showSaveCode','Show campaign code','Show charter code'],['#importCode','Load campaign code','Load charter code'],['#chooseSaveFile','Choose campaign file','Choose charter file'],['#saveCodeLabel','Your campaign code','Your charter code'],['#loadCodeLabel','Saved campaign code','Saved charter code'],['#restoreTitle','Restore a campaign','Restore a charter'],['#profilesEyebrow','YOUR CAMPAIGNS','YOUR CHARTER BANNERS'],['#newProfileTitle','Begin a new campaign','Begin a new charter'],['#localManage','Manage local saves','Open charter vault']])$(id).textContent=expeditionMode?charter:normal;
 $('#settingsSaveNote').textContent=skirmishMode?'Aiming applies to this practice session. Copy the seed code to recreate the field.':expeditionMode?'Export your charter to keep these preferences.':'Save your campaign to keep these preferences.';
 $('#restoreDescription').textContent=expeditionMode?'Restart a live field, or restore its settled result and route choice.':'Resume at the start of the saved battle.';
 $('#importDescription').textContent=expeditionMode?'Loading replaces the charter banners in this tab. Crownroad local checkpoints stay unchanged. Export your current charter first if you want a copy.':'Imports are reviewed before opening in a new local slot or for this session only. Existing local saves stay unchanged.';
 $('#saveCode').setAttribute('aria-label',expeditionMode?'Your charter code':'Your campaign code');$('#loadCode').setAttribute('aria-label',expeditionMode?'Paste a saved charter code':'Paste a saved campaign code');$('#loadCode').setAttribute('placeholder',expeditionMode?'Paste your charter code here':'Paste your campaign code here');$('#saveFile').setAttribute('aria-label',expeditionMode?'Import Wayfarer charter save file':'Import reconstruction save file');
 if(testingMode||demoMode)markTestingProfiles(profiles);
 for(const id of ['#openTesting','#introTesting','#pauseTesting','#endingTesting'])$(id).classList[testingMode?'remove':'add']('hidden');$('#launchTesting').classList[testingMode?'add':'remove']('hidden');$('#testModeBadge').classList[profile.cheated?'remove':'add']('hidden');$('#testModeBadge').textContent=demoMode?'DEMO':testingMode?'TEST':'ASSISTED';$('#testModeBadge').setAttribute('aria-label',demoMode?'Assisted midgame demo':testingMode?'Assisted playground':'Assisted profile');
 for(const section of document.querySelectorAll('[data-demo-only]'))section.classList[demoMode?'remove':'add']('hidden');$('#pauseDemo').classList[demoMode?'add':'remove']('hidden');$('#gameShell').dataset.demo=String(demoMode);$('#pauseAlliesDemo').classList[demoMode?'add':'remove']('hidden');$('#demoPresetDescription').textContent=recruitShowcase?'Assisted allies showcase · supplied Fire Dragon already on the field · Gorath hired and ready to summon. Tap his separate control, then command Earthshatter. New recreation mechanics and provisional balance.':'Assisted preset · rank 8 hero/basic arrow · rank 2 acquired skills · heavy infantry and cavalry · automatic army recruitment · 1,500 gold budget.';
 if(demoMode&&destinationSessions.has('campaign')){$('#demoReturn').textContent='Return to campaign lobby';$('#demoReturnNote').textContent='Your campaign is preserved in this tab. Choose Campaign in the player lobby to return.';for(const button of document.querySelectorAll('[data-demo-action="return"]'))button.textContent='Return to campaign lobby';for(const note of document.querySelectorAll('[data-demo-session-note]'))note.textContent='This assisted session has its own profile and gold. Your campaign is preserved in this tab.';}
 if(demoMode&&window.parent&&window.parent!==window){$('#demoReturn').textContent='Back to playground';$('#demoReturnNote').textContent='This is a separate demo inside the viewport lab.';for(const button of document.querySelectorAll('[data-demo-action="return"]'))button.textContent='Back to playground';}
 $('#introText').textContent=testingMode?'Assisted playground. Try any battle or ability with test controls. This separate profile is marked as assisted.':'Defend your flag. Destroy the enemy keep to cut off reinforcements, then defeat the remaining army. Or bring their flag home.';
 cancelPendingImport();$('#saveCode').value='';$('#loadCode').value='';$('#saveCodeArea').classList.add('hidden');openPanelId=null;syncPanelShield();$('#introNotice').textContent='';$('#saveStatus').textContent=expeditionMode?'Export a charter file or code before closing. Charter progress stays in this tab.':'Local checkpoints are available for campaigns. Export a file for a backup.';$('#endingSaveStatus').textContent=expeditionMode?'Export a charter file or code to keep this settled result and route.':'Your settled result can be checkpointed locally. Export a file for a backup.';panelResume=false;loadoutReturnPanel=null;pendingDelete=null;bindingLayout=null;$('#battlePause').disabled=!started;updateAimGuide();$('#pauseOverlay').classList.add('hidden');$('#restartConfirm').classList.add('hidden');for(const id of ['#settingsPanel','#profilesPanel','#shopPanel','#testingPanel','#queuePanel','#savePanel','#skillsPanel','#aimPanel','#campaignPanel','#expeditionPanel','#controlsPanel','#skirmishPanel','#battleReportPanel'])$(id)?.classList.add('hidden');
}
function attachLiveSkills(){
 liveSkills=createLiveSkillAdapter(battle,{canAct:()=>started&&!battle.paused&&!battle.outcome&&!battle.summary&&!openPanelId,onSummonResult:({skill,accepted,cancelled})=>{if(cancelled)return;status(accepted?SKILLS[skill.id].name+' squad queued':summonMessage(skill,profile,battle.friendlyQueue));visualDirty=true;}});
}
function setup(level=Math.min(30,Math.max(1,profile.highestLevel))){
 invalidateRenderProfile();
 const stressSetup=stressFieldPreset?createStressField({preset:stressFieldPreset,shootingMode:profile.shootingMode}):null;
 if(stressSetup){profiles=stressSetup.profiles;profile=profiles.active;}
 started=false;hubOpen=true;selectedDestination=activeDestination;
 armoryReturnFromLoadout=false;armyReturnFromLoadout=false;
 if(battle)clearInput();
 const trainingOptions=trainingRun?createTrainingBattleOptions(trainingRun):null;if(trainingOptions){profiles=new CampaignProfiles({profiles:[trainingOptions.profile]});profile=profiles.active;level=1;}
 const demoOptions=demoLaunch;demoLaunch=null;portraitCenter=null;portraitOverview=false;
 aimCamera=null;aimGuideVisible=false;if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();movementOwners.clear();liveSkills?.dispose();barSignature='';selectedWrapper=null;editorBar=0;
 combatPoses=createCombatPoseController();specialMotion=createSpecialMotionController();
 syncSessionMenus();
 const campaignStartSnapshot=campaignBattleSnapshot(profile);
 const completed=!skirmishMode&&!expeditionMode&&profile.highestLevel>30,savedProgress=completed?{level:profile.level,scene:profile.scene,highestLevel:profile.highestLevel,highestScene:profile.highestScene}:null;
 const dragonCounterGuide=createDragonCounterGuide();
 const battleReport=createBattleReportRecorder();
 let lineReleased=false;
 const onBattleEvent=event=>{
  battleReport.record(event);
  battle?.guidedTraining?.observe(event);combatPoses.event(event);specialMotion.event(event);
  const elementalCue=dragonCounterGuide(event)??elementalNotice(event);if(elementalCue)notices.push(elementalCue);
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
  if(event.type==='army-order'){lineReleased=event.mode==='advance'?event.tick:null;visualDirty=true;status(armyOrderStatus(battle));}
  if(event.type==='enemy-reserves-withdrawn'){status('Enemy keep destroyed. Reinforcements cut off. '+(lineReleased===event.tick?'Ground line released. ':'')+(battle.causewayObjective?'Secure the causeway, clear the deployed army and restore your home flag.':battle.auxiliaries?'Clear the remaining army and restore your home flag.':'Defeat the remaining army or capture their flag.'));lineReleased=false;}
  if(event.type==='causeway-secured'){status(`Causeway secured. ${event.withdrawn} undeployed enemies withdrawn. Both companies advance. Clear deployed enemies and restore your home flag.`);lineReleased=false;visualDirty=true;}
  if(event.type==='synthetic-field-stopped'){clearInput();pauseMessage=event.reason;syncPause();renderStressField(document,battle);visualDirty=true;}
  if(event.type==='outcome')status(event.outcome==='victory'?'Victory! Counting the spoils…':castlePracticeFeedbackState(battle)?.reason|| (battle.causewayObjective?causewayFeedbackState(battle).reason:battle.auxiliaries?levyFeedbackState(battle).reason:battle.hero.dead?'Your hero fell':'The enemy captured your flag'));
  if(event.type==='summary'){
   $('#endingTitle').textContent=(profile.cheated?'Assisted · ':'')+(event.summary.campaignComplete?'Campaign complete':event.summary.outcome==='victory'?'Victory':'Defeat');
   $('#endingText').textContent=event.summary.campaignComplete?(profile.cheated?'Assisted final-battle result. Test profiles can jump ahead; this is not a verified 30-battle playthrough.':'You have completed all 30 battles in this reconstruction. Original-runtime parity remains under review.'):event.summary.outcome==='victory'?`Battle ${battle.level} won. Bonus: ${event.summary.gold} gold and ${event.summary.xp} XP.`:'Keep the gold and experience you earned. Review your deck, then defend your flag again.';
   $('#replay').textContent=event.summary.campaignComplete?completedCampaignLabel():event.summary.outcome==='victory'?`Continue to battle ${battle.level+1}`:'Retry battle';if(activeDestination==='campaign'){const report=campaignSettlement(battle,battle.campaignStartSnapshot);renderCampaignRewards($('#campaignRewards'),report);if(report&&battle.campaignReplay&&report.won)$('#replay').textContent=report.nextLabel;}if(expeditionMode)syncExpeditionIdentity();if(skirmishMode)syncSkirmishIdentity();$('#ending').classList.remove('hidden');$('#replay').focus?.();localCampaign?.checkpoint('result');
  }
 };
 battle=stressSetup?stressSetup.battle:skirmishMode?new SkirmishBattle({descriptor:skirmishDescriptor,profile,onEvent:onBattleEvent}):expeditionMode?new ExpeditionBattle({run:profiles.activeRun,onEvent:onBattleEvent}):new CampaignBattle({...({profile,level,testing:testingMode,random:Math.random}),...(demoOptions??{}),...(trainingOptions??{}),onEvent:demoOptions?()=>{}:onBattleEvent});
 if(stressSetup)battle.onEvent=onBattleEvent;
 battleReports.set(battle,battleReport);
 battle.campaignStartSnapshot=campaignStartSnapshot;battle.campaignReplay=activeDestination==='campaign'&&!completed&&level<campaignStartSnapshot.frontier;
 if(demoOptions){(recruitShowcase?prepareRecruitShowcaseBattle:prepareMidgameDemoBattle)(battle);battle.onEvent=onBattleEvent;}
 if(testingMode&&!stressFieldPreset)protectTestBattle(battle,testingProtection);if(trainingOptions){prepareTrainingBattle(battle,trainingRun);portraitOverview=false;}
 if(completed){Object.assign(profile,savedProgress);battle.outcome='victory';battle.summary={outcome:'victory',campaignComplete:true,gold:0,xp:0};}
 combatPoses.attach(battle);specialMotion.attach(battle);
 attachLiveSkills();
 clock=new SimulationClock({onTick:()=>{const profilerTickStart=renderProfiler.recording?performance.now():null;const actorsAdvanced=!battle.paused&&!battle.summary&&!battle.outcome;const tap=movementTap;movementTap=null;if(tap)battle.input[tap]=true;liveSkills.beforeTick();battle.step();battle.guidedTraining?.afterTick();liveSkills.afterTick();if(battle.outcome)liveSkills.clear();combatPoses.observeTick({actorsAdvanced});specialMotion.observeTick({actorsAdvanced});if(tap){battle.input[tap]=false;movementOwners.sync();}if(activationPulse>0)--activationPulse;battle.input.space=heldSpace||activationPulse>0;if(profilerTickStart!==null)renderProfiler.tick(profilerTickStart,performance.now());}});notices=[];now=performance.now();barSignature='';
 $('#battleTitle').textContent=isUnitTrial(trainingRun)?`${SKILLS[trainingRun.cardId].name} · field trial`:`${testingMode?'Playground · ':profile.cheated?'Assisted · ':''}Battle ${battle.level}${profile.cheated?'':' · Capture the flag'}`;renderHub();
 $('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;updatePowerMode();drawHotbar();if(completed){$('#intro').classList.add('hidden');$('#ending').classList.remove('hidden');$('#endingTitle').textContent=(profile.cheated?'Assisted · ':'')+'Campaign complete';$('#endingText').textContent=profile.cheated?'This assisted profile has a final-battle result. Export it to keep the record, or begin a new campaign.':'This saved campaign has completed all 30 battles. Export it to keep the record, or begin a new campaign.';$('#replay').textContent=completedCampaignLabel();}
 if(expeditionMode){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}
 if(stressSetup){started=true;hubOpen=false;battle.paused=true;$('#intro').classList.add('hidden');$('#ending').classList.add('hidden');$('#battlePause').disabled=false;}
 syncPause();renderStressField(document,battle);localCampaign?.checkpoint('ready');
}
localCampaign=createLocalCampaignUI({document,window,chooseBeforeCreate:localSaveEntryRequested,getState:()=>({profiles,battle,started,destination:activeDestination,temporarySession:temporarySessionActive(),deckPresets:profileDecks.snapshot(profiles)}),openVault:()=>showCampaignVault(),notify:status,onRestore:(manager,payload)=>{if(temporarySessionActive())return;profileDecks.restore(manager,payload?.deckPresets);profiles=manager;profile=profiles.active;started=false;setup();if(!battle.summary?.campaignComplete)showHub();}});
const liveRallyPositionUI=createLiveRallyPositionUI({root:$('#liveRallyPosition'),getState:()=>({battle,active:canIssueLiveArmyOrder(),started,readOnly:!!trainingRun,visible:hasCommandArmy()&&!trainingRun}),onChanged:()=>{visualDirty=true;renderLiveArmyOrder();status(armyOrderStatus(battle));canvas.focus?.();}});

setup();
$('#pauseAlliesDemo').onclick=()=>startMidgameDemo(true);$('#pauseDemo').onclick=startMidgameDemo;$('#demoReturn').onclick=returnFromDemo;$('#demoRestart').onclick=restartMidgameDemo;
for(const button of document.querySelectorAll('[data-demo-action]'))button.onclick=button.getAttribute('data-demo-action')==='return'?returnFromDemo:restartMidgameDemo;
for(const id of ['#introBattleReport','#pauseBattleReport','#testBattleReport'])$(id).onclick=showBattleReport;
$('#buildLabel').textContent=`Build ${GAME_BUILD}`;$('#testingBuild').textContent=`Loaded build ${GAME_BUILD}`;
function begin(){if(started||openPanelId||battle.summary?.campaignComplete||expeditionMode&&(profiles.activeRun.choosing||profiles.activeRun.complete))return;if(!localCampaign.beforeBegin())return;hubOpen=false;cancelPendingImport();canvas.focus?.();started=true;battle.paused=false;clearInput();$('#pauseOverlay').classList.add('hidden');$('#intro').classList.add('hidden');$('#ending').classList.add('hidden');$('#battlePause').disabled=false;syncPause();drawHotbar();status(profile.shootingMode==='classic'?'Pull back from the castle ring to fire. Watch for enemies carrying your flag.':'Aim on the battlefield. Protect your flag carriers.');now=performance.now();}
function restart(){if(stressFieldOrigin){resetStressField();return;}if(skirmishMode){prepareSkirmish();begin();return;}if(trainingRun){restartGuidedDrill();return;}const level=battle.level;if(expeditionMode)profiles.activeRun.retry();setup(level);begin();}
for(const id of ['#introAtlas','#pauseAtlas','#endingAtlas'])$(id).onclick=showCampaignAtlas;$('#closeAtlas').onclick=()=>panel('#campaignPanel',false);
for(const id of ['#introRoute','#pauseRoute','#endingRoute'])$(id).onclick=showExpeditionRoute;$('#closeRoute').onclick=()=>panel('#expeditionPanel',false);
$('#start').onclick=startFromHub;$('#pauseLobby').onclick=showHub;$('#endingLobby').onclick=showHub;$('#hubOpenSeparate').onclick=()=>openDestination(selectedDestination);$('#cancelSessionSwitch').onclick=cancelSessionSwitch;$('#confirmSessionSwitch').onclick=()=>{if(pendingDestination)switchDestination(pendingDestination);};$('#separateSessionSwitch').onclick=()=>{if(pendingDestination)openDestination(pendingDestination);cancelSessionSwitch();};$('#battleRestart').onclick=()=>{$('#restartConfirm').classList.remove('hidden');$('#confirmRestart').focus?.();};$('#confirmRestart').onclick=()=>{restart();};$('#cancelRestart').onclick=()=>{$('#restartConfirm').classList.add('hidden');$('#resumeGame').focus?.();};$('#replay').onclick=()=>{if(skirmishMode){if(!battle.summary)return;prepareSkirmish();return;}if(expeditionMode){const run=profiles.activeRun;if(run.complete){profiles.retireCurrent();profile=profiles.active;setup();showHub();return;}if(run.choosing){showExpeditionRoute();return;}run.retry();setup();begin();return;}if(battle.summary?.campaignComplete){if(!profile.cheated&&profile.victories+profile.defeats===0){$('#endingText').textContent='This imported completion has no recorded battles. Choose Profiles to switch campaigns, or Load campaign to use another file.';status('Choose another profile or load a campaign file');return;}const chooseExisting=profiles.profiles.length>1;profile.scene=profile.highestScene=33;profiles.retireCurrent();profile=profiles.active;if(chooseExisting){started=false;setup();if(!battle.summary?.campaignComplete){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}showProfiles();status('Campaign retired. Choose a campaign when you’re ready.');return;}}setup();begin();};
function pause(force,reason){if(!started||battle.summary||battle.outcome)return;if(isStressField(battle)&&battle.stressField.stopped){battle.paused=true;syncPause();renderStressField(document,battle);return;}const next=typeof force==='boolean'?force:!battle.paused;if(!next&&(hubOpen||openPanelId||!$('#restartConfirm').classList.contains('hidden')))return;battle.paused=next;if(next)renderProfiler.interrupt(performance.now(),document.hidden?'hidden':'paused');clearInput();if(reason)pauseMessage=reason;else if(next)pauseMessage='Take your time. Your battlefield is frozen.';now=performance.now();syncPause();if(!next){cancelPendingImport();canvas.focus?.();status('Battle resumed');}else if(!openPanelId)$('#resumeGame').focus?.();}
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
function queuePlayerShot(aim,skill=battle.activeSkill){if(!hasEquippedBow()){status('No bow equipped. Open Loadout to equip your free Basic Arrow.');return;}if(aim?.canFire&&!battle.queuePlayerShot(aim,skill))status('Shot queue is full');}
function fire(){const r=angle*Math.PI/180,o=battle.hero.launchPosition,speed=profile.shootingMode==='point_aim'?25*power/100:22.8*power/100;const aim=profile.shootingMode==='classic'||profile.shootingMode==='anywhere'?aimVector(o,{x:o.x-180*power/100*Math.cos(r),y:o.y+180*power/100*Math.sin(r)}):{vx:Math.cos(r)*speed,vy:-Math.sin(r)*speed,canFire:true};queuePlayerShot(aim);}
$('#battleFire').onclick=()=>{if(!started||battle.paused||battle.outcome||openPanelId)return;fire();canvas.focus?.();};$('#applyAim').onclick=()=>{updatePowerMode();closePrecision();};$('#activate').onclick=()=>{if(!started||battle.paused||battle.outcome||openPanelId)return;activationPulse=1;battle.input.space=true;canvas.focus?.();};
function syncAimSettings(){const auto=$('#aimMode').value==='auto_aim';$('#trajectory').disabled=!auto;}
function renderArcControl(){
 const button=$('#liveArc'),auto=profile.shootingMode==='auto_aim',high=Number(battle?.shooter?.angleMode)===0;
 button.classList[auto?'remove':'add']('hidden');button.disabled=!started||battle.paused||!!battle.outcome||!!battle.summary||!!openPanelId;
 $('#liveArcLabel').textContent=high?'High arc':'Low arc';button.setAttribute('aria-pressed',String(high));
 button.setAttribute('aria-label',`${high?'High':'Low'} arc selected. Switch to ${high?'low':'high'} arc. Shortcut ${controlLabel('arc')}.`);
 button.setAttribute('title',`Switch to ${high?'low':'high'} arc · ${controlLabel('arc')}`);
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
 const profilerInputStart=renderProfiler.recording?performance.now():null;
 if(!started||battle.paused||battle.outcome||aimPointerId!==null||event.button!==0)return;
 const p=point(event);if(!p)return;const o=battle.hero.launchPosition;
 if(profile.shootingMode==='classic'&&Math.hypot(p.x-o.x+.3,p.y-o.y+.3)>launchRingRadius()){status('Begin inside the ring, then pull back to aim');return;}
 if(profilerInputStart!==null)renderProfiler.input(profilerInputStart,event.isTrusted===true);
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
function finishAim(event,cancel=false){const profilerInputStart=renderProfiler.recording?performance.now():null;if(event.pointerId!==aimPointerId)return;if(cancel){aimGuideVisible=false;aimPressPoint=null;aimCamera=null;}aimPointerId=null;battle.input.mouseDown=false;if(cancel){battle.cancelPlayerShots();battle.shooter.cancel();}else{
 const released=point(event);if(!released){aimCamera=null;aimPressPoint=null;battle.shooter.cancel();return;}
 if(profilerInputStart!==null)renderProfiler.input(profilerInputStart,event.isTrusted===true);
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
document.addEventListener('keydown',event=>{
 const key=controlEventKey(event),digitSlot=eventToSlot(event);
 if(isControlComposition(event))return;
 if(openPanelId==='#controlsPanel'&&controlsUI.handleKey(event))return;
 if(hasControlModifier(event)&&key!=='tab')return;
 if(key==='escape'){if(event.repeat){event.preventDefault();return;}if(!$('#switchSessionConfirm').classList.contains('hidden'))cancelSessionSwitch();else if(!$('#restartConfirm').classList.contains('hidden'))$('#cancelRestart').onclick();else if(openPanelId){if(openPanelId==='#skirmishPanel')closeSkirmishWorkshop();else if(openPanelId==='#campaignPanel'&&campaignAtlas.back()){}else if(openPanelId==='#expeditionPanel'&&expeditionRoute.back()){}else if(openPanelId==='#queuePanel'&&armyCommand.back()){}else if(openPanelId==='#shopPanel'&&armoryCatalog.back()){}else if(openPanelId==='#skillsPanel'){if(!deckPresets.back()&&!loadoutCollection.back()&&!closeLoadoutRefine()&&!cancelLoadoutSelection())closeLoadout();}else if(openPanelId==='#aimPanel')closePrecision();else if(openPanelId==='#controlsPanel')closeControls();else if(openPanelId==='#battleReportPanel')battleReportUI.close();else if(openPanelId===loadoutReturnPanel)closeChildPanel(openPanelId);else panel(openPanelId,false);}else if(document.fullscreenElement){clearInput();pause(true,'Leaving full screen. Resume when you’re ready.');Promise.resolve(document.exitFullscreen?.()).catch(()=>displayModeMessage('Full screen could not close. Use the browser’s exit control.'));}else if(started&&!battle.outcome&&!hubOpen)pause();event.preventDefault();return;}
 const modal=!$('#switchSessionConfirm').classList.contains('hidden')?$('#switchSessionConfirm'):openPanelId?$(openPanelId):!$('#restartConfirm').classList.contains('hidden')?$('#restartConfirm'):!$('#pauseOverlay').classList.contains('hidden')?$('#pauseOverlay'):!$('#intro').classList.contains('hidden')?$('#intro'):!$('#ending').classList.contains('hidden')?$('#ending'):null;
 if(key==='tab'&&modal?.querySelectorAll){const items=modalFocusCandidates(modal);if(items.length){const i=items.indexOf(document.activeElement);if(event.shiftKey&&(i<=0)){items.at(-1).focus();event.preventDefault();}else if(!event.shiftKey&&(i<0||i===items.length-1)){items[0].focus();event.preventDefault();}}return;}
 if(isControlTextTarget(event.target))return;
 const action=controls.action(event),owner=event.code||key;
 // Space remains native button activation while a button has focus.
 if(key===' '&&event.target?.tagName==='BUTTON')return;
 if(event.repeat){if(action||digitSlot!==null)event.preventDefault();return;}
 if(action==='pause'&&started&&!hubOpen&&!battle.outcome&&!openPanelId&&(!modal||modal===$('#pauseOverlay'))){pause();event.preventDefault();return;}
 if(!started||battle.paused||battle.outcome||modal)return;
 if(action==='companion'||action==='arc'||action==='armyOrder'){
  if(action==='companion')companionUI.act();else if(action==='armyOrder')toggleLiveArmyOrder();else toggleLiveArc();
  event.preventDefault();return;
 }
 if(action==='previousBar'||action==='nextBar'){cycleBar(action==='previousBar'?-1:1);event.preventDefault();return;}
 if(['left','right','up','down'].includes(action)){movementOwners.keyDown(owner,action);if(action==='up'||action==='down')movementTap=action;event.preventDefault();}
 if(digitSlot!==null){
  // Capture the edge too: a short tap can begin and end between 33 Hz ticks.
  // Preserve the fixed 1–9, 0 slots and the adapter's queued summon identity.
  const skill=battle.hotbar.bars[battle.hotbar.bar]?.[digitSlot];if(skill)chooseSkill(skill.id);
  battle.input.digits=[...new Set([...(battle.input.digits??[]),digitSlot])];event.preventDefault();
 }
 if(action==='activate'){heldActivationKeys.add(owner);activationPulse=1;heldSpace=true;battle.input.space=true;event.preventDefault();}
});
document.addEventListener('keyup',event=>{const owner=event.code||controlEventKey(event),digitSlot=eventToSlot(event);movementOwners.keyUp(owner);if(digitSlot!==null)battle.input.digits=(battle.input.digits??[]).filter(n=>n!==digitSlot);if(heldActivationKeys.delete(owner)){heldSpace=heldActivationKeys.size>0;battle.input.space=heldSpace||activationPulse>0;}});
document.addEventListener('compositionstart',()=>{controlsUI.cancelCapture();clearInput();});
document.addEventListener('focusin',event=>{if(isControlTextTarget(event.target))clearInput();});
for(const button of document.querySelectorAll('[data-key]')){const key=button.dataset.key;if(key==='up'||key==='down')button.addEventListener('click',()=>{if(started&&!battle.paused&&!battle.outcome&&!openPanelId)movementTap=key;});button.addEventListener('pointerdown',event=>{if(!started||battle.paused||battle.outcome||openPanelId)return;movementOwners.pointerDown(event.pointerId,key,button);button.setPointerCapture(event.pointerId);event.preventDefault();});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>movementOwners.pointerEnd(e.pointerId,button));}
canvas.addEventListener('wheel',event=>{if(started&&!battle.paused){battle.hotbar.wheelEvent(-event.deltaY);event.preventDefault();}},{passive:false});
function cycleBar(direction=1){if(!started||battle.paused||battle.outcome||openPanelId)return;battle.hotbar.change(direction);battle.activeSkill=battle.hotbar.active;drawHotbar();canvas.focus?.();}
$('#nextBar').onclick=()=>cycleBar(1);
window.addEventListener('blur',()=>{controlsUI.cancelCapture();clearInput();pause(true,'The battlefield lost focus. Resume when you’re ready.');});
document.addEventListener('visibilitychange',()=>{now=performance.now();renderProfiler.interrupt(now,document.hidden?'hidden':'paused');clearInput();if(document.hidden&&started&&!battle.paused)pause(true,'You left the battlefield. Tap Resume when you’re ready.');else syncPause();});
function chooseSkill(id){
 const ref=boundSkillRefs(battle.hotbar).find(ref=>ref.id===id);if(!ref||!liveSkills.choose(ref.skill))return;
 status(SKILLS[id].summon?SKILLS[id].name+' summon requested':SKILLS[id].name+' selected');
 drawHotbar();canvas.focus?.();
}
function currentAutoAimFeedback(){
 if(profile.shootingMode!=='auto_aim'||!aimGuideVisible||!started||battle.paused||battle.outcome||openPanelId)return null;
 return autoAimFeedback(battle.hero.launchPosition,battle.shooter.guide??battle.shooter.pointer,battle.shooter);
}
function hasEquippedBow(){return profile.skills.some(skill=>skill.binding>=0&&!SKILLS[skill.id]?.summon);}
function hasCommandArmy(){return profile.skills.some(skill=>!!SKILLS[skill.id]?.summon)||battle.regularArmyCount>0;}
function canIssueLiveArmyOrder(){return started&&!hubOpen&&!openPanelId&&!battle.paused&&!battle.outcome&&!battle.summary&&!trainingRun&&hasCommandArmy();}
function renderLiveArmyOrder(){
 const button=$('#liveArmyOrder'),holding=battle.armyOrder.mode!=='advance',split=battle.armyOrder.mode==='split',line=armyRallyPositionLabel(battle.armyOrder.position);
 button.classList[hasCommandArmy()&&!trainingRun?'remove':'add']('hidden');button.disabled=!canIssueLiveArmyOrder()||!holding&&!rallyEligible(battle);button.setAttribute('aria-pressed',String(holding));
 $('#liveArmyOrderLabel').textContent=split?'Split':holding?'Rally':'Advance';button.setAttribute('aria-label',`${split?'Split company orders. ':''}All ground ${holding?'holding':'advancing'}. ${holding?'Release both companies and advance all ground':`Rally all ground at the ${line.toLowerCase()} line`} · ${controlLabel('armyOrder')}`);button.setAttribute('title',`${split?'Split orders. ':''}${holding?'Advance all ground; replaces both company orders':`Rally all ground at the ${line.toLowerCase()} line`} · ${controlLabel('armyOrder')}`);
 liveRallyPositionUI.render();
}
function toggleLiveArmyOrder(){if(!canIssueLiveArmyOrder())return;if(battle.setArmyOrder(battle.armyOrder.mode==='advance'?'rally':'advance',undefined,'all')){visualDirty=true;renderLiveArmyOrder();status(armyOrderStatus(battle));}}
$('#liveArmyOrder').onclick=event=>{if(event.detail>1)return;toggleLiveArmyOrder();};
function drawHotbar(){
 // A deliberately bowless loadout may still command squads and a companion.
 // Never keep an omitted bow (or a squad) as the pointer-shot selection.
 if(!hasEquippedBow()){battle.activeSkill=null;battle.hotbar.active=null;battle.cancelPlayerShots();battle.shooter.cancel();}
 companionUI.renderLive();
 renderArcControl();renderLiveArmyOrder();
 const state=liveBarState(battle.hotbar,SKILLS),items=state.entries;
 if(state.signature!==barSignature){
  $('#hotbar').innerHTML=items.map(({skill,id,slot})=>`<button id="quick-${id}" class="live-slot" data-hud-surface data-hud-control="primary" aria-label="${SKILLS[id].name}" title="${SKILLS[id].name}"><span class="live-key" aria-hidden="true">${slotToKey(slot)}</span><span class="skill-icon" aria-hidden="true">${skillIcon(id)}</span><span class="live-short-name">${shortNames[id]??SKILLS[id].name}</span><span class="live-countdown hidden" id="quick-cd-${id}" aria-hidden="true"></span><span class="live-cooldown-fill" id="quick-fill-${id}" aria-hidden="true"></span><span class="live-auto hidden" id="quick-auto-${id}" aria-hidden="true"></span></button>`).join('');
  for(const {id} of items)$('#quick-'+id).onclick=()=>chooseSkill(id);
  $('#hotbar').setAttribute('style',`--live-columns:${state.portraitColumns}`);
  barSignature=state.signature;
 }
 const canAct=started&&!openPanelId&&!battle.paused&&!battle.outcome;
 if(!hasEquippedBow())$('#battleFire').disabled=true;
 $('.live-action-bar').dataset.livePages=String(state.populatedBars.length);$('.live-action-bar').setAttribute('aria-label',`Equipped skills, bar ${state.bar+1} of 3`);
 $('#barLabel').textContent=state.label;$('#nextBar').setAttribute('aria-label',state.cycleLabel);$('#nextBar').classList[state.canCycle?'remove':'add']('hidden');$('#nextBar').disabled=!canAct;
 $('.live-hud').dataset.armyPage=String(state.currentHasSummons);$('#liveArmyResources').classList[state.currentHasSummons?'remove':'add']('hidden');$('#liveArmyResources').textContent=`${Math.floor(profile.gold)} gold · Army slots ${battle.regularArmyCount}/${battle.friendlyQueue.cap} · Reserve ${battle.friendlyQueue.population} · Queue ${battle.friendlyQueue.queue.length}`;
 for(const {skill,id,slot} of items){const button=$('#quick-'+id),info=liveSlotStatus(skill,SKILLS,profile,battle.friendlyQueue);button.disabled=!canAct;button.setAttribute('aria-pressed',String(skill===battle.activeSkill));button.setAttribute('aria-label',`${info.ariaLabel}, key ${slotToKey(slot)}`);button.dataset.affordable=String(info.affordable);button.dataset.cooling=String(info.remainingSeconds>0);button.dataset.kind=SKILLS[id].summon?'army':'bow';$('#quick-cd-'+id).textContent=info.remainingSeconds?`${info.remainingSeconds}s`:'';$('#quick-cd-'+id).classList[info.remainingSeconds?'remove':'add']('hidden');$('#quick-fill-'+id).style.width=`${100*info.fraction}%`;$('#quick-auto-'+id).classList[skill.autocast?'remove':'add']('hidden');}
 updateCombatHud(battle,{controlLabel,aiming:aimPointerId!==null,angle,power,autoAimStatus:currentAutoAimFeedback()});if(expeditionMode){$('#combatBattleTitle').textContent=`Charter · ${profiles.activeRun.current.leg}/4`;if(profiles.activeRun.current.objective==='break-keep')$('#combatEnemyState').textContent=`Break keep · ${Math.ceil(battle.badCastle.hp/battle.badCastle.maxHp*100)}% HP`;};if(trainingRun){$('#combatBattleTitle').textContent='Guided practice';$('#combatEnemyState').textContent=trainingLesson(trainingRun)?`Drill ${trainingRun.index+1} of ${TRAINING_LESSONS.length} · Assisted`:'Review your loadout';}if(isUnitTrial(trainingRun)){$('#combatBattleTitle').textContent=SKILLS[trainingRun.cardId].name+' trial';$('#combatEnemyState').textContent='Supplied field · no rewards';}if(skirmishMode)$('#combatBattleTitle').textContent='Skirmish · Practice';
}
let bindingArmed=false,bindingMessage='';
const bindingLabel=binding=>binding<0?'Reserve':`Bar ${Math.floor(binding/10)+1} · key ${slotToKey(binding%10)}`;
function selectLoadoutAbility(wrapper,focusId){
 selectedWrapper=wrapper;bindingArmed=true;bindingMessage='';drawOwnedSkills();if(focusId)$('#'+focusId)?.focus?.();
}
const loadoutCollection=createLoadoutCollectionUI({controlLabel,root:$('#skillsPanel'),records:buildArmoryRecords(SKILLS,COMPANIONS,descriptions),getState:()=>({layout:bindingLayout,selected:selectedWrapper,armed:bindingArmed,bar:editorBar,message:bindingMessage,profile}),icon:skillIcon,bindingLabel,onSelect:selectLoadoutAbility,onMove:moveBinding,onBar:bar=>{editorBar=bar;drawOwnedSkills();}});
// Shared live-loadout mutation seam; deck library bookkeeping remains separate.
function canMutateLoadout(){return !(skirmishMode&&battle.summary)&&openPanelId==='#skillsPanel'&&bindingLayout&&!bindingLayout.closed&&(!started||battle.paused||!!battle.summary);}
function castleDeckContext(){return {battle,started,paused:battle.paused,summary:!!battle.summary,activeCompanion:!!battle.companions.unit,prepareCastle:selection=>prepareCastleSelection(battle,selection,{started,profile})};}
function equipCastleCard(selection,expectedProfile=profile){
 if(expectedProfile!==profile||stressFieldOrigin||!(openPanelId==='#skillsPanel'||openPanelId==='#shopPanel')||skirmishMode&&battle.summary||battle.summary?.campaignComplete)return {ok:false,message:'This castle cannot be changed here.'};
 if(selection.id===profile.castleId&&selection.level===profile.castleLevels.get(profile.castleId))return {ok:true,changed:false};
 try{const deck=captureDeck(profile,'Current arrangement');deck.castle=selection;const result=applyDeck(deck,profile,castleDeckContext());if(!result.ok)return result;clearInput();visualDirty=true;if(openPanelId==='#skillsPanel')drawOwnedSkills();else castleLoadout.render();localCampaign?.checkpoint('loadout');return result;}catch(error){return {ok:false,message:error.message};}
}
const castleLoadout=createCastleLoadoutUI({root:$('#castleLoadout'),getState:()=>({profile,started,summary:!!battle.summary,readOnly:!!stressFieldOrigin||skirmishMode&&!!battle.summary||!!battle.summary?.campaignComplete}),onEquip:(selection,context)=>equipCastleCard(selection,context.profile),onPaletteApply:(id,context)=>{
 if(context.profile!==profile||!canMutateLoadout()||stressFieldOrigin)return {ok:false};profile.paletteId=validatePlayerPaletteId(id);visualDirty=true;localCampaign?.checkpoint('settings');return {ok:true};
},onFindCastles:()=>{shop();armoryCatalog.openDepartment('castles');}});
const deckPresets=createDeckPresetsUI({controlLabel,root:$('#skillsPanel'),getState:()=>({profile,battle,started,blocked:!!stressFieldOrigin,readOnly:skirmishMode&&!!battle.summary,closeLabel:skirmishMode&&battle.summary?(hubOpen?'Back to lobby':'Back to results'):null}),onClose:()=>{if(skirmishMode&&battle.summary)closeLoadout(false);},getDecks:()=>profileDecks.get(profile),setDecks:decks=>profileDecks.set(profile,decks),storageMessage:()=>activeDestination==='campaign'?`${started&&!battle.summary?'Paused-battle deck changes stay in this session until a settled-result checkpoint.':'Deck changes join this campaign’s next safe checkpoint.'} ${localCampaign?.message()??'Session only; keep a deck code before closing.'}`:skirmishMode?'Skirmish decks belong only to this practice attempt. Export a deck code before a fresh retry, restart or new field; its new supplied profile starts with an empty library.':trainingRun?'Guided-practice decks belong to this drill’s supplied profile. Restarting or changing drills creates a fresh profile; keep a deck code to reuse them.':'Practice decks stay in this session. Keep their deck code before closing.',onChange:()=>{localCampaign?.checkpoint('loadout').then(()=>deckPresets.render());},onRecoverArrow:()=>recoverBasicArrow(),onApply:deck=>{
 if(!canMutateLoadout())return {ok:false};
 const result=applyDeck(deck,profile,castleDeckContext());if(!result.ok)return result;
 if(result.castleChanged||!hasEquippedBow())clearInput();
 visualDirty=true;loadoutDrag.cancel();const refresh=bindingLayout.onRefresh;bindingLayout.close();bindingLayout=new ActionBarLayout(profile.skills,{refresh});selectedWrapper=bindingLayout.dragIcons.find(w=>w.skill===battle.activeSkill)??bindingLayout.dragIcons[0];bindingArmed=false;bindingMessage=`“${deck.name}” applied. Omitted cards remain in reserve.`;barSignature='';drawHotbar();drawOwnedSkills();localCampaign?.checkpoint('loadout').then(()=>deckPresets.render());return result;
}});
function drawOwnedSkills(){companionUI.renderLoadout();castleLoadout.render();if(!bindingLayout||bindingLayout.closed)return;selectedWrapper=bindingLayout.dragIcons.includes(selectedWrapper)?selectedWrapper:bindingLayout.dragIcons[0];loadoutCollection.render();$('#loadoutBowRecovery').classList[hasEquippedBow()?'add':'remove']('hidden');deckPresets.render();}
const loadoutDrag=createLoadoutDrag({root:$('#skillsPanel'),
 getAbility:id=>bindingLayout?.dragIcons.some(w=>w.skill.id===id)?{name:SKILLS[id].name,icon:skillIcon(id)}:null,
 onStart:id=>{selectedWrapper=bindingLayout.dragIcons.find(w=>w.skill.id===id);bindingArmed=true;},
 onHint:(id,index)=>{const w=bindingLayout.dragIcons.find(w=>w.skill.id===id),target=index===null?null:bindingLayout.slots[index]?.holding;$('#slotInstruction').textContent=index===null?'Drop on a slot. Release outside to cancel.':target===w?'Return to the same slot':target?`${w.binding<0?'Replace':'Swap with'} ${SKILLS[target.skill.id].name}${w.binding<0?' · it returns to reserve':''}`:`Move to ${bindingLabel(index)}`;},
 onDrop:(id,index)=>{selectedWrapper=bindingLayout.dragIcons.find(w=>w.skill.id===id);moveBinding(index);},
 onCancel:()=>{bindingArmed=false;bindingMessage='Move cancelled. Your action bar is unchanged.';drawOwnedSkills();},
 onBar:bar=>{editorBar=bar;drawOwnedSkills();}
});
function showSkills(){if(stressFieldOrigin){status('Synthetic supplies are fixed. Return to edit or export decks.');return;}if(skirmishMode&&battle.summary){loadoutDrag.cancel();loadoutOrigin=hubOpen?'lobby':'camp';panel('#skillsPanel',true);deckPresets.open();status('This attempt is over. Inspect or export decks; prepare a fresh kit before applying.');return;}
 if(openPanelId==='#shopPanel'){armoryReturnFromLoadout=true;armyReturnFromLoadout=false;}
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
 $('#closeSkills').textContent=armyReturnFromLoadout?'Back to army':armoryReturnFromLoadout?'Back to deck':loadoutOrigin==='pause'?'Back to Pause':loadoutOrigin==='camp'?'Back to results':loadoutOrigin==='lobby'?'Back to lobby':'Back';$('#closeSkills').setAttribute('aria-label',$('#closeSkills').textContent);
 $('#loadoutContinue').textContent=loadoutOrigin==='lobby'?(started&&!battle.summary?`Resume battle ${battle.level}`:battle.summary?.campaignComplete?'Back to lobby':`${battle.summary?.outcome==='defeat'?'Retry':'Start'} battle ${battle.summary?.outcome==='victory'?battle.level+1:battle.level}`):loadoutOrigin==='pause'?'Done':battle.summary?.campaignComplete?'Back to results':battle.summary?.outcome==='defeat'?`Retry battle ${battle.level}`:`Begin battle ${battle.summary?battle.level+1:battle.level}`;
 if(skirmishMode)$('#loadoutContinue').textContent=loadoutOrigin==='pause'?'Done':started?'Resume skirmish':'Start skirmish';
 if(expeditionMode&&loadoutOrigin!=='pause'&&!battle.summary?.campaignComplete)$('#loadoutContinue').textContent=expeditionLaunchLabel(profiles.activeRun,{started,summary:battle.summary});
 if(armyReturnFromLoadout)$('#loadoutContinue').textContent='Back to army';
 $('#loadoutArmory').classList[!battle.summary?.campaignComplete?'remove':'add']('hidden');drawOwnedSkills();
}
function cancelLoadoutSelection(){if(!bindingArmed)return false;const id=selectedWrapper?.skill.id;$('#cancelBinding').onclick();if(id)$('#owned-'+id)?.focus?.({preventScroll:true});return true;}
function closeLoadoutRefine(){const node=$('#loadoutRefine');if(node.getAttribute('open')===null)return false;node.removeAttribute('open');node.querySelector('summary')?.focus?.();return true;}
function closeLoadout(returnToOrigin=true){closeLoadoutRefine();deckPresets.close();loadoutCollection.back();const returnToArmy=returnToOrigin!==false&&armyReturnFromLoadout,returnToArmory=returnToOrigin!==false&&armoryReturnFromLoadout;armoryReturnFromLoadout=false;armyReturnFromLoadout=false;loadoutDrag.cancel();panel('#skillsPanel',false);drawHotbar();localCampaign?.checkpoint('loadout');if(returnToArmy){panel('#queuePanel',true);renderQueue();}else if(returnToArmory&&!battle.summary?.campaignComplete)shop();}
for(const id of ['#pauseSkills','#introLoadout','#endingLoadout'])$(id).onclick=()=>{armoryReturnFromLoadout=false;armyReturnFromLoadout=false;showSkills();};$('#shopLoadout').onclick=showSkills;
$('#closeSkills').onclick=closeLoadout;
$('#loadoutContinue').onclick=()=>{if(armyReturnFromLoadout){closeLoadout();return;}const origin=loadoutOrigin;closeLoadout(false);if(origin==='lobby'){selectedDestination=activeDestination;startFromHub();return;}if(origin==='pause'||battle.summary?.campaignComplete)return;if(battle.summary)$('#replay').onclick();else begin();};
$('#loadoutArmory').onclick=shop;
for(const button of document.querySelectorAll('[data-loadout-bar]'))button.onclick=()=>{editorBar=Number(button.getAttribute('data-loadout-bar'));drawOwnedSkills();};
function moveBinding(slot){
 if(!canMutateLoadout()||!selectedWrapper)return;
 const result=placeLoadoutAbility(bindingLayout,selectedWrapper,slot);if(!result)return;
 const name=SKILLS[selectedWrapper.skill.id].name,other=result.displaced?SKILLS[result.displaced.skill.id].name:'';
 bindingMessage=result.kind==='unchanged'?`${name} stays in ${bindingLabel(slot)}.`:result.kind==='swap'?`${name} and ${other} swapped places.`:result.kind==='replace'?`${name} equipped. ${other} is now in reserve.`:result.kind==='reserve'?`${name} moved to reserve. It is still owned.`:`${name} moved to ${bindingLabel(slot)}.`;
 bindingArmed=false;drawOwnedSkills();barSignature='';$(slot<0?'#loadoutSearch':'#assign-'+slot)?.focus?.({preventScroll:true});
}
function recoverBasicArrow(){
 if(!canMutateLoadout())return {ok:false};
 const arrow=bindingLayout.dragIcons.find(wrapper=>wrapper.skill.id==='arrow');
 if(!arrow||!profile.owned.has('arrow'))return {ok:false};
 const slot=arrow.binding>=0?arrow.binding:bindingLayout.slots.findIndex(slot=>!slot.holding);
 if(slot<0)return {ok:false};
 selectedWrapper=arrow;editorBar=Math.floor(slot/10);moveBinding(slot);drawHotbar();
 localCampaign?.checkpoint('loadout').then(()=>deckPresets.render());
 return {ok:true,slot};
}
$('#loadoutRecoverArrow').onclick=()=>recoverBasicArrow();
$('#unbindSkill').onclick=()=>moveBinding(-1);
$('#cancelBinding').onclick=()=>{bindingArmed=false;bindingMessage='Selection cancelled. Your action bar is unchanged.';drawOwnedSkills();};
let precisionReturnPanel=null;
function closePrecision(){const back=precisionReturnPanel;precisionReturnPanel=null;if(back){panel(back,true);$('#openAim').focus?.();}else panel('#aimPanel',false);}
$('#openAim').onclick=()=>{precisionReturnPanel=openPanelId==='#settingsPanel'?'#settingsPanel':null;panel('#aimPanel',true);};$('#closeAim').onclick=closePrecision;
function showSettings(){$('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;syncAimSettings();panel('#settingsPanel',true);}
function panel(id,show){if(openPanelId==='#skillsPanel'&&(id!=='#skillsPanel'||!show))castleLoadout.leave();if(openPanelId==='#savePanel'&&(id!=='#savePanel'||!show))cloudAccounts?.leave();if(openPanelId==='#campaignPanel'&&(id!=='#campaignPanel'||!show))campaignAtlas.leave();if(openPanelId==='#controlsPanel'&&(id!=='#controlsPanel'||!show))controlsUI.discard();if(openPanelId==='#shopPanel'&&(id!=='#shopPanel'||!show))armoryCatalog?.leave();if(show){if(id!=='#skillsPanel')deckPresets.close();cancelPendingImport();if(openPanelId==='#skillsPanel'&&id!=='#skillsPanel'&&bindingLayout&&!bindingLayout.closed){loadoutDrag.cancel();bindingLayout.close();}if(!openPanelId){panelFocus=document.activeElement;panelResume=started&&!battle.paused&&!battle.outcome;}for(const other of ['#settingsPanel','#profilesPanel','#shopPanel','#testingPanel','#queuePanel','#savePanel','#skillsPanel','#aimPanel','#campaignPanel','#expeditionPanel','#controlsPanel','#skirmishPanel','#battleReportPanel'])if(other!==id)$(other)?.classList.add('hidden');$(id).classList.remove('hidden');openPanelId=id;pause(true);syncPause();focusPanel(id);}else{if(id==='#skillsPanel'&&bindingLayout&&!bindingLayout.closed)bindingLayout.close();if(id==='#savePanel')cancelPendingImport();$(id).classList.add('hidden');if(openPanelId===id){openPanelId=null;if(panelResume)pause(false);panelResume=false;syncPause();if(hubOpen){renderHub();$('#start').focus?.();}else if(battle.paused)$('#resumeGame').focus?.();else if(panelFocus?.getClientRects?.().length&&!panelFocus.disabled)panelFocus.focus?.();else if(!$('#ending').classList.contains('hidden'))$('#replay').focus?.();else if(!$('#intro').classList.contains('hidden'))$('#start').focus?.();else canvas.focus?.();}}localCampaign?.checkpoint('loadout');}
function shop(){if(stressFieldOrigin){status('Synthetic supplies are fixed. Return to the playground for the Armory.');return;}if(cardPracticeOrigin){exitUnitTrial();return;}if(skirmishMode&&battle.summary){status('Prepare this seed again to spend fresh practice supplies.');return;}
 if(battle.summary?.campaignComplete){status('Choose a new campaign to use the deck');return;}
 loadoutReturnPanel=openPanelId==='#skillsPanel'?'#shopPanel':null;loadoutDrag.cancel();
 panel('#shopPanel',true);$('#shopPanel').dataset.battleContinuation=String(!hubOpen&&!!battle.summary);$('#closeShop').textContent=loadoutReturnPanel?'Back to loadout':hubOpen?'Back to lobby':battle.summary?'Back to results':'Back to Pause';
 $('#shopContinue').textContent=hubOpen?'Back to lobby':!battle.summary?'Back to Pause':battle.summary.outcome==='victory'?`Begin battle ${battle.level+1}`:`Retry battle ${battle.level}`;
 $('#shopStage').textContent=armoryPurchasesAllowed()?'PREPARE YOUR ARSENAL':'BATTLE PAUSED';
 if(expeditionMode&&!hubOpen&&battle.summary)$('#shopContinue').textContent=expeditionLaunchLabel(profiles.activeRun,{started,summary:battle.summary});
 $('#shopStatus').textContent=armoryPurchasesAllowed()?'Unlock an ability, then arrange your loadout.':'Browse and arrange owned cards. Finish this battle before purchasing new cards.';renderShop();
}
armoryCatalog=createArmoryCatalogUI({
 root:$('#armoryCatalogHost'),records:buildArmoryRecords(SKILLS,COMPANIONS,descriptions),
 getSnapshot:()=>({...createArmorySnapshot(profile),practiceBlockedReason:trainingRun?'Leave guided practice before trying a contract.':null,purchaseBlockedReason:armoryPurchasesAllowed()?null:'Finish this battle to purchase',castleEquipBlockedReason:started&&!battle.summary?'Change your castle before starting or after the battle.':null,castleSelectionLabel:battle.summary?'Next castle':'Castle'}),getSessionKey:()=>profile,icon:skillIcon,nameForId:id=>SKILLS[id]?.name??COMPANIONS[id]?.name??CASTLE_CATALOG[id]?.name??id,keyLabel:slotToKey,bindingLabel,announce:text=>{$('#shopStatus').textContent=text;status(text);},
 onPractice:item=>enterUnitTrial(item.id),
 startRefined:false,
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
  updateShopBalance();localCampaign?.checkpoint('purchase');return true;
 },
 onCheckout:lines=>{
  const activeProfile=profile,result=checkoutArmoryCart(profile,lines,{canPurchase:candidate=>candidate===profile&&profile===activeProfile&&openPanelId==='#shopPanel'&&armoryPurchasesAllowed()});
  if(!result.ok)return result;
  battle.hotbar.skills=profile.skills;battle.refreshHotbar();barSignature='';drawHotbar();visualDirty=true;companionUI.renderLive();updateShopBalance();localCampaign?.checkpoint('purchase');return result;
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
 onCastleEquip:(selection,context)=>{const result=equipCastleCard(selection,context?.sessionKey);if(result.ok)$('#shopStatus').textContent=`${CASTLE_CATALOG[selection.id].name} ${battle.summary?'selected for next field':'equipped'}. Ability keys are unchanged.`;return result;},
 onCompanionEquip:(item,equip)=>{if(openPanelId!=='#shopPanel'||battle.summary?.campaignComplete||battle.companions.unit||!profile.companionOwned.has(item.id))return false;profile.equipCompanion(equip?item.id:null);companionUI.renderLive();$('#shopStatus').textContent=equip?`${item.name} equipped in the companion slot.`:'Companion moved to reserve.';return true;},
 onArrange:item=>{
  if(item.kind==='castle'){showSkills();$('#loadoutCompanionSection').open=true;$('#castleLoadout').scrollIntoView?.({block:'nearest'});$('#castleSlotTitle')?.focus?.();}
  else if(item.kind==='companion'){showSkills();$('#loadoutCompanionSection').open=true;$('#companionLoadout').scrollIntoView?.({block:'nearest'});$('#equipCompanion')?.focus?.({preventScroll:true});}
  else arrangeArmoryAbility(item.id);
 }
});
function updateShopBalance(){
 $('#shopBalance').textContent=`${Math.floor(profile.gold).toLocaleString()} gold`;
 $('#shopOwnedCount').textContent=`${profile.owned.size} / ${Object.keys(SKILLS).length} abilities · ${profile.companionOwned.size} / ${Object.keys(COMPANIONS).length} companions · ${profile.castleLevels.size} castles`;
}
function renderShop(){updateShopBalance();armoryCatalog.refresh();}
function arrangeArmoryAbility(id){
 showSkills();if(!canMutateLoadout())return;const wrapper=bindingLayout.dragIcons.find(w=>w.skill.id===id);
 if(wrapper){selectedWrapper=wrapper;bindingArmed=true;editorBar=wrapper.binding>=0?Math.floor(wrapper.binding/10):0;loadoutCollection.model.reveal(id,bindingLayout.dragIcons);bindingMessage=`${SKILLS[id].name} · ${bindingLabel(wrapper.binding)}. Choose a destination to rearrange.`;drawOwnedSkills();$('#owned-'+id)?.focus?.({preventScroll:true});}
}
$('#shopContinue').onclick=()=>{if(openPanelId!=='#shopPanel')return;const returnToHub=hubOpen,hasResult=!!battle.summary;loadoutReturnPanel=null;armoryReturnFromLoadout=false;armyReturnFromLoadout=false;panel('#shopPanel',false);if(returnToHub){renderHub();return;}if(hasResult)$('#replay').onclick();};$('#openShop').onclick=shop;$('#endingShop').onclick=shop;$('#closeShop').onclick=()=>closeChildPanel('#shopPanel');$('#openControls').onclick=showControls;$('#pauseControls').onclick=showControls;$('#openSettings').onclick=showSettings;$('#closeSettings').onclick=()=>panel('#settingsPanel',false);
$('#applySettings').onclick=()=>{battle.applyOptions({difficulty:$('#difficulty').value,shootingMode:$('#aimMode').value});updateAimGuide();updatePowerMode();panel('#settingsPanel',false);localCampaign?.checkpoint('settings');status(skirmishMode?'Aim settings applied for this practice session. Company difficulty stays tied to the seed.':'Settings applied. '+localCampaign.message());};
$('#downloadSave').onclick=()=>{if(temporarySessionActive())return;if(skirmishMode){showSkirmishWorkshop();return;}try{const blob=new Blob([profiles.exportBundle()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=expeditionMode?'castledecks-wayfarer-charter.json':testingMode?'bowmaster-testing.json':'bowmaster-campaign.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#vaultStatus').textContent=expeditionMode?'Download started. Check that the charter file was saved.':'Download started. Check that the campaign file was saved.';$('#saveStatus').textContent=expeditionMode?'Charter download started. Live fields restart on load; settled results and route choices are preserved.':'Campaign download started. Keep the downloaded file; it restarts the saved battle.';$('#endingSaveStatus').textContent=expeditionMode?'Download started. Check that your charter file was saved.':'Download started. Check that your campaign file was saved.';}catch{$('#vaultStatus').textContent=expeditionMode?'Download could not start. You can show and copy a charter code instead.':'Download could not start. You can show and copy a campaign code instead.';$('#saveStatus').textContent=expeditionMode?'This charter could not be exported. Your current session is still available.':'This campaign could not be exported. Your current session is still available.';$('#endingSaveStatus').textContent='Save failed. Your session is still available; try again before leaving.';}};
function showCampaignVault(restore=false){if(stressFieldOrigin){status('Return from the synthetic field before loading or saving.');return;}if(skirmishMode){showSkirmishWorkshop();return;}if(trainingRun){status('Leave guided practice to load or save a campaign.');return;}$('#saveCode').value='';$('#saveCodeArea').classList.add('hidden');panel('#savePanel',true);$('#vaultStatus').textContent=restore?'Paste a saved code below, or choose a file. Review the import before opening it.':localCampaign.message();if(expeditionMode)$('#vaultStatus').textContent='This is a separate Wayfarer charter save. Crownroad files do not load here. A live field restarts on load; settled results and route choices are preserved.';if(started&&!battle.summary)$('#vaultStatus').textContent+=expeditionMode?' Loading a charter replaces this paused field.':' Loading a campaign replaces this paused battlefield and starts the imported battle from the beginning.';localCampaign?.render();cloudAccounts?.open();if(restore)$('#loadCode').focus?.();}
$('#saveGame').onclick=()=>showCampaignVault();
$('#closeSave').onclick=()=>panel('#savePanel',false);
$('#showSaveCode').onclick=()=>{if(temporarySessionActive())return;if(skirmishMode){showSkirmishWorkshop();return;}try{$('#saveCode').value=profiles.exportBundle();$('#saveCodeArea').classList.remove('hidden');$('#vaultStatus').textContent=(expeditionMode?'Charter':'Campaign')+' code created. Select and copy it somewhere safe; showing it here does not save it elsewhere.';}catch{$('#vaultStatus').textContent=expeditionMode?'This charter could not be encoded. Your current session is still available.':'This campaign could not be encoded. Your current session is still available.';}};
$('#selectSaveCode').onclick=()=>{$('#saveCode').focus();$('#saveCode').select?.();$('#vaultStatus').textContent='Code selected. Copy it and keep it somewhere safe.';};
function applyCampaignText(text){if(temporarySessionActive())throw new Error('Return from practice before loading a campaign.');if(skirmishMode)throw new Error('Skirmish does not load campaign progress.');const localImport=localCampaign.requestImport(text);if(localImport.handled){for(const id of ['#saveStatus','#endingSaveStatus'])$(id).textContent='Campaign file validated. Review how to open it in the vault.';$('#introNotice').textContent='Review the campaign import in the vault.';return;}profiles.importBundle(text);profile=profiles.active;started=false;setup();if(!battle.summary?.campaignComplete){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}$('#saveStatus').textContent=expeditionMode?'Charter imported. Live fields restart; settled results and route choices are preserved.':'Campaign imported. Begin to restart its saved battle.';status(expeditionMode?'Charter loaded':'Campaign loaded');$('#introNotice').textContent=expeditionMode?(profiles.activeRun.choosing?'Charter loaded. Choose the next road.':profiles.activeRun.complete?'Completed charter loaded. Its result is preserved.':'Charter loaded. Ready to restart its current field.'):'Campaign loaded. Ready to begin.';$(battle.summary?.campaignComplete?'#replay':'#start').focus?.();}
$('#importCode').onclick=()=>{if(temporarySessionActive())return;cancelPendingImport();try{applyCampaignText($('#loadCode').value);}catch{$('#vaultStatus').textContent=expeditionMode?'That code is not a valid Wayfarer charter. Your current charter has been kept.':'That code is not a valid reconstruction campaign. Your current progress has been kept.';}};
$('#endingSave').onclick=()=>$('#saveGame').onclick();$('#endingProfiles').onclick=()=>showProfiles();$('#endingLoad').onclick=()=>$('#loadGame').onclick();$('#loadGame').onclick=()=>showCampaignVault(true);$('#chooseSaveFile').onclick=()=>$('#saveFile').click();
$('#saveFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file||skirmishMode||temporarySessionActive())return;
 cancelPendingImport();
 const generation=++loadGeneration;event.target.value='';
 for(const id of ['#saveStatus','#introNotice','#endingSaveStatus'])$(id).textContent=expeditionMode?'Reading charter file…':'Reading campaign file…';
 try{
  if(file.size>1048576)throw new Error('too-large');
  const text=await file.text();
  // A later file choice or navigation owns the session. An older asynchronous
  // file read must never replace a newer campaign or a resumed battle.
  if(generation!==loadGeneration)return;
  applyCampaignText(text);
 }catch{
  if(generation!==loadGeneration)return;
  $('#saveStatus').textContent=expeditionMode?'That file is not a valid Wayfarer charter. Your current charter has been kept.':'That file is not a valid reconstruction save. Your current campaign has been kept.';
  $('#introNotice').textContent=expeditionMode?'That file could not be loaded. Choose a Wayfarer charter file; your current charter has been kept.':'That file could not be loaded. Choose a reconstruction campaign file; your current progress has been kept.';
  $('#endingSaveStatus').textContent=expeditionMode?'That file could not be loaded. Your current charter has been kept.':'That file could not be loaded. Your current campaign has been kept.';
 }
});
const html=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showProfiles(){if(stressFieldOrigin){status('Return from the synthetic field before switching profiles.');return;}if(skirmishMode){showSkirmishWorkshop();return;}if(trainingRun){status('Leave guided practice to switch profiles.');return;}pendingDelete=null;$('#deleteConfirm').classList.add('hidden');panel('#profilesPanel',true);renderProfiles();}
function renderProfiles(){
 $('#profileSelect').innerHTML=profiles.profiles.map((p,i)=>`<option value="${i}">${html(p.name||'(unnamed)')}${p.cheated?' · assisted':''} · battle ${Math.min(30,p.highestLevel)} · rank ${p.rank}</option>`).join('');$('#profileSelect').value=String(profiles.activeIndex);
 $('#deleteProfile').disabled=profiles.profiles.length<=1;$('#createProfile').disabled=profiles.profiles.length>=9;
 $('#retiredProfiles').innerHTML=profiles.retired.length?profiles.highScores().map(p=>`<div class="record-row"><strong>${html(p.name)}${p.cheated?' · assisted':''}</strong><span>${p.gold.toLocaleString()} score · ${p.victories} wins · ${p.defeats} defeats</span></div>`).join(''):`<p class="footnote">${expeditionMode?'No archived charters yet':'No completed campaigns yet'}</p>`;
 $('#profileStatus').textContent=(started&&!battle.summary?'Choosing or creating a profile replaces this paused battlefield. The selected battle starts from the beginning. ':'')+`${profiles.profiles.length} of 9 active profiles · ${profiles.retired.length} completed. ${localCampaign.message()}`;
}
function useProfile(){profile=profiles.active;started=false;setup();if(!battle.summary?.campaignComplete){$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');}$('#battlePause').disabled=true;panel('#profilesPanel',false);$('#deleteConfirm').classList.add('hidden');status('Profile selected. Begin to restart its saved battle.');$(battle.summary?.campaignComplete?'#replay':'#start').focus?.();}
$('#openProfiles').onclick=showProfiles;$('#closeProfiles').onclick=()=>panel('#profilesPanel',false);
$('#switchProfile').onclick=()=>{if(stressFieldOrigin||skirmishMode)return;if(profiles.select(Number($('#profileSelect').value)))useProfile();};
$('#createProfile').onclick=()=>{if(stressFieldOrigin||skirmishMode)return;const name=$('#newProfileName').value;if(profiles.create(name,{shootingMode:$('#newAimMode').value||'classic'})){useProfile();$('#newProfileName').value='';}else $('#profileStatus').textContent=name===''?'Enter a profile name first':'Nine active profiles are already available';};
$('#deleteProfile').onclick=()=>{if(stressFieldOrigin||skirmishMode)return;pendingDelete=profiles.profiles[Number($('#profileSelect').value)];if(!pendingDelete)return;$('#deleteConfirmText').textContent=expeditionMode?`Delete “${pendingDelete.name}” and its charter route from this session? Export a charter file first if you want a copy.`:`Delete “${pendingDelete.name}” from this campaign? Future local checkpoints will reflect the deletion. Export a file first if you want a separate copy.`;$('#deleteConfirm').classList.remove('hidden');};$('#cancelDelete').onclick=()=>$('#deleteConfirm').classList.add('hidden');
$('#confirmDelete').onclick=()=>{if(stressFieldOrigin||skirmishMode)return;const index=profiles.profiles.indexOf(pendingDelete);if(index<0)return;profiles.select(index);pendingDelete=null;if(profiles.deleteCurrent()){profile=profiles.active;renderProfiles();useProfile();}};
function showTesting(){if(!testingMode||trainingRun)return;loadoutReturnPanel=openPanelId==='#skillsPanel'?'#testingPanel':null;$('#testVictory').disabled=!!battle.outcome;$('#testDefeat').disabled=!!battle.outcome;$('#testLevel').value=String(battle.level);$('#testProtection').checked=testingProtection;$('#testingStatus').textContent=`Battle ${battle.level} · ${Math.floor(profile.gold)} gold. All progress in this playground is assisted.`;panel('#testingPanel',true);renderStressField(document,battle);}
for(const id of ['#openTesting','#introTesting','#pauseTesting','#endingTesting'])$(id).onclick=showTesting;$('#closeTesting').onclick=()=>closeChildPanel('#testingPanel');
for(const [id,amount] of [['#testGoldSmall',1000],['#testGoldLarge',10000]])$(id).onclick=()=>{if(!testingMode||trainingRun||stressFieldOrigin)return;const gold=grantTestGold(battle,amount);$('#testingStatus').textContent=`Granted ${amount.toLocaleString()} test gold. Balance: ${gold.toLocaleString()}.`;};
$('#testUnlock').onclick=()=>{if(!testingMode||trainingRun||stressFieldOrigin)return;unlockTestSkills(battle);barSignature='';drawHotbar();$('#testingStatus').textContent='All 25 abilities and Gorath unlocked and ready. Auto-summon is off so you can choose each squad.';};
$('#testReady').onclick=()=>{if(!testingMode||trainingRun||stressFieldOrigin)return;readyTestSkills(battle);drawHotbar();$('#testingStatus').textContent='Every owned ability is ready.';};
function showCollision(enabled){if(!testingMode&&!demoMode)return;testingCollision=enabled;$('#testCollision').checked=enabled;visualDirty=true;}
$('#testCollision').addEventListener('change',()=>showCollision($('#testCollision').checked));
window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==window.location.origin||event.data?.type!=='bowmaster-preview-collision'||typeof event.data.enabled!=='boolean')return;showCollision(event.data.enabled);});
$('#testProtection').addEventListener('change',()=>{if(!testingMode||trainingRun||stressFieldOrigin)return;testingProtection=$('#testProtection').checked;protectTestBattle(battle,testingProtection);$('#testingStatus').textContent=testingProtection?'Hero damage and natural defeat are disabled. Enemy combat continues.':'Ordinary damage and defeat rules restored.';});
$('#testLevelApply').onclick=()=>{if(!testingMode||trainingRun||stressFieldOrigin)return;const level=selectTestLevel(profile,Number($('#testLevel').value));started=false;setup(level);$('#ending').classList.add('hidden');$('#intro').classList.remove('hidden');$('#start').focus?.();status(`Assisted battle ${level} is ready`);};
for(const [id,outcome] of [['#testVictory','victory'],['#testDefeat','defeat']])$(id).onclick=()=>{if(!testingMode||trainingRun||stressFieldOrigin||battle.outcome)return;panel('#testingPanel',false);if(!started)begin();else{hubOpen=false;$('#intro').classList.add('hidden');pause(false);}finishTestBattle(battle,outcome);status(`Assisted ${outcome}. Finishing the normal battle summary…`);};
const armyOrdersUI=createArmyOrdersUI({root:$('#armyOrders'),getState:()=>({battle,started,active:openPanelId==='#queuePanel',readOnly:!!trainingRun}),onChanged:()=>{visualDirty=true;status(armyOrderStatus(battle));}});
const armyCommand=createArmyCommandUI({root:$('#queuePanel'),records:buildArmoryRecords(SKILLS,COMPANIONS,descriptions),getState:()=>({profile,battle,started,active:openPanelId==='#queuePanel',readOnly:skirmishMode&&!!battle.summary}),icon:skillIcon,onChanged:()=>{barSignature='';drawHotbar();},onLoadout:()=>{loadoutReturnPanel=null;armyReturnFromLoadout=true;showSkills();},onArmory:()=>{loadoutReturnPanel=null;shop();}});
function renderQueue(){armyCommand.render();armyOrdersUI.render();$('#closeQueue').textContent=loadoutReturnPanel==='#queuePanel'?'Back to loadout':hubOpen?'Back to lobby':battle.summary?'Back to results':panelResume?'Back to battle':'Back to Pause';}
function closeChildPanel(id){const back=loadoutReturnPanel===id;loadoutReturnPanel=null;panel(id,false);if(back)showSkills();}
for(const id of ['#openQueue','#pauseQueue'])$(id).onclick=()=>{loadoutReturnPanel=openPanelId==='#skillsPanel'?'#queuePanel':null;panel('#queuePanel',true);renderQueue();if(id==='#pauseQueue'&&battle.auxiliaries&&!battle.stressField)armyCommand.showMuster();};$('#closeQueue').onclick=()=>{if(!armyCommand.back())closeChildPanel('#queuePanel');};

// One management shell. Changing workspaces never advances or resumes combat.
function navigateManagement(route){
 closeLoadoutRefine();
 if(trainingRun&&['profiles','vault'].includes(route)){status('Leave guided practice to load or save a campaign.');return;}
 const target={deck:'#shopPanel',loadout:'#skillsPanel',army:'#queuePanel',settings:'#settingsPanel',profiles:'#profilesPanel',vault:'#savePanel'}[route];
 if(route==='hall'){showHub();return;}
 if(route==='map'){if(expeditionMode)showExpeditionRoute();else if(skirmishMode)showSkirmishWorkshop();else if(activeDestination==='campaign')showCampaignAtlas();else {showHub();$('#hubDestinations').querySelector('[data-hub-destination="training"]')?.focus?.();}return;}
 if(!target||openPanelId===target)return;
 loadoutReturnPanel=null;precisionReturnPanel=null;armyReturnFromLoadout=false;armoryReturnFromLoadout=false;
 if(route==='deck')shop();else if(route==='loadout')showSkills();else if(route==='army'){panel(target,true);renderQueue();}else if(route==='profiles')showProfiles();else if(route==='vault')showCampaignVault();else if(route==='settings')showSettings();
 // Primary workspace tabs do not create nested return chains.
 loadoutReturnPanel=null;armyReturnFromLoadout=false;armoryReturnFromLoadout=false;
 const back=hubOpen?'Back to hall':battle.summary?'Back to results':'Back to Pause';
 if(route==='loadout'){$('#closeSkills').textContent=back;$('#closeSkills').setAttribute('aria-label',back);}
 if(route==='deck')$('#closeShop').textContent=back;
}
for(const button of document.querySelectorAll('[data-menu-route]'))button.onclick=()=>navigateManagement(button.getAttribute('data-menu-route'));
for(const button of document.querySelectorAll('[data-deck-view]'))button.onclick=()=>{
 const mode=button.getAttribute('data-deck-view');if(mode==='build')return;
 navigateManagement('deck');if(openPanelId!=='#shopPanel')return;
 const id={discover:'shopDiscoverTab',catalog:'shopCatalogTab',collection:'shopCollectionTab',wishlist:'shopWishlistTab',cart:'shopCartOpen',compare:'shopCompareOpen'}[mode];
 if(id)$('#'+id).click();
};

function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function castle(building){drawFortification(ctx,building,{scale:worldCamera.scale,tick:battle.tick,elevationAt:x=>battle.elevationAt(x),paletteId:profile.paletteId});}
function creature(unit,cloth,dark){const h=unit.height??80;if(unit.type==='gorath'){drawGorath(ctx,unit,{elevationAt:x=>battle.elevationAt(x),record:specialMotion.record(unit)});return;}
 if(unit.airUnit){const motion=specialMotion.air(unit);if(drawElementalDragon(ctx,unit,motion)||drawAirFighter(ctx,unit,motion))return;const flap=motion.wingLift,dragon=unit.type!=='air',tint=unit.type.includes('poison')?'#a6b763':unit.type.includes('ice')?'#88c6c8':unit.type.includes('fire')?'#c7926a':cloth;poly([[37,8],[11,-10],[-6,-12],[-19,-4],[-31,0],[-28,11],[-12,10],[9,15]],tint);poly([[7,-6],[33,-37-flap],[2,-18],[-15,-35-flap],[-7,-5]],dark);line(17,11,40,19,tint,4);circle(-21,2,7,tint);circle(-23,0,2,'#ead89e');if(!dragon){circle(6,-21,5,'#d5bf91');line(6,-16,7,-5,cloth,6);}return;}
 const ice=unit.type==='ice_demon',tint=ice?'#87c1c4':'#c58155';poly([[-16,-4],[-20,-50],[-11,-69],[12,-69],[23,-49],[15,-4]],tint);poly([[-14,-65],[-23,-85],[-3,-74],[11,-72],[25,-86],[18,-63]],dark);circle(3,-63,4,'#e8dfa7');line(-10,-9,-17,0,dark,7);line(10,-9,18,0,dark,7);line(15,-45,34,-26,'#dfc780',7);}
function troop(unit){if(combatPoses.draw(ctx,unit,{paletteId:profile.paletteId}))return;if(!Number.isFinite(unit.x)||!Number.isFinite(unit.y)||!unit.visible)return;ctx.save();ctx.translate(unit.x,unit.y);ctx.rotate((unit.collisionRotation??unit.rotation??0)*Math.PI/180);ctx.scale(unit.facing??1,1);const good=unit.team==='good',heraldry=resolvePlayerPalette(profile.paletteId).tokens.fallback,cloth=good?heraldry.cloth:'#c98465',dark=good?heraldry.dark:'#633c2d',metal='#c7c7a8';if((unit.airUnit||unit.type==='gorath')&&unit.hp<=0){ctx.globalAlpha=.65;creature(unit,cloth,dark);ctx.restore();return;}if(unit.hp<=0){ctx.globalAlpha=.75;line(-18,-5,18,-2,cloth,7);circle(20,-7,5,'#d2bc8f');ctx.restore();return;}if(unit.airUnit||['gorath','fire_demon','ice_demon'].includes(unit.type)){creature(unit,cloth,dark);if(good)drawFriendlyHeraldryCue(ctx,0,-Math.min(unit.height*.3,45),{size:9});ctx.restore();ctx.fillStyle=good?'#7eb0c5':'#c98465';ctx.fillRect(unit.x-25,unit.y-unit.height-12,50*Math.max(0,unit.hp/unit.maxHp),4);return;}const phase=(unit.animation?.frame??0)*.7,walk=unit.actionMode==='move'?Math.sin(phase):0;
 if(unit.type==='trebuchet'){const pose=specialMotion.siege(unit);line(-38,-11,38,-11,dark,7);circle(-25,-3,9,'#a6966b');circle(27,-3,9,'#a6966b');line(-14,-13,pose.pivot.x,pose.pivot.y,'#bcaa76',6);line(24,-12,pose.pivot.x,pose.pivot.y,'#bcaa76',6);line(pose.weight.x,pose.weight.y,pose.tip.x,pose.tip.y,'#d7bd82',6);circle(pose.pivot.x,pose.pivot.y,4,metal);ctx.fillStyle=dark;ctx.fillRect(pose.weight.x-8,pose.weight.y-5,16,13);if(pose.loaded)circle(pose.tip.x,pose.tip.y,6,'#615e51');if(good)drawFriendlyHeraldryCue(ctx,0,-12,{size:9});ctx.restore();return;}
 if(unit.type==='mount'){ctx.fillStyle=good?'#bdad85':'#a28b66';ctx.beginPath();ctx.ellipse(0,-20,25,11,0,0,Math.PI*2);ctx.fill();line(-15,-18,-20+walk*5,0,dark,5);line(15,-18,21-walk*5,0,dark,5);poly([[18,-23],[31,-44],[39,-40],[31,-18]],'#b7a079');circle(1,-52,6,'#e0c89b');poly([[-8,-46],[8,-46],[10,-27],[-7,-28]],cloth);line(6,-41,26,-51,metal,3);ctx.restore();return;}
 const tall=unit.type==='tallGrunt',height=unit.type==='hero'?55:tall?60:unit.type==='priest'?36:unit.type==='archer'?40:43,headY=-height+7;
 circle(0,headY,6,tall?metal:'#dac297');poly([[-8,headY+7],[8,headY+7],[11,-14],[-10,-14]],cloth);line(-5,-14,-8+walk*4,0,dark,4);line(5,-14,8-walk*4,0,dark,4);
 if(unit.type==='priest'){poly([[-9,headY+6],[0,headY-10],[9,headY+6]],'#d1c798');line(12,-6,12,-49,'#d6c693',3);circle(12,-50,4,'#d6dfaa');}
 else if(unit.type==='archer'||unit.type==='hero'){ctx.strokeStyle='#e0c78e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(11,-25,14,-1.1,1.1);ctx.stroke();line(17,-37,17,-13,'#e6debd',1);line(3,-28,15,-27,metal,3);}
 else{line(5,-25,17,-29,metal,3);line(18,-13,19,-46,dark,3);if(tall)poly([[19,-47],[30,-46],[29,-32],[19,-33]],metal);else line(19,-45,19,-24,metal,3);circle(-12,-22,tall?10:7,dark);}
 ctx.restore();if(unit!==battle.hero){ctx.fillStyle='#253124';ctx.fillRect(unit.x-14,unit.y-height-11,28,3);ctx.fillStyle=good?'#94c7cc':'#d29a78';ctx.fillRect(unit.x-14,unit.y-height-11,28*unit.hp/unit.maxHp,3);}}
function drawArrow(projectile){const pose=projectile.draw??projectile;if(!Number.isFinite(pose.x)||!Number.isFinite(pose.y))return;ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle??projectile.angle??0);const kind=projectile.kind??'',tint=kind.includes('ice')||kind.includes('comet')?'#a5e1e3':kind.includes('fire')||kind.includes('meteor')?'#f3b263':kind.includes('poison')?'#c4d67e':kind.includes('thunder')?'#e7e6a8':'#f2ddb0';if(kind.endsWith('_wave_arrow')){ctx.scale(Math.max(1,Math.min(2.5,.55/worldCamera.scale)),Math.max(1,Math.min(2.5,.55/worldCamera.scale)));circle(0,0,8,'#17272b');circle(0,0,6,tint);line(-15,0,-6,0,tint+'99',4);poly([[0,-9],[4,-3],[9,0],[4,3],[0,9],[-3,3],[-7,0],[-3,-3]],tint);circle(0,0,2,'#fff5d8');}else if(['meteor','comet','fire_ball','ice_ball'].includes(kind)){circle(0,0,kind==='meteor'||kind==='comet'?15:7,tint);line(-8,0,-36,0,tint+'80',5);}else if(kind==='trebuchet_ammo')circle(0,0,5,'#4b4737');else{const glyphScale=Math.max(1,Math.min(2.5,.38/worldCamera.scale));ctx.scale(glyphScale,glyphScale);const strokeScale=worldCamera.scale*glyphScale;line(-18,0,6,0,'#17272b',2.7/strokeScale);line(-18,0,6,0,tint,1.2/strokeScale);poly([[8,0],[0,-3],[0,3]],'#eee0b9');line(-15,0,-21,-4,'#dbc391',1.2/strokeScale);}ctx.restore();}

function renderTrainingEntry({force=false}={}){
 const next=[activeDestination,selectedDestination,testingMode,started,profile.victories,trainingInviteDismissed,trainingReturnDestination,trainingRun?.index,trainingRun?.revision,trainingRun?.completed.size,trainingRun?.skipped.size,trainingRun?.reviewedLoadout,trainingRun?.kind].join('|');
 if(!force&&next===trainingEntrySignature)return;trainingEntrySignature=next;
 const guided=!!trainingRun,selectedTraining=selectedDestination==='training',firstVisit=selectedDestination===activeDestination&&activeDestination==='campaign'&&!started&&profile.victories===0&&!trainingInviteDismissed,available=selectedTraining||firstVisit;
 $('#gameShell').dataset.guidedTraining=String(guided);$('#gameShell').dataset.unitTrial=String(isUnitTrial(trainingRun));$('#aimMode').disabled=guided;$('#battleRestart').textContent=isUnitTrial(trainingRun)?'Reset field trial':guided?(trainingLesson(trainingRun)?'Restart drill':'Restart guided practice'):'Restart battle';
 if(guided){$('#testModeBadge').textContent='DRILL';$('#testModeBadge').setAttribute('aria-label','Assisted guided practice');}
 $('#trainingEntry').classList[available?'remove':'add']('hidden');
 $('#introGuidedTraining').classList[guided?'add':'remove']('hidden');$('#introExitTraining').classList[guided?'remove':'add']('hidden');
 $('#dismissTrainingInvite').classList[firstVisit&&!guided?'remove':'add']('hidden');
 $('#trainingEntryNote').classList[selectedTraining?'remove':'add']('hidden');
 $('#pauseExitTraining').classList[guided?'remove':'add']('hidden');
 if(guided){
  const lesson=trainingLesson(trainingRun);$('#trainingEntryText').textContent=lesson?`Guided practice · ${lesson.title}`:'Guided practice · prepare your loadout';
  $('#hubSessionResources').textContent=`Supplied practice profile · ${trainingRun.completed.size}/${TRAINING_LESSONS.length} drills completed · no campaign rewards`;
  $('#hubSessionState').textContent='Stationary training fixtures · enemy waves paused · no earned progression';
  $('#trainingEntryNote').textContent=`Skip or restart any drill. Return to ${PLAY_DESTINATIONS.find(item=>item.id===trainingReturnDestination)?.name??'your playground'} whenever you’re ready.`;
  if(selectedDestination===activeDestination)$('#start').textContent=started?'Resume guided practice':'Start guided practice';
 }else{
  $('#trainingEntryText').textContent=selectedTraining?'Five guided drills · supplied practice profile':'Five guided drills · optional';
  $('#trainingEntryNote').textContent='Supplied gold and stationary targets. No campaign rewards.';
 }
 if(isUnitTrial(trainingRun)){
  $('#testModeBadge').textContent='TRIAL';$('#testModeBadge').setAttribute('aria-label','Supplied contract trial');
  $('#pauseExitTraining').classList.add('hidden');$('#pauseLobby').textContent='Return to card';
  $('#restartDescription').textContent='Reset this supplied field and its 500 trial gold. Trial damage, XP and recruits are discarded. Your original session stays paused.';
 }else{$('#pauseExitTraining').textContent='Leave guided practice';$('#pauseLobby').textContent='Player lobby';}
 for(const id of ['#openTesting','#introTesting','#pauseTesting','#endingTesting'])$(id).classList[testingMode&&!guided?'remove':'add']('hidden');
 for(const id of ['#introSave','#introLoad','#introProfiles','#saveGame','#loadGame','#openProfiles'])$(id).disabled=guided;
}
/** Temporary fields replace a few shared labels without replacing the origin
 * battle. Keep their exact presentation too; restoring it never steps combat. */
function captureTemporaryIdentity(){
 const selectors=['#battleTitle','#testModeBadge','#combatBattleTitle','#combatEnemyState','#enemyHud','#waveHud','#viewStatus','#batteryObjectiveBrief','#castlePracticeBrief','#flagHud','#saveStatus','#settingsSaveNote','#autoHelp'];
 const standard=$('.live-battle-standard'),controls=['#introSave','#introLoad','#introProfiles','#saveGame','#loadGame','#openProfiles','#endingSave','#endingLoad','#endingProfiles'].map(selector=>({selector,disabled:$(selector).disabled}));
 return {controls,fields:selectors.map(selector=>{const node=$(selector);return {selector,text:node.textContent,aria:node.getAttribute('aria-label'),hidden:node.classList.contains('hidden')};}),standard:{aria:standard.getAttribute('aria-label'),objective:standard.dataset.objective}};
}
function restoreTemporaryIdentity(identity){
 if(!identity)return;
 for(const control of identity.controls)$(control.selector).disabled=control.disabled;
 for(const field of identity.fields){const node=$(field.selector);node.textContent=field.text;node.classList[field.hidden?'add':'remove']('hidden');if(field.aria===null)node.removeAttribute('aria-label');else node.setAttribute('aria-label',field.aria);}
 const standard=$('.live-battle-standard');if(identity.standard.aria===null)standard.removeAttribute('aria-label');else standard.setAttribute('aria-label',identity.standard.aria);
 if(identity.standard.objective===undefined)delete standard.dataset.objective;else standard.dataset.objective=identity.standard.objective;
}
/** Disposable synthetic load borrows only the scene. Never register this attempt
 * as a destination session, campaign checkpoint or account-restorable profile. */
function enterStressField(preset){
 if(!testingMode||temporarySessionActive()||openPanelId!=='#testingPanel'||battle.outcome&&!battle.summary||!['standard','veteran'].includes(preset))return false;
 const origin={profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trainingRun,trainingSandbox,trainingReturnDestination,activeDestination,selectedDestination,testingMode,demoMode,expeditionMode,skirmishMode,recruitShowcase,skirmishDescriptor,hubOpen,panelResume,panelFocus,pauseMessage,loadoutReturnPanel,armoryReturnFromLoadout,armyReturnFromLoadout,loadoutOrigin,editorBar,title:document.title,uiIdentity:captureTemporaryIdentity(),trajectory:$('#trajectory').value,shooterAngleMode:battle.shooter.angleMode,showAssist:$('#showAssist').checked,profileKind:$('#renderProfileKind').value,returnFocus:preset==='veteran'?'#stressVeteran':'#stressStandard'};
 clearInput();cancelPendingImport();loadoutDrag.cancel();deckPresets.close();if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();liveSkills?.dispose();
 stressFieldOrigin=origin;stressFieldPreset=preset;testingProtection=false;testingCollision=false;angle=20;power=100;
 setup();document.title='Castledecks · Synthetic stress field';renderStressField(document,battle);$('#pauseBattleReport').focus?.();return true;
}
function resetStressField(){
 if(!stressFieldOrigin||!isStressField(battle))return false;
 clearInput();cancelPendingImport();liveSkills?.dispose();battle.dispose();setup();document.title='Castledecks · Synthetic stress field';renderStressField(document,battle);$('#pauseBattleReport').focus?.();return true;
}
function exitStressField(){
 const saved=stressFieldOrigin;if(!saved)return false;
 clearInput();cancelPendingImport();loadoutDrag.cancel();liveSkills?.dispose();battle.dispose();invalidateRenderProfile();stressFieldOrigin=null;stressFieldPreset=null;
 ({profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trainingRun,trainingSandbox,trainingReturnDestination,activeDestination,selectedDestination,testingMode,demoMode,expeditionMode,skirmishMode,recruitShowcase,skirmishDescriptor,hubOpen,pauseMessage,loadoutOrigin,editorBar}=saved);
 syncSessionMenus();document.title=saved.title;$('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;$('#battleAngle').value=String(angle);$('#battleAngleOut').textContent=angle+'°';$('#battlePower').value=String(power);$('#trajectory').value=saved.trajectory;$('#showAssist').checked=saved.showAssist;$('#battleFire').classList[saved.showAssist?'remove':'add']('hidden');$('#resumeGame').disabled=false;$('#renderProfileKind').value=saved.profileKind;$('#batteryObjectiveBrief').classList.add('hidden');
 attachLiveSkills();updatePowerMode();battle.shooter.angleMode=saved.shooterAngleMode;barSignature='';drawHotbar();now=performance.now();lastPaint=null;
 $('#intro').classList[hubOpen?'remove':'add']('hidden');$('#ending').classList[battle.summary&&!hubOpen?'remove':'add']('hidden');renderHub();showTesting();
 ({panelResume,panelFocus,loadoutReturnPanel,armoryReturnFromLoadout,armyReturnFromLoadout}=saved);$('#testingStatus').textContent='Synthetic field discarded. Your original profile and battlefield are unchanged.';renderStressField(document,battle);$(saved.returnFocus).focus?.({preventScroll:true});syncPause();restoreTemporaryIdentity(saved.uiIdentity);visualDirty=true;return true;
}
$('#stressStandard').onclick=()=>enterStressField('standard');$('#stressVeteran').onclick=()=>enterStressField('veteran');
$('#stressReset').onclick=()=>{if(openPanelId==='#testingPanel')resetStressField();};$('#stressReturn').onclick=()=>{if(openPanelId==='#testingPanel')exitStressField();};

/** A field trial borrows the scene, never the destination registry. The entire
 * origin stays referenced and untouched, including any existing Training run. */
function enterUnitTrial(id){
 if(!supportsUnitTrial(id)||stressFieldOrigin||cardPracticeOrigin||trainingRun||openPanelId!=='#shopPanel'||battle.outcome&&!battle.summary)return false;
 const run=createUnitTrial(id,createArmorySnapshot(profile));
 invalidateRenderProfile();
 clearInput();cancelPendingImport();loadoutDrag.cancel();if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();liveSkills?.dispose();
 cardPracticeOrigin={profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trainingRun,trainingSandbox,trainingReturnDestination,activeDestination,selectedDestination,testingMode,demoMode,expeditionMode,skirmishMode,recruitShowcase,skirmishDescriptor,hubOpen,panelResume,panelFocus,pauseMessage,loadoutReturnPanel,armoryReturnFromLoadout,armyReturnFromLoadout,loadoutOrigin,editorBar,title:document.title,uiIdentity:captureTemporaryIdentity(),trajectory:$('#trajectory').value,shooterAngleMode:battle.shooter.angleMode,showAssist:$('#showAssist').checked};
 activeDestination=selectedDestination='training';testingMode=true;demoMode=expeditionMode=skirmishMode=recruitShowcase=false;
 trainingRun=run;trainingSandbox=null;trainingReturnDestination=null;angle=20;power=100;$('#trajectory').value='1';$('#showAssist').checked=false;
 setup(1);trainingCoach.reset();document.title='Castledecks · '+SKILLS[id].name+' trial';begin();renderTrainingEntry({force:true});return true;
}
function exitUnitTrial(){
 const saved=cardPracticeOrigin;if(!saved)return false;
 invalidateRenderProfile();
 clearInput();cancelPendingImport();loadoutDrag.cancel();if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();liveSkills?.dispose();trainingCoach.reset();
 cardPracticeOrigin=null;
 ({profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trainingRun,trainingSandbox,trainingReturnDestination,activeDestination,selectedDestination,testingMode,demoMode,expeditionMode,skirmishMode,recruitShowcase,skirmishDescriptor,hubOpen,pauseMessage,loadoutOrigin,editorBar}=saved);
 syncSessionMenus();document.title=saved.title;$('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;$('#battleAngle').value=String(angle);$('#battleAngleOut').textContent=angle+'°';$('#battlePower').value=String(power);$('#trajectory').value=saved.trajectory;$('#showAssist').checked=saved.showAssist;$('#battleFire').classList[saved.showAssist?'remove':'add']('hidden');
 attachLiveSkills();updatePowerMode();battle.shooter.angleMode=saved.shooterAngleMode;barSignature='';drawHotbar();now=performance.now();lastPaint=null;
 $('#intro').classList[hubOpen?'remove':'add']('hidden');$('#ending').classList[battle.summary&&!hubOpen?'remove':'add']('hidden');renderHub();
 shop();({panelResume,panelFocus,loadoutReturnPanel,armoryReturnFromLoadout,armyReturnFromLoadout}=saved);
 $('#closeShop').textContent=loadoutReturnPanel?'Back to loadout':hubOpen?'Back to lobby':battle.summary?'Back to results':'Back to Pause';
 $('#shopStatus').textContent='Field trial closed. Your cards, gold and battlefield are unchanged.';$('#shopTryCard')?.focus?.({preventScroll:true});syncPause();restoreTemporaryIdentity(saved.uiIdentity);visualDirty=true;return true;
}
function enterGuidedTraining(){
 if(stressFieldOrigin||activeDestination!=='training'||trainingRun)return;
 if(battle.outcome&&!battle.summary)return;
 invalidateRenderProfile();
 showHub();
 trainingSandbox={profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview,trajectory:$('#trajectory').value,shooterAngleMode:battle.shooter.angleMode,showAssist:$('#showAssist').checked};
 trainingRun=createTrainingRun();angle=20;power=100;$('#trajectory').value='1';$('#showAssist').checked=false;setup(1);showHub();
}
function requestGuidedTraining(){
 if(stressFieldOrigin||trainingRun)return;
 if(activeDestination==='training'){trainingReturnDestination=null;enterGuidedTraining();return;}
 trainingReturnDestination=activeDestination;trainingLaunchRequested=true;showHub();requestDestination('training');
}
function restartGuidedDrill(){
 if(!trainingRun||openPanelId)return;
 if(trainingLesson(trainingRun))restartTrainingLesson(trainingRun);else trainingRun=createTrainingRun();setup(1);begin();
}
function nextTrainingDrill(skip){
 if(!trainingRun||!started||battle.paused||openPanelId||hubOpen||!advanceTraining(trainingRun,{skip}))return;
 setup(1);begin();
}
function exitGuidedTraining(){
 if(cardPracticeOrigin){exitUnitTrial();return;}
 if(!trainingRun||activeDestination!=='training')return;
 invalidateRenderProfile();
 const destination=trainingReturnDestination,saved=trainingSandbox;
 clearInput();cancelPendingImport();loadoutDrag.cancel();if(bindingLayout&&!bindingLayout.closed)bindingLayout.close();liveSkills?.dispose();
 trainingRun=null;trainingSandbox=null;trainingReturnDestination=null;
 if(saved){({profiles,profile,battle,clock,combatPoses,specialMotion,started,testingProtection,testingCollision,angle,power,notices,portraitCenter,portraitOverview}=saved);syncSessionMenus();$('#difficulty').value=profile.difficulty;$('#aimMode').value=profile.shootingMode;$('#battleAngle').value=String(angle);$('#battleAngleOut').textContent=angle+'°';$('#battlePower').value=String(power);$('#trajectory').value=saved.trajectory;$('#showAssist').checked=saved.showAssist;$('#battleFire').classList[saved.showAssist?'remove':'add']('hidden');attachLiveSkills();updatePowerMode();battle.shooter.angleMode=saved.shooterAngleMode;barSignature='';drawHotbar();}
 else {profiles=new CampaignProfiles({defaultName:'Playground'});profile=profiles.active;setup();}
 hubOpen=true;now=performance.now();lastPaint=null;showHub();
 if(destination&&destination!=='training'&&destinationSessions.has(destination))switchDestination(destination);
}
$('#introGuidedTraining').onclick=requestGuidedTraining;$('#dismissTrainingInvite').onclick=()=>{trainingInviteDismissed=true;renderTrainingEntry();};$('#introExitTraining').onclick=exitGuidedTraining;$('#pauseExitTraining').onclick=exitGuidedTraining;

function drawBackdrop(width,height){campaignRegionArt.drawBackdrop(ctx,width,height,battle.levelData,{pixelRatio:window.devicePixelRatio??1,contrast:regionContrast?.matches??false});}

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
 $('#viewStatus').textContent=isUnitTrial(trainingRun)?`${SKILLS[trainingRun.cardId].name} trial · no reinforcements`:`Battle ${battle.level} · `+(battle.enemies.finalStand?battle.enemies.status(observeBattlefield(battle)):portraitOverview?`${battle.badTeam.length} enemies · ${battle.enemies.remaining} incoming`:!onScreen?'Hero off-screen · tap Hero':portraitOffscreenStatus(battle,camera)||`${battle.badTeam.length} enemies · drag map to look ahead`);
 if(!onScreen&&hasEquippedBow()&&profile.shootingMode==='classic')$('#combatAimHint').textContent='Tap Hero to return to your bow';
}

function render(){renderTrainingEntry();trainingCoach.render({visible:!!trainingRun&&started&&!hubOpen&&!battle.paused&&!openPanelId});notices=notices.filter(n=>battle.tick-n.tick<(n.life??40));const active=battle.activeSkill;const camera=measureScene();if(!camera.renderable)return false;
 ctx.setTransform(backingStore.pixelRatioX,0,0,backingStore.pixelRatioY,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,camera.width,camera.height);drawBackdrop(camera.width,camera.height);
 ctx.save();ctx.translate(camera.offsetX,camera.offsetY);ctx.scale(camera.scale,camera.scale);
 const terrainView=extendTerrainForCamera(battle.terrain.samples,camera);campaignRegionArt.drawTerrain(ctx,terrainView,battle.levelData,{contrast:regionContrast?.matches??false});drawArmyOrderMarker(ctx,battle,camera.scale,camera);drawCausewayGround(ctx,battle,camera.scale);
 for(const building of battle.structures)castle(building);
 for(const flag of [battle.ownFlag,battle.enemyFlag]){if(!Number.isFinite(flag.y))continue;const color=flag===battle.ownFlag?resolvePlayerPalette(profile.paletteId).tokens.flag.cloth:'#d99a75';line(flag.x,flag.y,flag.x,flag.y-52,'#e2d9b8',2);poly([[flag.x,flag.y-52],[flag.x+30,flag.y-44],[flag.x,flag.y-34]],color);if(flag===battle.ownFlag)drawFriendlyHeraldryCue(ctx,flag.x+9,flag.y-44,{size:8});}
 for(const unit of [...battle.goodTeam,...battle.badTeam]){if(unit===battle.hero&&unit.garrisoned()&&unit.hp>0){const station=garrisonStation(unit.garrisonBuilding);drawCombatTroop(ctx,{...unit,...station.hero,visible:true},combatPoses.pose(unit),{paletteId:profile.paletteId});}else troop(unit);if(!battle.auxiliaries)drawStatusBadges(ctx,unit,{reactiveElements:battle.reactiveElements,scale:camera.scale});}if(battle.auxiliaries){drawLevyBadges(ctx,[...battle.goodTeam,...battle.badTeam],battle.auxiliaries,{...camera,reactiveElements:battle.reactiveElements});for(const unit of [...battle.goodTeam,...battle.badTeam])drawStatusBadges(ctx,unit,{reactiveElements:battle.reactiveElements,scale:camera.scale});}for(const projectile of battle.objects.items)if(projectile.active&&Number.isFinite(projectile.vx)&&projectile.kind)drawArrow(projectile);for(const reactive of battle.reactiveElements)drawReactiveElement(ctx,reactive,camera.scale);for(const spell of battle.spells){if(spell.kind==='thunder_cloud'&&Number.isFinite(spell.x)&&Number.isFinite(spell.y)){circle(spell.x,spell.y,30,'#54697bad');circle(spell.x-26,spell.y+5,21,'#54697bad');circle(spell.x+24,spell.y+5,21,'#54697bad');}}
 drawTrainingTarget(ctx,battle.guidedTraining,camera.scale);
 const origin=battle.hero.launchPosition,dragMode=profile.shootingMode==='classic'||profile.shootingMode==='anywhere';
 if(hasEquippedBow()&&!battle.summary&&Number.isFinite(origin.y)&&dragMode){ctx.beginPath();ctx.arc(origin.x-.3,origin.y-.3,launchRingRadius(),0,Math.PI*2);ctx.strokeStyle='#12241de0';ctx.lineWidth=3.5/camera.scale;ctx.stroke();ctx.strokeStyle='#f2e2a6d9';ctx.lineWidth=1.5/camera.scale;ctx.stroke();}
 const showAim=hasEquippedBow()&&aimGuideVisible&&started&&!battle.paused&&!battle.outcome&&!openPanelId;
 // Preview the same latest pointer that release samples. Never pair a fresh
 // pointer tether with an old sampled angle, or draw a flight ray at the thumb.
 const manualAim=sampleManualAim({mode:profile.shootingMode,origin,anchor:battle.shooter.active?.anchor,pointer:battle.shooter.pointer,powerPercent:battle.shooter.powerPercent});
 drawManualAimGuide(ctx,{origin,aim:manualAim,scale:camera.scale,visible:showAim&&(!dragMode||aimPointerId!==null)});
 if(profile.shootingMode==='auto_aim'){const feedback=currentAutoAimFeedback();drawAlternateAimGuide(ctx,{mode:'auto_aim',guide:battle.shooter.guide,scale:camera.scale,visible:showAim,blocked:!['reachable','assisted'].includes(feedback?.state),trajectory:feedback?.aim});}
 for(const n of notices){if(drawElementalNotice(ctx,n,battle.tick,camera.scale))continue;if(n.kind==='wave'||n.kind==='heal'||n.kind==='blast'){drawCombatNotice(ctx,n,battle.tick);continue;}const age=battle.tick-n.tick;ctx.globalAlpha=1-age/40;if(n.radius){ctx.strokeStyle='#ebce80';ctx.lineWidth=3;ctx.beginPath();ctx.arc(n.x,n.y,n.radius*(.5+age/25),0,Math.PI*2);ctx.stroke();}else{ctx.fillStyle=n.color;ctx.font='17px system-ui';ctx.textAlign='center';ctx.fillText(n.text,n.x,n.y-age*1.2);}ctx.globalAlpha=1;}
 if((testingMode||demoMode)&&testingCollision){for(const building of battle.structures)drawFortificationCollision(ctx,building,{scale:camera.scale});for(const projectile of battle.objects.items)if(projectile.active&&Number.isFinite(projectile.x)&&Number.isFinite(projectile.y)){circle(projectile.x,projectile.y,2.5/camera.scale,'#68fff4');}}
 ctx.restore();
 drawObjectiveMarkers(ctx,battle,camera);
 $('#ownCastleHud').textContent=`Keep ${Math.max(0,Math.ceil(battle.goodCastle.hp))}`;$('#enemyCastleHud').textContent=`Enemy keep ${Math.max(0,Math.ceil(battle.badCastle.hp))}`;$('#ownFlagHud').textContent=flagDescription(battle.ownFlag);$('#enemyFlagHud').textContent=flagDescription(battle.enemyFlag);$('#flagHud').dataset.alert=String(battle.ownFlag.status!==3||battle.enemyFlag.status!==3);
 const xp=heroExperience(profile);$('#heroXpHud').textContent=xp.text;$('#heroXpFill').style.width=`${100*xp.fraction}%`;$('#armyHud').textContent=`Army slots ${battle.regularArmyCount}/${battle.friendlyQueue.cap} · Reserve ${battle.friendlyQueue.population}`;$('#openQueue').textContent=`Army / Queue · ${battle.friendlyQueue.queue.length}`;$('#activeProgress').textContent=active?`Rank ${active.rank} · ${Math.floor(active.xp)} / ${active.threshold} XP`:'';
 $('#heroHud').textContent=`Rank ${battle.profile.rank} · ${Math.max(0,Math.ceil(battle.hero.hp))} HP`;
 $('#goldHud').textContent=`${Math.floor(battle.profile.gold)} gold · ${battle.hero.garrisoned()?'Garrisoned':'On foot'}`;
 $('#enemyHud').textContent=isUnitTrial(trainingRun)?`${observeBattlefield(battle).enemyAlive} enemies · no reinforcements`:`${observeBattlefield(battle).enemyAlive} enemies · ${battle.enemies.remaining} reserves${battle.enemies.withdrawn?' · '+battle.enemies.withdrawn+' withdrawn':''}`;
 $('#waveHud').textContent=battle.enemies.status(observeBattlefield(battle));
 $('#heroHealth').style.width=`${100*Math.max(0,battle.hero.hp/battle.hero.maxHp)}%`;$('#activeName').textContent=active?SKILLS[active.id].name:'No skill selected';const ready=active&&active.cooldown<=0;$('#reloadFill').style.width=`${100*(active?1-active.cooldown/active.maximum:0)}%`;$('#reloadText').textContent=ready?'Bow ready':'Reloading';$('#battleFire').disabled=!started||!!battle.outcome||!ready||battle.paused||!!openPanelId;$('#activate').disabled=!started||battle.paused||!!battle.outcome||!battle.activationObjects.length;$('#openShop').disabled=!!battle.summary?.campaignComplete;$('#endingShop').disabled=!!battle.summary?.campaignComplete;const hud=contextualHudState(battle),screen=$('.battle-screen');screen.dataset.heroMode=hud.heroMode;screen.dataset.nearGarrison=String(hud.nearGarrison);screen.dataset.aiming=String(aimPointerId!==null);$('#activate').classList[hud.showActivation?'remove':'add']('hidden');$('#activate').textContent=hud.activationLabel;const alert=isUnitTrial(trainingRun)?'':priorityFlagAlert(battle);if($('#flagHud').textContent!==alert)$('#flagHud').textContent=alert;$('#flagHud').classList[alert?'remove':'add']('hidden');for(const button of document.querySelectorAll('[data-key]')){button.disabled=!started||battle.paused||!!battle.outcome||!!openPanelId;button.dataset.held=String(!!battle.input[button.dataset.key]);}drawHotbar();renderPortraitView(camera);updateObjectiveFeedback(battle);updateLevyFeedback(battle);updateCastlePracticeFeedback(battle);updateCausewayFeedback(battle);renderStressField(document,battle);return true;
}
document.addEventListener('click',()=>visualDirty=true);document.addEventListener('input',()=>visualDirty=true);

syncControlLabels();
function frame(time){cloudAccounts?.sync();
 const profiler=getRenderProfiler(),profileFrame=profiler.active?profiler.frame(time,performance.now(),{live:started&&!hubOpen&&!battle.paused&&!openPanelId,hidden:document.hidden,ended:!!battle.outcome||!!battle.stressField?.stopped}):false;
 if(toastUntil&&time>=toastUntil){$('#hudToast').classList.add('hidden');toastUntil=0;visualDirty=true;}
 const elapsed=Math.min(.25,Math.max(0,(time-now)/1000));now=time;
 if(started&&!hubOpen&&!battle.paused&&!document.hidden)clock.advance(elapsed);
 const signature=[battle,battle.tick,started,battle.paused,battle.activeSkill,battle.hotbar.bar,openPanelId];
 if(visualDirty||!lastPaint||signature.some((v,i)=>v!==lastPaint[i])){
  const renderStart=profileFrame?performance.now():null,submitted=render();
  if(renderStart!==null&&submitted){
   const renderEnd=performance.now();profiler.render(renderStart,renderEnd);
   if(profiler.wantsLoad(renderEnd)){const gallery=battle.hero.hp>0&&battle.hero.garrisoned()?garrisonStation(battle.hero.garrisonBuilding)?.hero:null;profiler.load(renderEnd,sampleBattleRenderLoad(battle,worldCamera,{heroGallery:gallery}));}
  }
  lastPaint=signature;visualDirty=false;
 }
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);

if(testingMode&&new URLSearchParams(window.location?.search??'').get('guide')==='1')enterGuidedTraining();
for(const id of ['#introWorkshop','#pauseWorkshop','#endingWorkshop'])$(id).onclick=showSkirmishWorkshop;$('#closeWorkshop').onclick=closeSkirmishWorkshop;$('#skirmishKeepAttempt').onclick=()=>{pendingSkirmish=null;$('#skirmishWorkshopHost').inert=false;$('#skirmishReplaceConfirm').classList.add('hidden');$('#skirmishPrepare').focus?.();};$('#skirmishReplaceAttempt').onclick=()=>{if(skirmishMode&&openPanelId==='#skirmishPanel'&&pendingSkirmish)prepareSkirmish(pendingSkirmish);};
if(skirmishMode){document.title='Castledecks · Seeded Skirmish';showSkirmishWorkshop();}

// Synchronous, one-shot entry only. No delayed callback can interrupt play.
if(localSaveEntryRequested&&activeDestination==='campaign'&&!testingMode&&!demoMode&&!temporarySessionActive()&&!started&&!openPanelId){showCampaignVault();$('#localSlots').querySelector('[data-local-continue]:not(:disabled)')?.focus?.();}

// Deployment opts in explicitly; static/guest builds make no account requests.
cloudAccounts=createGameCloudAccounts({document,window,enabled:window.CASTLEDECKS_ACCOUNTS===true,
 getState:()=>({profiles,battle,started,destination:activeDestination,temporarySession:temporarySessionActive(),loadGeneration,localReviewIntent:localCampaign.reviewIntent()}),
 getDecks:()=>profileDecks.get(profile),getProfileDecks:()=>profileDecks.snapshot(profiles),reviewCrownroad:text=>localCampaign.requestCheckpoint(text),
 replaceWayfarer:text=>applyCampaignText(text),reviewDecks:text=>{showSkills();deckPresets.open();$('#deckImportCode').value=text;$('#deckImportPrepare').onclick();return {staged:!$('#deckConfirm').classList.contains('hidden')};},
 openVault:()=>showCampaignVault()});
if(openPanelId==='#savePanel')cloudAccounts.open();
