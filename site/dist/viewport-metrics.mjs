/** Rectangle-union measurements for the viewport lab. No game state access. */
export function clipRect(rect, bounds) {
  const left=Math.max(rect.x,bounds.x),top=Math.max(rect.y,bounds.y);
  const right=Math.min(rect.x+rect.width,bounds.x+bounds.width),bottom=Math.min(rect.y+rect.height,bounds.y+bounds.height);
  return right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:null;
}
export function unionArea(rects) {
  const valid=rects.filter(r=>r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0);
  const xs=[...new Set(valid.flatMap(r=>[r.x,r.x+r.width]))].sort((a,b)=>a-b);let area=0;
  for(let i=1;i<xs.length;i++){
    const left=xs[i-1],right=xs[i],intervals=valid.filter(r=>r.x<right&&r.x+r.width>left).map(r=>[r.y,r.y+r.height]).sort((a,b)=>a[0]-b[0]);
    let height=0,start=null,end=null;
    for(const [a,b] of intervals){if(start===null){start=a;end=b;}else if(a>end){height+=end-start;start=a;end=b;}else end=Math.max(end,b);}
    if(start!==null)height+=end-start;area+=(right-left)*height;
  }
  return area;
}
export function measureOcclusion(rects,width,height,zone={x:width*.2,y:height*.2,width:width*.6,height:height*.55}) {
  const viewport={x:0,y:0,width,height},clipped=rects.map(r=>clipRect(r,viewport)).filter(Boolean);
  const area=unionArea(clipped),zoneArea=unionArea(clipped.map(r=>clipRect(r,zone)).filter(Boolean));
  return {area,fraction:width>0&&height>0?area/(width*height):0,zoneArea,zoneFraction:zone.width>0&&zone.height>0?zoneArea/(zone.width*zone.height):0,zone,rects:clipped};
}
export function touchConflicts(rects,minSize=44) {
  const undersized=rects.filter(r=>r.width<minSize-.5||r.height<minSize-.5),overlaps=[];
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const overlap=clipRect(rects[i],rects[j]);if(overlap&&overlap.width>1&&overlap.height>1)overlaps.push({a:rects[i].label,b:rects[j].label,rect:overlap});
  }
  return {undersized,overlaps};
}
