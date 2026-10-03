/** Original code-native flyer illustration. No extracted or traced game art.
 * Read-only local-space presentation: the engine and special-motion controller
 * remain the only owners of geometry, facing, position, animation and timing.
 * The bright, opaque body/head stays inside the existing target silhouette;
 * translucent membrane, tail and heraldry are decorative. No pixel buffers,
 * gradients, path arrays, caches, clocks, random draws or per-draw objects.
 */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const PALETTES=Object.freeze({
 fire:Object.freeze({body:'#b95d32',shade:'#6a332c',edge:'#e7944f',light:'#ffe0a0',ink:'#3d2928',wing:'#be774c'}),
 ice:Object.freeze({body:'#75b6c4',shade:'#3e657c',edge:'#badfeb',light:'#f0fcf7',ink:'#283e53',wing:'#9ccbd0'}),
 poison:Object.freeze({body:'#84994f',shade:'#475b3f',edge:'#bfd07c',light:'#e4e9ad',ink:'#2c3e30',wing:'#9faf68'}),
});
function fill(ctx,color){ctx.fillStyle=color;ctx.fill();}
function stroke(ctx,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function disk(ctx,x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);fill(ctx,color);}
function line(ctx,x,y,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);stroke(ctx,color,width);}

/** Fixed saddle location, with a split ivory pennon for allies versus three
 * dark bars for enemies. These geometry cues survive a grayscale view. */
function heraldry(ctx,good,edge){
 ctx.beginPath();ctx.moveTo(1,-5);ctx.lineTo(11,-2);ctx.lineTo(11,9);ctx.lineTo(6,13);ctx.lineTo(1,9);ctx.closePath();
 fill(ctx,good?'#294956':'#5b302e');stroke(ctx,edge,1);
 if(good){
  ctx.beginPath();ctx.moveTo(3,-1);ctx.lineTo(6,2);ctx.lineTo(9,0);ctx.lineTo(9,6);ctx.lineTo(6,9);ctx.lineTo(3,6);ctx.closePath();fill(ctx,'#f1e1b5');
  line(ctx,6,4,6,10,'#294956',1.2);
 }else{
  line(ctx,3,0,3,7,'#e0ac83',1.5);line(ctx,6,1,6,10,'#e0ac83',1.5);line(ctx,9,2,9,7,'#e0ac83',1.5);
 }
}

function dragonWings(ctx,c,lift,alpha,ice){
 // Far wing: independent trailing scallop makes the two wings legible at
 // small scale without changing the existing pair of shoulder roots.
 ctx.globalAlpha=alpha*.32;
 ctx.beginPath();ctx.moveTo(-7,-6);
 ctx.quadraticCurveTo(-12,-15,-14,-35-lift);
 ctx.lineTo(-4,-25-lift*.65);ctx.lineTo(3,-22);
 ctx.quadraticCurveTo(-5,-24,-4,-14);ctx.quadraticCurveTo(-10,-18,-7,-6);ctx.closePath();fill(ctx,c.wing);
 ctx.globalAlpha=alpha*.55;
 ctx.beginPath();ctx.moveTo(-7,-6);ctx.quadraticCurveTo(-12,-15,-14,-35-lift);ctx.lineTo(-4,-25-lift*.65);ctx.lineTo(3,-22);stroke(ctx,c.ink,1.25);
 // Near wing: one bent spar, three radiating fingers, and a scalloped edge.
 // Tip retains (33, -37-wingLift), exactly matching the old motion envelope.
 ctx.globalAlpha=alpha*.44;
 ctx.beginPath();ctx.moveTo(5,-7);ctx.quadraticCurveTo(9,-21-lift*.3,14,-27-lift*.65);
 ctx.quadraticCurveTo(22,-30-lift*.8,33,-37-lift);
 ctx.quadraticCurveTo(27,-26-lift*.7,27,-17-lift*.4);
 ctx.quadraticCurveTo(20,-24-lift*.45,19,-8-lift*.15);
 ctx.quadraticCurveTo(12,-17-lift*.2,11,-4);ctx.quadraticCurveTo(8,-8,5,-7);ctx.closePath();fill(ctx,c.wing);
 ctx.globalAlpha=alpha*.7;
 ctx.beginPath();ctx.moveTo(5,-7);ctx.quadraticCurveTo(9,-21-lift*.3,14,-27-lift*.65);ctx.quadraticCurveTo(22,-30-lift*.8,33,-37-lift);stroke(ctx,c.ink,1.8);
 ctx.globalAlpha=alpha*.62;
 ctx.beginPath();ctx.moveTo(14,-27-lift*.65);ctx.lineTo(27,-17-lift*.4);ctx.moveTo(14,-27-lift*.65);ctx.lineTo(19,-8-lift*.15);ctx.moveTo(14,-27-lift*.65);ctx.lineTo(11,-4);stroke(ctx,c.shade,1);
 line(ctx,6,-10,14,-27-lift*.65,c.edge,1);
 if(ice){ctx.beginPath();ctx.moveTo(14,-27-lift*.65);ctx.lineTo(22,-24-lift*.55);ctx.lineTo(18,-15-lift*.25);ctx.closePath();fill(ctx,c.light);}
 ctx.globalAlpha=alpha;
}

function dragonCrest(ctx,c,element){
 if(element==='fire'){
  ctx.beginPath();ctx.moveTo(-10,-8);ctx.lineTo(-7,-22);ctx.lineTo(-3,-12);ctx.lineTo(3,-23);ctx.lineTo(6,-11);ctx.lineTo(12,-17);ctx.lineTo(13,-6);ctx.closePath();fill(ctx,c.edge);stroke(ctx,c.ink,.8);
  ctx.beginPath();ctx.moveTo(-16,-3);ctx.lineTo(-15,-12);ctx.lineTo(-11,-5);ctx.closePath();fill(ctx,c.light);
 }else if(element==='ice'){
  ctx.beginPath();ctx.moveTo(-10,-8);ctx.lineTo(-10,-20);ctx.lineTo(-1,-15);ctx.lineTo(5,-24);ctx.lineTo(10,-11);ctx.lineTo(16,-11);ctx.lineTo(12,-4);ctx.closePath();fill(ctx,c.light);stroke(ctx,c.edge,.85);
  ctx.beginPath();ctx.moveTo(-23,-4);ctx.lineTo(-25,-12);ctx.lineTo(-19,-7);ctx.lineTo(-14,-12);ctx.lineTo(-15,-3);ctx.closePath();fill(ctx,c.light);stroke(ctx,c.shade,.8);
  line(ctx,5,-22,4,-12,c.edge,1);
 }else{
  // Rounded sacs and a swept leaf-shaped ear, rather than another spiked crown.
  disk(ctx,-4,-12,4,c.shade);disk(ctx,6,-10,4,c.shade);disk(ctx,14,-4,3,c.shade);
  disk(ctx,-5,-13,2.25,c.edge);disk(ctx,5,-11,2.25,c.edge);disk(ctx,13,-5,1.7,c.edge);
  ctx.beginPath();ctx.moveTo(-18,-4);ctx.quadraticCurveTo(-12,-12,-10,-10);ctx.quadraticCurveTo(-11,-3,-17,-1);ctx.closePath();fill(ctx,c.edge);stroke(ctx,c.shade,1);
 }
}

export function drawElementalFlyer(ctx,unit,motion,element){
 const c=PALETTES[element];if(!c)return false;
 const lift=Math.max(-22,Math.min(14,finite(motion?.wingLift,Math.sin(finite(unit.animation?.frame)*.35)*9))),alpha=finite(ctx.globalAlpha,1);
 const flex=lift/14,good=unit.team==='good';
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 // Curved taper replaces the straight tail stick. Tail tip remains (40,19).
 ctx.globalAlpha=alpha*.7;
 ctx.beginPath();ctx.moveTo(17,7);ctx.bezierCurveTo(27,8,28,16-flex*2,40,19);ctx.bezierCurveTo(29,19,23,14,16,12);ctx.closePath();fill(ctx,c.shade);
 line(ctx,23,12,39,19,c.edge,1.1);ctx.globalAlpha=alpha;
 dragonWings(ctx,c,lift,alpha,element==='ice');
 // The target body keeps the prior extremities: (-27,-2), (-7,-13),
 // (26,7), (9,16), head center (-19,2) and eye (-23,0).
 ctx.beginPath();ctx.moveTo(-27,-2);ctx.lineTo(-20,-4);ctx.quadraticCurveTo(-14,-8,-7,-13);
 ctx.quadraticCurveTo(4,-13,10,-11);ctx.quadraticCurveTo(20,-4,26,7);
 ctx.quadraticCurveTo(19,13,9,16);ctx.quadraticCurveTo(-2,14,-12,12);
 ctx.lineTo(-27,10);ctx.closePath();fill(ctx,c.body);stroke(ctx,c.ink,1.7);
 // Neck, ribcage and tucked rear leg separate at normal battle size.
 ctx.beginPath();ctx.moveTo(-15,7);ctx.quadraticCurveTo(-9,0,-6,-8);ctx.quadraticCurveTo(-2,-5,-4,2);
 ctx.quadraticCurveTo(7,2,14,9);ctx.lineTo(21,9);ctx.lineTo(10,14);ctx.quadraticCurveTo(-3,11,-15,10);ctx.closePath();fill(ctx,c.shade);
 ctx.beginPath();ctx.moveTo(-11,-10);ctx.quadraticCurveTo(1,-13,10,-9);ctx.lineTo(16,-3);ctx.quadraticCurveTo(3,-8,-8,-5);ctx.closePath();fill(ctx,c.edge);
 // Two tucked talons are inside the original lower body extent, and flex
 // passively with the inherited wing value; no body/head bob or anchor shift.
 ctx.beginPath();ctx.moveTo(-7,6);ctx.lineTo(-3,11-flex*.5);ctx.lineTo(-7,14);ctx.lineTo(-11,12);stroke(ctx,c.ink,2.1);
 line(ctx,-7,14,-9,15,c.light,1.15);line(ctx,16,9,15,13-flex*.5,c.ink,2);line(ctx,15,13-flex*.5,12,15,c.light,1.15);
 dragonCrest(ctx,c,element);
 // Fixed head volume, shaded jaw, slanted brow and a small bright eye. The
 // mouth is never animated to imply a shot from a different launch anchor.
 ctx.beginPath();ctx.moveTo(-27,-2);ctx.quadraticCurveTo(-23,-7,-18,-6);ctx.quadraticCurveTo(-12,-4,-12,2);
 ctx.quadraticCurveTo(-13,7,-18,9);ctx.lineTo(-27,7);ctx.closePath();fill(ctx,c.body);stroke(ctx,c.ink,1.2);
 ctx.beginPath();ctx.moveTo(-27,4);ctx.lineTo(-16,5);ctx.lineTo(-18,9);ctx.lineTo(-27,7);ctx.closePath();fill(ctx,c.shade);
 line(ctx,-26,-2,-19,-3,c.edge,1.1);disk(ctx,-23,0,2.15,c.light);disk(ctx,-23.3,.1,.75,c.ink);
 line(ctx,-25,-2,-21,-1.6,c.ink,.9);line(ctx,-26,6,-19,7,c.light,.8);
 if(element==='fire'){
  ctx.beginPath();ctx.moveTo(-15,6);ctx.lineTo(-11,-1);ctx.lineTo(-9,7);ctx.lineTo(-4,10);ctx.lineTo(-12,11);ctx.closePath();fill(ctx,c.light);
 }else if(element==='poison'){
  disk(ctx,-12,8,3.5,c.shade);disk(ctx,-12.5,7,2.1,c.edge);
  ctx.beginPath();ctx.moveTo(-20,7);ctx.lineTo(-18,12);ctx.lineTo(-16,8);ctx.closePath();fill(ctx,c.light);
 }else{
  ctx.beginPath();ctx.moveTo(-14,5);ctx.lineTo(-9,-2);ctx.lineTo(-7,7);ctx.lineTo(-10,11);ctx.closePath();fill(ctx,c.light);
 }
 heraldry(ctx,good,c.edge);
 ctx.globalAlpha=alpha;ctx.restore();return true;
}

/** Medieval rider glider: same cockpit/head centers and target body bounds as
 * the prior Air Fighter, with translucent sail, ribbed wood spars, leather
 * keel and gilded fittings. The actual projectile still launches at (0,0).
 */
export function drawAirFighter(ctx,unit,motion){
 if(unit?.type!=='air')return false;
 const alpha=finite(ctx.globalAlpha,1),lift=Math.max(-22,Math.min(14,finite(motion?.wingLift,Math.sin(finite(unit.animation?.frame)*.35)*9))),good=unit.team==='good';
 const cloth=good?'#7199a5':'#a3634e',dark=good?'#2b424c':'#503330',wood='#927045',brass='#d5b274',ivory='#ecd6a0';
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 ctx.globalAlpha=alpha*.35;
 ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(-15,-35-lift);ctx.lineTo(2,-18);ctx.lineTo(8,-7);ctx.closePath();fill(ctx,ivory);
 ctx.globalAlpha=alpha*.63;
 ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(-15,-35-lift);ctx.lineTo(2,-18);stroke(ctx,wood,1.6);
 ctx.globalAlpha=alpha*.46;
 ctx.beginPath();ctx.moveTo(7,-6);ctx.lineTo(14,-28-lift*.7);ctx.lineTo(33,-37-lift);ctx.lineTo(28,-19-lift*.3);ctx.lineTo(20,-15-lift*.18);ctx.lineTo(16,-5);ctx.closePath();fill(ctx,ivory);
 ctx.globalAlpha=alpha*.78;
 ctx.beginPath();ctx.moveTo(7,-6);ctx.lineTo(14,-28-lift*.7);ctx.lineTo(33,-37-lift);ctx.lineTo(28,-19-lift*.3);ctx.lineTo(20,-15-lift*.18);ctx.lineTo(16,-5);stroke(ctx,wood,1.7);
 ctx.beginPath();ctx.moveTo(14,-28-lift*.7);ctx.lineTo(28,-19-lift*.3);ctx.moveTo(14,-28-lift*.7);ctx.lineTo(20,-15-lift*.18);ctx.moveTo(14,-28-lift*.7);ctx.lineTo(16,-5);stroke(ctx,wood,1);
 line(ctx,17,-29-lift*.7,28,-26-lift*.65,cloth,3);
 ctx.globalAlpha=alpha;
 // The old decorative extremities (-31,0) and (37,8) are retained at
 // reduced opacity. The solid keel, unlike the old full wedge, fits the
 // enemy body box (-28.65..27.82). Rider head remains exactly (6,-21).
 ctx.globalAlpha=alpha*.58;
 ctx.beginPath();ctx.moveTo(-31,0);ctx.lineTo(-19,-4);ctx.lineTo(-6,-12);ctx.lineTo(11,-10);ctx.lineTo(37,8);ctx.lineTo(9,15);ctx.lineTo(-12,10);ctx.lineTo(-28,11);ctx.closePath();fill(ctx,wood);stroke(ctx,dark,1.1);
 ctx.globalAlpha=alpha;
 ctx.beginPath();ctx.moveTo(-28,1);ctx.lineTo(-19,-4);ctx.lineTo(-6,-12);ctx.lineTo(11,-10);ctx.lineTo(26,6);ctx.lineTo(24,11);ctx.lineTo(9,15);ctx.lineTo(-12,10);ctx.lineTo(-27,10);ctx.closePath();fill(ctx,wood);stroke(ctx,dark,1.6);
 ctx.beginPath();ctx.moveTo(-28,3);ctx.lineTo(-10,1);ctx.lineTo(12,5);ctx.lineTo(26,9);ctx.lineTo(9,13);ctx.lineTo(-12,8);ctx.lineTo(-28,9);ctx.closePath();fill(ctx,dark);
 line(ctx,-26,3,12,7,brass,1.5);line(ctx,17,11,40,19,wood,3);line(ctx,25,12,32,10,brass,1.2);
 // Fixed carved prow replaces the old animal eye; it does not move the target.
 ctx.beginPath();ctx.moveTo(-28,0);ctx.lineTo(-22,-5);ctx.lineTo(-15,-3);ctx.lineTo(-18,7);ctx.lineTo(-27,8);ctx.closePath();fill(ctx,brass);stroke(ctx,dark,1);
 line(ctx,-26,1,-20,0,dark,1.4);line(ctx,-22,-4,-24,6,ivory,1);
 // Rider cloak is split for allies and square/scalloped for enemies.
 ctx.beginPath();ctx.moveTo(4,-17);ctx.lineTo(10,-16);ctx.lineTo(14,-4);ctx.lineTo(good?8:11,good?-7:-3);ctx.lineTo(5,-3);ctx.lineTo(2,-8);ctx.closePath();fill(ctx,cloth);stroke(ctx,dark,1);
 disk(ctx,6,-21,5,ivory);
 ctx.beginPath();ctx.moveTo(1,-21);ctx.quadraticCurveTo(1,-28,7,-26);ctx.quadraticCurveTo(12,-25,11,-20);ctx.lineTo(1,-20);ctx.closePath();fill(ctx,dark);stroke(ctx,brass,1);
 line(ctx,4,-22,9,-22,brass,1);line(ctx,4,-13,-4,-8,ivory,2.3);line(ctx,-4,-8,-7,-3,dark,1.5);
 heraldry(ctx,good,brass);
 ctx.globalAlpha=alpha;ctx.restore();return true;
}
