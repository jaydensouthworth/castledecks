/** Original visual feedback for existing combat events. Presentation only:
 * no engine state changes, random draws, damage, target or timing decisions.
 */
const WAVES=new Set(['fire-wave','ice-wave','bomb-wave','heal-wave']);
const finitePoint=point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y);
export function combatNotice(event){
  if(event.type==='visual'&&WAVES.has(event.kind)&&finitePoint(event))
    return {kind:'wave',element:event.kind.split('-')[0],x:event.x,y:event.y,tick:event.tick,life:event.duration??40};
  if(event.type==='visual'&&['meteor-blast','comet-blast'].includes(event.kind)&&finitePoint(event)&&Number.isFinite(event.width)&&event.width>0)
    return {kind:'blast',element:event.kind==='meteor-blast'?'fire':'ice',x:event.x,y:event.y,radius:event.width/2,tick:event.tick,life:event.duration};
  if(event.type==='heal'&&event.amount>0&&finitePoint(event.target))
    return {kind:'heal',x:event.target.x,y:event.target.y-(event.target.height??40),amount:event.amount,tick:event.tick,life:40};
  return null;
}

function path(ctx,points,fill,stroke){
  ctx.beginPath();points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function ring(ctx,x,y,r,color,width=2){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function line(ctx,x,y,x2,y2,color,width=2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function cross(ctx,x,y,size,color){line(ctx,x-size,y,x+size,y,color,3);line(ctx,x,y-size,x,y+size,color,3);}

export function drawCombatNotice(ctx,notice,tick){
  const age=tick-notice.tick;if(age<0||age>=notice.life)return false;
  const phase=age/notice.life,fade=1-phase;
  ctx.save();ctx.translate(notice.x,notice.y);ctx.globalAlpha=fade;
  if(notice.kind==='blast'){
    const radius=notice.radius*(.2+.8*Math.sin(phase*Math.PI/2)),ice=notice.element==='ice',light=ice?'#d1f7ff':'#ffe0a0',edge=ice?'#7ec8e8':'#ed9151';
    ctx.globalAlpha=fade*.22;ctx.fillStyle=edge;ctx.beginPath();ctx.arc(0,0,radius*.8,0,Math.PI*2);ctx.fill();ctx.globalAlpha=fade;
    ring(ctx,0,0,radius,edge,4);ring(ctx,0,0,radius*.62,light,2);
    for(let i=0;i<8;i++){const a=i*Math.PI/4+.13,r=radius*.72,x=Math.cos(a)*r,y=Math.sin(a)*r,size=(ice?12:8)*(1-phase);path(ctx,[[x-Math.sin(a)*size,y+Math.cos(a)*size],[x+Math.cos(a)*size*2,y+Math.sin(a)*size*2],[x+Math.sin(a)*size,y-Math.cos(a)*size]],light);}
  }else if(notice.kind==='heal'){
    ctx.fillStyle='#a9efbb';ctx.font='bold 24px Georgia';ctx.textAlign='center';
    ctx.fillText('+'+Math.round(notice.amount),0,-14-age*.75);
  }else if(notice.element==='fire'){
    const pulse=.35+.65*Math.sin(Math.PI*phase),height=75*pulse;
    path(ctx,[[-25,0],[-19,-height*.38],[-14,-height*.13],[-7,-height*.79],[0,-height],[7,-height*.45],[15,-height*.67],[24,-height*.12],[25,0]],'#ce642d','#f3b66a');
    path(ctx,[[-12,0],[-7,-height*.32],[0,-height*.68],[6,-height*.21],[13,0]],'#ffe0a1');
    ring(ctx,0,-2,10+15*phase,'#eea154',2);
  }else if(notice.element==='ice'){
    const height=75*(.4+.6*Math.sin(Math.PI*phase));ctx.lineWidth=1.5;
    for(const [x,scale,lean] of [[-17,.65,-7],[0,1,3],[17,.77,7]]){
      path(ctx,[[x-8,0],[x-5,-height*scale*.6],[x+lean,-height*scale],[x+7,-height*scale*.5],[x+9,0]],'#77bbd4','#d3f5ff');
      line(ctx,x,0,x+lean,-height*scale,'#d3f5ff',1);
    }
  }else if(notice.element==='bomb'){
    ring(ctx,0,-3,8+17*phase,'#f4ca80',4);
    ring(ctx,0,-3,4+12*phase,'#cf8b53',2);
    for(let i=0;i<5;i++){const x=(i-2)*(7+phase*8),y=-Math.sin(Math.PI*phase)*(18+(i%2)*17);path(ctx,[[x-3,y],[x,y-5],[x+4,y-2],[x+2,y+3]],'#d4ba83');}
  }else if(notice.element==='heal'){
    ring(ctx,0,-3,12+13*phase,'#9edbb3',3);ring(ctx,0,-3,6+9*phase,'#e0f4c4',1);
    cross(ctx,0,-28-phase*18,8,'#d9f3b7');
    cross(ctx,-17,-12-phase*12,4,'#87cea1');cross(ctx,17,-17-phase*15,4,'#87cea1');
  }
  ctx.restore();return true;
}

const BADGE_COLORS={ice:'#a6dfee',fire:'#edab66',poison:'#b5c96a',fear:'#e0b38a',daze:'#e3ce83'};
export function statusBadges(unit,reactiveElements=[]){
  if(!unit.visible||!(unit.hp>0)||!finitePoint(unit))return [];
  const kinds=[];
  for(const effect of unit.effects?.effects??[])
    if(BADGE_COLORS[effect.kind]&&effect.duration>0&&!kinds.includes(effect.kind))kinds.push(effect.kind);
  // Fire arrows attach reactive fire rather than a target-local FireEffect.
  // Read these existing objects so the status disappears as soon as they die.
  for(const reactive of reactiveElements)
    if(reactive.active&&!reactive.dying&&reactive.stuckTo===unit&&BADGE_COLORS[reactive.element]&&!kinds.includes(reactive.element))kinds.push(reactive.element);
  if(unit.knockedDown&&!kinds.includes('daze'))kinds.push('daze');
  return kinds.slice(0,4);
}
export function drawStatusBadges(ctx,unit,{reactiveElements=[],scale=1}={}){
  const kinds=statusBadges(unit,reactiveElements);if(!kinds.length)return;
  const screen=Number.isFinite(scale)&&scale>0?scale:1,badgeScale=Math.max(1.5,.75/screen);
  ctx.save();ctx.translate(unit.x,unit.y-(unit.height??45)-14-7*badgeScale);ctx.scale(badgeScale,badgeScale);ctx.lineWidth=1.5;
  kinds.forEach((kind,index)=>{
    const x=(index-(kinds.length-1)/2)*15,color=BADGE_COLORS[kind];
    ctx.fillStyle='#201914e8';ctx.beginPath();ctx.arc(x,0,7,0,Math.PI*2);ctx.fill();
    if(kind==='ice')path(ctx,[[x,-5],[x+4,0],[x,5],[x-4,0]],color);
    else if(kind==='fire')path(ctx,[[x-4,4],[x-4,-1],[x-1,-5],[x+1,-1],[x+3,-3],[x+4,4]],color);
    else if(kind==='poison'){for(const [dx,dy] of [[-2,2],[2,2],[0,-2]]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+dx,dy,1.7,0,Math.PI*2);ctx.fill();}}
    else if(kind==='fear'){line(ctx,x,-4,x,1,color,2);line(ctx,x,3,x,4,color,2);}
    else{line(ctx,x-4,0,x+4,0,color);line(ctx,x,-4,x,4,color);line(ctx,x-3,-3,x+3,3,color);}
  });
  ctx.restore();
}
