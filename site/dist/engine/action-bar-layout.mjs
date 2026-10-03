/** Independent Action Bar Setup behavior, including its stale-binding bug.
 * No original artwork or storage implementation is included.
 * Skill.binding is live gameplay state; wrapper.binding is editor-only state.
 * An evicted wrapper becomes pending WITHOUT clearing its skill's binding.
 */
export const ACTION_BAR_SLOT_COUNT=30;
export const actionBarSlotCenter=index=>({x:185+101.8*(index%10),y:80+101.8*(Math.floor(index/10)+1)});
export const actionBarPendingCenter=index=>({x:1250+101.8*(index%4),y:80+101.8*(Math.floor(index/4)+1)});

const validBinding=value=>Number.isInteger(value)&&value>=-1&&value<ACTION_BAR_SLOT_COUNT;
const readBinding=skill=>typeof skill.getActionBarID==='function'?skill.getActionBarID():skill.binding;
const writeBinding=(skill,binding)=>{
  if(typeof skill.setActionBarID==='function')skill.setActionBarID(binding);
  else skill.binding=binding;
};
const removeFirst=(list,item)=>{const i=list.indexOf(item);if(i!==-1)list.splice(i,1);};

export class ActionBarWrapper {
  constructor(skill,binding) {
    this.skill=skill;this.binding=binding;this.slot=null;this.visible=false;
    this.x=undefined;this.y=undefined;this.origin={x:undefined,y:undefined};
  }
  get placed(){return this.binding!==-1;}
  setPosition({x,y}){this.x=x;this.y=y;this.origin={x,y};}
  resetToOrigin(){this.x=this.origin.x;this.y=this.origin.y;}
}

/**
 * new ActionBarLayout(profile.skills, {
 *   refresh: layout => hotbar.rebuild(),
 *   hitIcon: (wrapper, globalPointer, layout) => boolean,
 *   hitSlot: (slot, globalPointer, layout) => boolean
 * })
 *
 * drop(skillOrWrapper,0..29|-1) is one complete released drop and returns
 * {wrapper,from,to,displaced}. It refreshes even for same-slot/outside no-ops.
 * wrappers retains every constructed wrapper in profile order for inspection;
 * only visible wrappers occur in dragIcons. Duplicate-binding losers remain
 * inaccessible, exactly as their missing source icons do. dragIcons is created
 * once: ascending surviving placed slots followed by pending profile order.
 *
 * Optional sampled input mirrors the source press latch and release-only write.
 * press/move/release take localPointer plus optional global hit-test pointer.
 * No default icon/slot hitbox is invented; provide the two geometry callbacks.
 * Source slot/grid coordinates are offered as behavioral centers, not artwork.
 *
 * Invalid slots, malformed bindings, unknown/hidden wrappers and closed-window
 * drops are rejected at this modern API boundary. These validation errors are
 * not claimed as recovered malformed-input behavior. Combat state and storage
 * are never stepped, cloned, reset or saved by this class.
 */
export class ActionBarLayout {
  constructor(skills,{refresh=()=>{},hitIcon=()=>false,hitSlot=()=>false,
    slotPosition=actionBarSlotCenter,pendingPosition=actionBarPendingCenter}={}) {
    if(!Array.isArray(skills))throw new TypeError('Action bar layout requires the live skills array');
    if([refresh,hitIcon,hitSlot,slotPosition,pendingPosition].some(fn=>typeof fn!=='function'))
      throw new TypeError('Action bar callbacks must be functions');
    const bindings=skills.map(skill=>{
      if(skill===null||typeof skill!=='object')throw new TypeError('Action bar skills must be objects');
      const binding=readBinding(skill);
      if(!validBinding(binding))throw new RangeError('Skill binding must be -1 or a slot from 0 to 29');
      return binding;
    });
    this.skills=skills;this.onRefresh=refresh;this.hitIcon=hitIcon;this.hitSlot=hitSlot;
    this.slotPosition=slotPosition;this.pendingPosition=pendingPosition;
    this.placed=Array(ACTION_BAR_SLOT_COUNT);this.pending=[];
    this.wrappers=skills.map((skill,i)=>new ActionBarWrapper(skill,bindings[i]));
    this.slots=Array.from({length:ACTION_BAR_SLOT_COUNT},(_,index)=>({index,...slotPosition(index),holding:null}));
    this.dragIcons=[];this.held=null;this.testedHit=false;this.mouseDown=false;this.closed=false;
    this.pointer={x:0,y:0};this.hitPointer={x:0,y:0};this.lastDrop=null;
    for(const wrapper of this.wrappers) {
      if(wrapper.placed)this.placed[wrapper.binding]=wrapper;
      else this.pending.push(wrapper);
    }
    for(let index=0;index<ACTION_BAR_SLOT_COUNT;index++) {
      const wrapper=this.placed[index];
      if(wrapper!=null){this._link(index,wrapper);this.dragIcons.push(wrapper);}
    }
    this.dragIcons.push(...this.pending);
    for(const wrapper of this.dragIcons)wrapper.visible=true;
    this.refresh('init');
  }

  resolve(skillOrWrapper) {
    const wrapper=skillOrWrapper instanceof ActionBarWrapper?skillOrWrapper:
      this.dragIcons.find(item=>item.skill===skillOrWrapper);
    if(!this.dragIcons.includes(wrapper))throw new RangeError('Skill or wrapper has no visible icon in this layout');
    return wrapper;
  }
  _link(index,wrapper){this.slots[index].holding=wrapper;wrapper.slot=this.slots[index];}
  _unlink(wrapper) {
    if(wrapper.slot!=null)wrapper.slot.holding=null;
    wrapper.slot=null;wrapper.binding=-1;
  }
  _addToPending(wrapper) {
    this.placed[wrapper.binding]=null;
    this._unlink(wrapper);
    this.pending.push(wrapper);
  }
  _addToPlaced(wrapper,index) {
    if(!wrapper.placed)removeFirst(this.pending,wrapper);
    else {this.placed[wrapper.binding]=null;this._unlink(wrapper);}
    wrapper.binding=index;this.placed[index]=wrapper;
  }
  refresh(reason='manual',drop=null) {
    if(this.closed)throw new Error('Action bar layout is closed');
    for(let index=0;index<ACTION_BAR_SLOT_COUNT;index++) {
      const wrapper=this.placed[index];
      if(wrapper!=null)wrapper.setPosition(this.slots[wrapper.binding]);
    }
    for(let i=0;i<this.pending.length;i++)this.pending[i].setPosition(this.pendingPosition(i));
    this.onRefresh(this,{reason,drop});
    return this;
  }
  drop(skillOrWrapper,index) {
    if(this.closed)throw new Error('Action bar layout is closed');
    if(!validBinding(index))throw new RangeError('Drop slot must be -1 or an integer from 0 to 29');
    const wrapper=this.resolve(skillOrWrapper);
    if(this.held!=null&&this.held!==wrapper)throw new Error('Release the held icon before dropping another skill');
    const from=wrapper.binding;
    let displaced=null;
    if(index!==-1) {
      displaced=this.slots[index].holding;
      if(displaced!=null)this._addToPending(displaced);
      this._addToPlaced(wrapper,index);this._link(index,wrapper);
    }else if(wrapper.placed)this._addToPending(wrapper);
    if(!wrapper.placed)wrapper.resetToOrigin();
    // Only the actively released wrapper writes to Skill. Never "repair" the
    // displaced incumbent's stale binding here: it is the source behavior.
    writeBinding(wrapper.skill,wrapper.binding);
    const result={wrapper,from,to:wrapper.binding,displaced};
    this.lastDrop=result;this.refresh('drop',result);
    if(this.held===wrapper)this.held=null;
    return result;
  }

  move(localPointer,globalPointer=localPointer){this.pointer={...localPointer};this.hitPointer={...globalPointer};}
  press(localPointer=this.pointer,globalPointer=localPointer){this.move(localPointer,globalPointer);this.mouseDown=true;}
  release(localPointer=this.pointer,globalPointer=localPointer){this.move(localPointer,globalPointer);this.mouseDown=false;}
  step({mouseDown,pointer,hitPointer}={}) {
    if(this.closed)return null;
    if(pointer!==undefined)this.move(pointer,hitPointer??pointer);
    else if(hitPointer!==undefined)this.hitPointer={...hitPointer};
    if(mouseDown!==undefined)this.mouseDown=!!mouseDown;
    if(this.mouseDown&&!this.testedHit) {
      this.testedHit=true;
      this.held=this.dragIcons.find(wrapper=>this.hitIcon(wrapper,this.hitPointer,this))??null;
    }else if(!this.mouseDown)this.testedHit=false;
    if(this.held==null)return null;
    if(!this.mouseDown) {
      let index=-1;
      for(const slot of this.slots)if(this.hitSlot(slot,this.hitPointer,this)){index=slot.index;break;}
      return this.drop(this.held,index);
    }
    this.held.x=this.pointer.x;this.held.y=this.pointer.y;
    return null;
  }
  close() {
    if(this.closed)return false;
    // Source close refreshes gameplay, then unloads. A held icon is not released
    // and no wrapper-to-Skill write is synthesized on this path.
    this.onRefresh(this,{reason:'close',drop:null});
    this.closed=true;this.held=null;return true;
  }
}
