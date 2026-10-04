import {statusBadges} from './combat-feedback.mjs';
/** Presentation only. Authoritative temporary troops keep individual marks;
 * nearby marks share a counted pennant. No actor, ticket or camera is changed. */
const validScale=value=>Number.isFinite(value)&&value>0?value:1;
const alive=unit=>unit?.visible!==false&&!unit.destroyed&&!unit.dead&&!unit.garrisonBuilding&&unit.hp>0&&Number.isFinite(unit.x)&&Number.isFinite(unit.y);
const intersects=(a,b,pad=2)=>a.left<b.right+pad&&a.right+pad>b.left&&a.top<b.bottom+pad&&a.bottom+pad>b.top;
const box=badge=>({left:badge.x-badge.width/2,right:badge.x+badge.width/2,top:badge.y-7,bottom:badge.y+10});
function placeBadge(badge,obstacles,width,height){
 const fits=()=>{const r=box(badge);return r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=height&&!obstacles.some(other=>intersects(r,other));};
 const initial=badge.y;
 // Monotonic interval packing cannot return into a cleared lower obstacle.
 for(let n=0;n<=obstacles.length;n++){
  const hits=obstacles.filter(other=>intersects(box(badge),other));
  if(!hits.length){if(fits())return true;break;}
  badge.y=Math.min(...hits.map(hit=>hit.top))-12;
 }
 // At the top edge try below the cluster, retaining the true anchor connector.
 badge.y=Math.max(initial,badge.anchorY+18);
 for(let n=0;n<=obstacles.length;n++){
  const hits=obstacles.filter(other=>intersects(box(badge),other));
  if(!hits.length){if(fits())return true;break;}
  badge.y=Math.max(...hits.map(hit=>hit.bottom))+9;
 }
 // Rare edge fallback: nearest clear in-bounds location. Normal fields finish
 // in the two interval passes. The candidate set is bounded by the viewport.
 if(Number.isFinite(width)&&Number.isFinite(height)){
  const candidates=[],stepX=badge.width+4;
  for(let y=8;y<=height-11;y+=20)for(let x=badge.width/2+1;x<=width-badge.width/2-1;x+=stepX)candidates.push({x,y,d:Math.abs(x-badge.anchorX)+Math.abs(y-initial)});
  candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
  for(const candidate of candidates){badge.x=candidate.x;badge.y=candidate.y;if(fits())return true;}
 }
 // An impossibly tiny viewport cannot fit all marks. Expose that explicitly;
 // do not paint a misleading overlapping label or manufacture a troop count.
 badge.x=badge.anchorX;badge.y=initial;return false;
}
export function levyBadgeLayout(units,controller,{scale=1,offsetX=0,offsetY=0,width=Infinity,height=Infinity,reactiveElements=[]}={}){
 const zoom=validScale(scale),seen=new Set(),marks=[],statusBands=[];
 if(!controller)return {scale:zoom,offsetX,offsetY,marks,badges:[],statusBands,omittedLabels:0};
 for(const unit of units??[]){
  if(!unit||seen.has(unit))continue;seen.add(unit);
  const x=unit.x*zoom+offsetX,y=(unit.y-(Number.isFinite(unit.height)?unit.height:70))*zoom+offsetY;
  const kinds=statusBadges(unit,reactiveElements),badgeScale=Math.max(1.5,.75/zoom);
  if(kinds.length){const radius=7*badgeScale*zoom+1,half=(kinds.length-1)/2*15*badgeScale*zoom+radius,center=(unit.y-(unit.height??45)-14-7*badgeScale)*zoom+offsetY;const band={left:x-half,right:x+half,top:center-radius,bottom:center+radius};if(Object.values(band).every(Number.isFinite))statusBands.push(band);}
  if(!alive(unit)||!controller.owns(unit)||x<0||x>width||y<0||y>height)continue;
  let markerY=y-5;
  marks.push({unit,x,y,markerY,team:unit.team??'neutral',id:String(unit.auxiliaryIdentity?.id??'')});
 }
 // All statuses are now known, including ordinary neighbours later in a roster.
 for(const mark of marks)for(let n=0;n<=statusBands.length;n++){const hit=statusBands.filter(b=>intersects({left:mark.x-2.5,right:mark.x+2.5,top:mark.markerY-2,bottom:mark.markerY+2.5},b));if(!hit.length)break;mark.markerY=Math.max(...hit.map(b=>b.bottom))+4.5;}
 marks.sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
 const groups=[];
 for(const mark of marks){
  const group=groups.find(g=>g.team===mark.team&&Math.max(g.right,mark.x)-Math.min(g.left,mark.x)<=38&&Math.max(g.bottom,mark.y)-Math.min(g.top,mark.y)<=16);
  if(group){group.marks.push(mark);group.left=Math.min(group.left,mark.x);group.right=Math.max(group.right,mark.x);group.top=Math.min(group.top,mark.y);group.bottom=Math.max(group.bottom,mark.y);}
  else groups.push({team:mark.team,marks:[mark],left:mark.x,right:mark.x,top:mark.y,bottom:mark.y});
 }
 const markerBoxes=marks.map(mark=>({left:mark.x-2.5,right:mark.x+2.5,top:mark.markerY-2,bottom:mark.markerY+2.5}));
 const badges=[],occupied=[...statusBands,...markerBoxes];let omittedLabels=0;
 for(const group of groups){
  const count=group.marks.length,label=count===1?'L':`L×${count}`,badgeWidth=label.length*6+8,anchorX=(group.left+group.right)/2;
  const x=Number.isFinite(width)?Math.max(badgeWidth/2+1,Math.min(width-badgeWidth/2-1,anchorX)):anchorX;
  const badge={x,y:group.top-29,width:badgeWidth,count,label,team:group.team,marks:group.marks,anchorX,anchorY:group.top-5};
  badge.visible=placeBadge(badge,occupied,width,height);if(badge.visible)occupied.push(box(badge));else omittedLabels++;
  badges.push(badge);
 }
 return {scale:zoom,offsetX,offsetY,marks,badges,statusBands,omittedLabels};
}
const colors=team=>team==='good'?['#d2efce','#153a31']:team==='bad'?['#f1c5bc','#672a28']:['#e9dbad','#51431f'];
export function drawLevyBadges(ctx,units,controller,camera={}){
 const layout=levyBadgeLayout(units,controller,camera);if(!layout.marks.length)return layout;
 const {scale,offsetX,offsetY}=layout,point=(x,y)=>[(x-offsetX)/scale,(y-offsetY)/scale];ctx.save();
 for(const badge of layout.badges){if(!badge.visible)continue;const [x,y]=point(badge.x,badge.y),[ax,ay]=point(badge.anchorX,badge.anchorY),[,stroke]=colors(badge.team);ctx.strokeStyle=stroke+'77';ctx.lineWidth=1/scale;ctx.beginPath();ctx.moveTo(x,y+10/scale);ctx.lineTo(ax,ay);ctx.stroke();}
 for(const mark of layout.marks){const [x,y]=point(mark.x,mark.markerY),[fill,stroke]=colors(mark.team);ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1/scale;ctx.beginPath();ctx.moveTo(x-2.5/scale,y-2/scale);ctx.lineTo(x+2.5/scale,y-2/scale);ctx.lineTo(x,y+2.5/scale);ctx.closePath();ctx.fill();ctx.stroke();}
 for(const badge of layout.badges){if(!badge.visible)continue;const [x,y]=point(badge.x,badge.y),[fill,stroke]=colors(badge.team),half=badge.width/2/scale,h=7/scale;
  ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.beginPath();ctx.moveTo(x-half,y-h);ctx.lineTo(x+half,y-h);ctx.lineTo(x+half,y+h);ctx.lineTo(x,y+10/scale);ctx.lineTo(x-half,y+h);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=stroke;ctx.font=`bold ${10/scale}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(badge.label,x,y);
 }
 ctx.restore();return layout;
}
