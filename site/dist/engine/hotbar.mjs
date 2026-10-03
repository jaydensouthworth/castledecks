/** Independent three-bar input model; preserves held keys and selection order. */
import {SKILLS} from './progression.mjs';
export class Hotbar {
 constructor(skills,{activate=()=>{},changed=()=>{}}={}){this.skills=skills;this.activate=activate;this.changed=changed;this.bar=0;this.active=null;this.glow=0;this.mouseTested=false;this.wheel=0;this.rebuild();}
 rebuild(){this.bars=Array.from({length:3},()=>Array(10).fill(null));for(const skill of this.skills){if(skill.binding>=0&&skill.binding<30)this.bars[Math.floor(skill.binding/10)][skill.binding%10]=skill;}let found={bar:0,slot:0};for(let bar=0;bar<3;bar++){const slot=this.bars[bar].findIndex(Boolean);if(slot>=0)found={bar,slot};}this.bar=found.bar;this.glow=found.slot;this.active=this.bars[this.bar][this.glow];this.changed(this);}
 select(slot){const skill=this.bars[this.bar][slot];if(!skill)return false;this.glow=slot;if(SKILLS[skill.id]?.summon)this.activate(skill);else this.active=skill;this.changed(this);return true;}
 poll({mouseDown=false,pointerY=0,hitSlot=null,autoSlot=null,digits=[]}={}){
  if(!mouseDown)this.mouseTested=false;
  else if(!this.mouseTested&&pointerY>850){this.mouseTested=true;if(hitSlot!=null)this.select(hitSlot);else if(autoSlot!=null){const skill=this.bars[this.bar][autoSlot];if(SKILLS[skill?.id]?.summon)skill.autocast=!skill.autocast;}}
  for(let slot=0;slot<10;slot++)if(digits.includes(slot))this.select(slot);
 }
 change(direction){for(let attempt=0;attempt<3;attempt++){this.bar=(this.bar+direction+3)%3;const slot=this.bars[this.bar].findIndex(Boolean);if(slot>=0){this.glow=slot;this.active=this.bars[this.bar][slot];this.changed(this);return true;}}return false;}
 wheelEvent(delta){this.wheel=delta;}
 consumeWheel(){const delta=this.wheel;this.wheel=0;if(delta>0)this.change(-1);else if(delta<0)this.change(1);}
}
