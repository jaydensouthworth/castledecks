/** Read-only presentation state for the live combat HUD.
 * No input or engine mutation, listeners, timers, or side effects on import.
 */
import {shelteredEnemyCount} from './garrison-intel.mjs';
import {SKILLS} from './engine/progression.mjs';

export function enemyHudProgress(battle){
 const living=battle.badTeam.filter(unit=>unit.hp>0&&!unit.dead&&!unit.destroyed).length;
 if(!battle.enemies.finalStand)return `${living} enemies · ${battle.enemies.remaining} incoming`;
 if(living&&shelteredEnemyCount(battle)===living)return `Final stand · ${living} in towers`;
 if(living)return `Final stand · ${living} ${living===1?'enemy':'enemies'}`;
 return battle.enemies.remaining?'Final stand · Gorath incoming':'Final stand · Clearing field';
}

const aimHints={
 classic:'Pull from your hero · Release to fire',
 anywhere:'Pull anywhere · Release to fire',
 point_aim:'Tap the battlefield to fire',
 auto_aim:'Lead moving targets · Tap to shoot'
};
export function combatHudState(battle,{aiming=false,angle=20,power=100,keyboard=false,autoAimStatus=null}={}) {
 const skill=battle.activeSkill,config=skill?SKILLS[skill.id]:null;
 const seconds=skill?Math.max(0,Math.ceil(skill.cooldown/66)):0;
 const ready=!!skill&&seconds===0;
 const garrisoned=battle.hero.garrisoned();
 const mode=battle.profile.shootingMode;
 const activationKinds=new Set(battle.activationObjects.map(object=>object.kind));
 const activationLabel=activationKinds.size===1&&activationKinds.has('flak_arrow')?'Burst'
  :activationKinds.size===1&&activationKinds.has('thunder_arrow')?'Storm':'Activate';
 return {
  name:config?.name??'Choose a skill', ready,
  status:seconds?`Ready in ${seconds}s`:config?.summon?'Squad ready':aiming&&['classic','anywhere'].includes(mode)?'Release to fire':'Ready',
  mode,aiming,
  aimHint:mode==='auto_aim'&&autoAimStatus?.hint?autoAimStatus.hint:aiming&&['classic','anywhere'].includes(mode)?'Release to fire your drawn shot':aimHints[mode]??aimHints.classic,
  title:`Battle ${battle.level}`,
  enemies:enemyHudProgress(battle),
  heroState:garrisoned?'Garrisoned':'On foot',
  moveLabel:garrisoned?'Leave the keep':keyboard?'A / D · Move':'Hold to move',
  precisionName:config?.summon?'Summon squad':'Precise shot',
  precisionDetail:config?.summon?`${config.summon.cost} GOLD`:`${angle}° · ${power}%`,
  precisionLabel:config?.summon?`Summon ${config.name}`:`Fire ${config?.name??'selected arrow'} at ${angle} degrees and ${power} percent power`,
  activationLabel,
  activationDetail:keyboard?'SPACE · AIRBORNE':'TAP · AIRBORNE',
  activationAria:activationLabel==='Burst'?'Burst airborne flak bomb':activationLabel==='Storm'?'Activate airborne thunder arrow to create a storm':'Activate airborne abilities',
 };
}

function write(root,id,text){const el=root.querySelector('#'+id);if(el&&el.textContent!==text)el.textContent=text;return el;}
export function updateCombatHud(battle,options={},root=document) {
 const keyboard=typeof matchMedia==='function'&&matchMedia('(hover:hover) and (pointer:fine) and (min-width:1050px)').matches;
 const state=combatHudState(battle,{...options,keyboard});
 const hud=root.querySelector('.live-hud');if(!hud)return state;
 hud.dataset.ready=String(state.ready);hud.dataset.aimMode=state.mode;hud.dataset.aiming=String(state.aiming);
 write(root,'combatBattleTitle',state.title);write(root,'combatEnemyState',state.enemies);
 write(root,'combatHeroState',state.heroState);write(root,'combatMoveLabel',state.moveLabel);
 write(root,'combatSkillName',state.name);write(root,'combatSkillState',state.status);
 write(root,'combatAimHint',state.aimHint);
 const precise=write(root,'battleFire',state.precisionName);if(precise){precise.dataset.detail=state.precisionDetail;precise.setAttribute('aria-label',state.precisionLabel);}
 const activate=write(root,'activate',state.activationLabel);if(activate){activate.dataset.detail=state.activationDetail;activate.setAttribute('aria-label',state.activationAria);}
 return state;
}
