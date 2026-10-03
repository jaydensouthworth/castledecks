/** Independent hero and castle functional adapters. Art/animation are separate.
 * Source-traced movement/garrison and castle HP rules; no browser/Flash runtime.
 */
import {heroStats} from './combat.mjs';import {EffectQueue} from './effects.mjs';
export class Castle {
 constructor({x,y,hp,team,maxOccupants=4,shotOffset={x:0,y:-200},services={}}){Object.assign(this,{x,y,hp,maxHp:hp,team,permanentTeam:team,maxOccupants,shotOffset,services});this.occupiedBy='neutral';this.occupants=[];this.lastAttackTimer=0;this.destroyed=false;this.canGetHit=true;this.isFighter=false;this.immunity='poison ice heal regen convert fear';this.multipliers={lightning:.5,fire:2,ice:.05,blunt:3,slice:.5,pierce:.5};this.effects=new EffectQueue(this);}
 hasHP(){return this.hp>0;}
 hasRoom(){return this.occupants.length<this.maxOccupants;}
 addOccupant(unit){if(this.occupants.length===0){this.occupiedBy=unit.team;this.services.ownershipChanged?.(this);}this.occupants.push(unit);}
 addToOccupants(unit){this.addOccupant(unit);}
 removeOccupant(unit){const index=this.occupants.indexOf(unit);if(index>=0)this.occupants.splice(index,1);if(!this.occupants.length){if(this.permanentTeam==='neutral')this.services.ownershipChanged?.(this);this.occupiedBy='neutral';}}
 removeFromOccupants(unit){this.removeOccupant(unit);}
 step(){this.effects.step();if(this.lastAttackTimer>0)this.lastAttackTimer--;}
 get underAttack(){return this.lastAttackTimer>0;}
 takeDamage(amount){this.lastAttackTimer=50;this.hp-=amount;this.flameScale=this.hp/this.maxHp<=.5?150*(.5-this.hp/this.maxHp)/.5:0;if(this.hp<=0){this.hp=0;this.destroy();}this.services.healthChanged?.(this);}
 destroy(){this.destroyed=true;this.clipPresent=false;this.hitbox=null;this.headbox=null;this.services.destroyed?.(this);this.services.stateChange?.();}
}
export class Hero {
 constructor({x,y,rank=1,world,structures=[],input=()=>({}),services={}}){Object.assign(this,{x,y,rank,world,structures,input,services});const stats=heroStats(rank);this.maxHp=stats.maxHp;this.hp=stats.maxHp;this.speed=stats.speed;this.shotPower=stats.shotPower;this.vx=0;this.facing=1;this.type='hero';this.lifeType='living';this.team='good';this.isFighter=true;this.airUnit=false;this.knockedDown=false;this.dead=false;this.garrisonBuilding=null;this.canGetHit=true;this.visible=true;this.attacking=[];this.attackedBy=[];this.attackLimit=1;this.attackedByLimit=1;this.multipliers={lightning:1,fire:1,ice:1,blunt:1,slice:1,pierce:1};this.immunity='';this.effects=new EffectQueue(this);}
 hasHP(){return this.hp>0;}
 garrisoned(){return this.garrisonBuilding!=null;}
 garrisonInto(building){if(!building.hasRoom()||(building.occupiedBy!==this.team&&building.occupiedBy!=='neutral'))return false;this.garrisonBuilding=building;this.visible=false;this.canGetHit=false;building.addOccupant(this);return true;}
 attemptGarrison(){for(const building of (typeof this.structures==='function'?this.structures():this.structures)){if(this.garrisoned())break;if(Math.abs(building.x-this.x)<20&&building.hp>0)this.garrisonInto(building);}}
 leaveGarrison(){if(this.garrisonBuilding){this.visible=true;this.garrisonBuilding.removeOccupant(this);this.garrisonBuilding=null;this.canGetHit=true;}}
 get launchPosition(){return this.garrisonBuilding?{x:this.garrisonBuilding.x+this.garrisonBuilding.shotOffset.x,y:this.garrisonBuilding.y+this.garrisonBuilding.shotOffset.y}:{x:this.x,y:this.y-30};}
 // Keep player movement on finite sampled terrain. Other world objects retain
 // their source-specific out-of-range sampling; exact Flash edge behavior is unverified.
 step(){this.effects.step();const input=this.input();if(input.mouseDown)this.vx=0;else if(input.left){this.leaveGarrison();this.vx=-this.speed}else if(input.right){this.leaveGarrison();this.vx=this.speed}else if(input.up)this.attemptGarrison();else if(input.down)this.leaveGarrison();else this.vx=0;if(this.garrisonBuilding&&!this.garrisonBuilding.hasHP())this.leaveGarrison();const nextX=this.x+this.vx,nextY=this.world.elevationAt(nextX);if(Number.isFinite(nextX)&&Number.isFinite(nextY)){this.x=nextX;this.y=nextY;}else this.vx=0;if(!input.mouseDown&&this.vx!==0)this.facing=Math.sign(this.vx);else if(input.mouseDown&&Math.abs(input.pointerX-input.shooterX)>.001)this.facing=input.pointerX<input.shooterX?1:-1;this.services.updated?.(this);}
 interruptAction(){}
 takeDamage(amount){if(amount>0&&this.world.testing&&this.world.protectedTesting)return;if(this.hp>0){this.hp-=amount;if(this.hp<=0){this.dead=true;this.services.stateChange?.();}}this.services.healthChanged?.(this);}
}
