/** Presentation adapter. The combat model owns success; clicks cannot set it. */
import {TRAINING_LESSONS,trainingCopy} from './guided-training.mjs';
export function createTrainingCoach({document,controlLabel,getController,canAct,onNext,onSkip,onRestart,onExit,onAssist,onLoadout}){
 const $=id=>document.getElementById?.(id)??document.querySelector('#'+id);
 let signature='',presentedController=null,scrollController=null,scrollIndex=null;
 for(const [id,fn] of Object.entries({trainingNext:onNext,trainingSkip:onSkip,trainingRestart:onRestart,trainingExit:onExit,trainingAssist:onAssist,trainingLoadout:onLoadout}))$(id).onclick=event=>{if(event?.detail>1||!presentedController||presentedController!==getController())return;fn();};
 const show=(id,visible)=>$(id).classList[visible?'remove':'add']('hidden');
 return {render({visible=false}={}){
  const controller=getController();presentedController=controller;show('trainingCoach',visible&&!!controller);if(!controller||!visible){signature='';return;}
  const copy=trainingCopy(controller,controlLabel),{lesson,run}=controller,complete=controller.complete,live=canAct();
  const changed=controller!==scrollController||run.index!==scrollIndex;
  if(changed){signature='';scrollController=controller;scrollIndex=run.index;}
  const next=[copy.title,copy.instruction,copy.feedback,complete,live,run.index].join('|');if(next===signature)return;signature=next;
  $('trainingProgress').textContent=lesson?`Drill ${run.index+1} / ${TRAINING_LESSONS.length} · Assisted`:'Practice complete · Assisted';
  $('trainingTitle').textContent=copy.title;$('trainingInstruction').textContent=copy.instruction;$('trainingFeedback').textContent=copy.feedback;
  show('trainingNext',!!lesson&&complete);show('trainingSkip',!!lesson&&!complete);show('trainingRestart',!!lesson);show('trainingLoadout',!lesson);
  show('trainingAssist',!!lesson&&['aim','arc','counter'].includes(lesson.id)&&!complete);
  for(const id of ['trainingAssist','trainingNext','trainingSkip','trainingRestart'])$(id).disabled=!live;
  $('trainingAssist').textContent='Aim help: fire at target';
  $('trainingLoadout').textContent=run.reviewedLoadout?'Review loadout again':'Review my loadout';
  $('trainingExit').textContent=lesson?'Leave drills':run.reviewedLoadout?'Finish practice':'Back to lobby';
  // Only a newly presented drill returns to its title. Pause, live feedback,
  // coach disclosure and same-drill menu returns keep the player's scroll.
  if(changed)$('trainingCoach').scrollTop=0;
 },reset(){signature='';presentedController=null;}};
}
