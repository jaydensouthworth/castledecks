/** Independent stateless damage rules, recovered from HeroArrow and Util.
 * Injected random numbers are a test seam, not Flash RNG emulation.
 */
export function heroArrowBaseDamage(skillRank) {return 50+Math.ceil(skillRank*20);}
export function damageVariation(random=Math.random) {return 1+(Math.floor(random()*20)-10)/100;}
export function heroArrowImpact({skillRank=0,pierceMultiplier=1,critical=false,random=Math.random}={}) {
  return Math.floor(heroArrowBaseDamage(skillRank)*(critical?2:1)*pierceMultiplier*damageVariation(random));
}
export function seededRandom(seed) {
  let state=(seed>>>0)||0x9e3779b9;
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
export const DIFFICULTY=Object.freeze({easy:Object.freeze({speed:.75,hp:.5,damage:.5}),medium:Object.freeze({speed:.9,hp:1,damage:1}),hard:Object.freeze({speed:1.1,hp:1.5,damage:1.5}),insane:Object.freeze({speed:2,hp:2.5,damage:2.5})});
export function heroStats(heroRank=1){return {shotPower:285,speed:1.5+.1*heroRank,maxHp:300+Math.floor(10*heroRank)};}

export const TROOPS=Object.freeze({
 grunt:{hp:100,speed:.35,damage:8,pierce:1,slice:1,blunt:1,attackedBy:2,attacks:1},
 tallGrunt:{hp:150,speed:.35,damage:15,pierce:1.4,slice:.9,blunt:1,attackedBy:4,attacks:2},
 archer:{hp:75,speed:.4,damage:19,pierce:1,slice:1,blunt:1,fire:2,attackedBy:2,attacks:1},
 priest:{hp:50,speed:.4,damage:8,pierce:1,slice:1,blunt:1,lightning:.1,fire:1.2,ice:1.2,attackedBy:2,attacks:1},
 mount:{hp:125,speed:.5,damage:10,pierce:1,slice:.8,blunt:1.2,attackedBy:2,attacks:1},
 trebuchet:{hp:300,speed:.25,damage:125,pierce:.5,slice:.5,blunt:1.1,fire:2,attackedBy:5,attacks:1}
});
export function troopStats(type,{level=1,rank=null,difficulty='medium'}={}) {
 const base=TROOPS[type];const coefficients=DIFFICULTY[difficulty];
 if(!base||!coefficients)throw new RangeError('Unknown troop or difficulty');
 const n=rank??level,healthGrowth=rank===null?.067:.335,speedGrowth=rank===null?.004:.02;
 return {maxHp:Math.ceil(base.hp*(1+healthGrowth*n)*coefficients.hp),speed:2*base.speed*(1+speedGrowth*n)*coefficients.speed,damage:base.damage*(1+healthGrowth*n)*coefficients.damage,rank:rank??Math.floor(level/5)};
}
export function meleeImpact({damage,multiplier=1,random=Math.random}) {return Math.floor((1+(Math.floor(random()*50)-25)/100)*damage*multiplier);}
