/** Independent neutral-tower adapter, including source stale affiliations.
 * Internal destroyed flag is presentation metadata, not list reconciliation.
 */
import {Castle} from './actors.mjs';
export class Tower extends Castle {
 constructor({x,y,level=1,services={}}){super({x,y,hp:3000*(1+level/30),team:'neutral',maxOccupants:3,shotOffset:{x:0,y:-130},services});this.type='tower';}
 removeOccupant(unit){const index=this.occupants.indexOf(unit);if(index>=0)this.occupants.splice(index,1);if(this.occupants.length===0){this.services.disowned?.(this);this.occupiedBy='neutral';}}
 takeDamage(amount){this.lastAttackTimer=50;this.hp-=amount;const ratio=this.hp/this.maxHp;if(ratio<=.5)this.flameScale=300*(.5-ratio)/.5;if(this.hp<=0){this.hp=0;this.destroy();}this.services.healthChanged?.(this);}
 destroy(){this.destroyed=true;this.clipPresent=false;this.hitbox=null;this.headbox=null;this.services.destroyed?.(this);}
 getReaction(){return 'destroy';}
}
export function towerPlacements(level,random=Math.random){const bound=Math.floor(level/7),count=Math.min(3,bound>0?Math.floor(random()*bound):0),spacing=1200/count,result=[];for(let i=0;i<count;i++)result.push(400+(.5+i)*spacing+Math.floor(random()*Math.ceil(spacing))-Math.ceil(spacing*.5));return result;}
