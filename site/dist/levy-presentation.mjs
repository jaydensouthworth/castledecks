/** Small opt-in Army read model and renderer; no permanent live-HUD row. */
export function levyArmyState(state){
 const {battle}=state,controller=battle?.auxiliaries;if(!controller)return null;
 const view=controller.snapshot,guard=state.active===true&&state.started===true&&!state.readOnly&&state.profile===battle.profile;
 const detail=battle.stressField?'Ten temporary troops were staged through the real levy controller. Unused tickets are discarded; no further calls.':{closed:'This attempt is closed. Undeployed levies are discarded.',preparation:'Start the field first. Open Army → Muster to call a wave.',dispatching:`${view.pending} levies committed. Resume to dispatch one every 20 simulation ticks.`,spent:'All four waves are spent. Surviving levies stay in this attempt.',slots:'Wait until five levy slots clear. Fallen bodies still occupy slots.',pause:'Open the paused Army tent to commit a wave.',ready:'Call five now, or save this finite wave for the next counterattack.'}[view.code];
 return {...view,...(battle.stressField?{wavesLeft:0}:{}),canCall:guard&&view.canCall,detail,stage:battle.enemies.status({enemyAlive:battle.badTeam.filter(u=>u.hp>0&&!u.dead&&!u.destroyed).length})};
}
export function callLeviesFromArmy(origin,now,expectedWave){
 if(now.battle!==origin.battle||now.profile!==origin.profile||!levyArmyState(now)?.canCall)return false;
 return now.battle.auxiliaries.callWave(expectedWave);
}
/** Call after each troop in the existing world transform. The L pennant denotes
 * temporary infantry without new HUD chrome or pointer interception. */
export function drawLevyBadge(ctx,unit,controller,scale=1){
 if(!controller?.owns(unit)||unit.visible===false||unit.destroyed||unit.garrisonBuilding||!(unit.hp>0))return false;
 const size=9/Math.max(.3,scale),x=unit.x,y=unit.y-(unit.height??70)-7/Math.max(.3,scale);
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#d2efce';ctx.strokeStyle='#153a31';ctx.lineWidth=1.5/Math.max(.3,scale);ctx.beginPath();ctx.moveTo(-size,-size);ctx.lineTo(size,-size);ctx.lineTo(size,size);ctx.lineTo(0,size*.6);ctx.lineTo(-size,size);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#153a31';ctx.font=`bold ${size*1.45}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('L',0,0);ctx.restore();return true;
}
export const LEVY_BRIEF=Object.freeze({title:'Levy defense',goal:'Protect your hero, home keep and home flag. Break the enemy keep, clear its deployed army and restore your home flag to win. Taking the enemy flag alone does not finish this field.',advice:'Army → Muster calls four finite waves of five rank-2 levies into ten separate slots. Save a wave for the rider counterattack at 45s, siege at 100s or final reserve at 160s. Breaking the enemy keep withdraws undispatched stages. Ordinary paid recruitment still spends gold and reserve.'});
export function levyFeedbackState(battle){
 if(!battle?.auxiliaries||battle.stressField)return null;
 const outcome=battle.outcome??battle.summary?.outcome,closed=!(battle.badCastle.hp>0),safe=battle.ownFlag.status===3;
 const causeText={hero:'Your hero fell.',flag:'Your home flag was captured.',keep:'Your home keep fell.'};
 const reason=outcome==='defeat'?(battle.levyDefeatCauses?.map(cause=>causeText[cause]).filter(Boolean).join(' ')||'The defense was lost.'):null;
 const status=outcome==='defeat'?'Defense lost':outcome==='victory'?'Defense won':closed?(safe?'Clear the field':'Recover home flag'):'Break the enemy keep';
 const stage=battle.enemies.status({enemyAlive:battle.badTeam.filter(u=>u.hp>0&&!u.dead&&!u.destroyed).length});
 return Object.freeze({title:'Levy defense',status,reason,portrait:`Levy defense · ${status}`,brief:`${LEVY_BRIEF.goal} ${stage}. Call finite levies in Army → Muster.`,result:outcome==='victory'?'Enemy keep broken, field cleared and home flag safe.':reason??'This attempt is still in progress.',ariaLabel:`Levy defense. ${status}. ${stage}.`});
}
/** Parent-owned hook after updateObjectiveFeedback. Reuses the existing battle
 * progress instruments and pause-objective paragraph; creates no nodes. */
export function updateLevyFeedback(battle,root=globalThis.document){
 const s=levyFeedbackState(battle),standard=root?.querySelector('.live-battle-standard');
 const write=(selector,text)=>{const node=root?.querySelector(selector);if(node)node.textContent=text;};
 if(!s){if(standard?.dataset.objective==='levy-defense'){delete standard.dataset.objective;standard.setAttribute('aria-label','Battle progress');const brief=root?.querySelector('#batteryObjectiveBrief');brief?.classList.add('hidden');if(brief)brief.textContent='';}return null;}
 if(standard){standard.dataset.objective='levy-defense';standard.setAttribute('aria-label',s.ariaLabel);}
 write('#combatBattleTitle',s.title);write('#combatEnemyState',s.status);write('#viewStatus',s.portrait);
 const brief=root?.querySelector('#batteryObjectiveBrief');brief?.classList.remove('hidden');write('#batteryObjectiveBrief',s.brief);return s;
}

/** Reuse the existing paused Army entry; never adds a live HUD control. */
export function levyMusterEntryState(battle){
 if(!battle?.auxiliaries||battle.stressField)return null;
 const view=battle.auxiliaries.snapshot;
 const suffix={ready:'Call 5 levies',pause:'Levies ready',dispatching:`${view.pending} levies arriving`,slots:'Levy slots needed',spent:'Levies spent',closed:'Defense ended',preparation:'Prepare levies'}[view.code];
 const reason=view.code==='slots'?`Need five free temporary slots; ${view.free} are free. Fallen bodies retain slots.`:view.code==='dispatching'?`${view.pending} already committed, deploying after Resume.`:view.code==='ready'||view.code==='pause'?'Five levies can be committed from Muster.':view.code==='spent'?'All four finite waves have been used.':view.code==='preparation'?'Start the field before calling a wave.':'This defense is finished.';
 return {label:`Army · ${suffix}`,aria:`Army and ground-line orders. ${view.closed?'No further levy calls.':`${view.wavesLeft} levy waves remain.`} ${reason}`,code:view.code};
}
export function updateLevyMusterEntry(battle,root=globalThis.document){
 const button=root?.querySelector('#pauseQueue');if(!button)return null;
 const view=levyMusterEntryState(battle);button.textContent=view?.label??'Army & ground line';
 if(view)button.setAttribute('aria-label',view.aria);else button.removeAttribute('aria-label');return view;
}
