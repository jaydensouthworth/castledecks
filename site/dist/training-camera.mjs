/** Guided-practice framing only. Retain the ordinary close-up scale and world
 * coordinates. Reserve the coach's expanded footprint even when collapsed, so
 * toggling its disclosure never changes pointer-to-world mapping. */
const finite=n=>Number.isFinite(n);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function trainingViewBounds(camera,{hero,target=null,targetBox=null,groundY}={}){
 if(!camera?.renderable||![hero?.x,hero?.y,groundY].every(finite))return null;
 const scale=camera.scale,point=target&&[target.x,target.y].every(finite)?target:{x:hero.x+450,y:groundY-80};
 const box=targetBox&&[targetBox.x,targetBox.y,targetBox.width,targetBox.height].every(finite)?targetBox:null;
 const ring=Math.max(22,69.2*scale),mark=Math.max(18,22*scale);
 return {minX:Math.min(hero.x*scale-ring,point.x*scale-mark,box?box.x*scale:Infinity),
  maxX:Math.max(hero.x*scale+ring,point.x*scale+mark,box?(box.x+box.width)*scale:-Infinity),
  minY:Math.min(hero.y*scale-ring,point.y*scale-mark,box?box.y*scale:Infinity),
  maxY:Math.max(hero.y*scale+ring,point.y*scale+mark,groundY*scale,box?(box.y+box.height)*scale:-Infinity),centerX:(hero.x+point.x)/2};
}
export function trainingCoachHeight(camera,{top,bottom,...geometry}={}){
 const bounds=trainingViewBounds(camera,geometry);if(!bounds||![top,bottom].every(finite))return 128;
 return clamp(Math.floor(bottom-top-12-(bounds.maxY-bounds.minY)),44,128);
}
export function frameTrainingCamera(camera,{top,bottom,left=12,right=12,...geometry}={}){
 if(!camera?.renderable||camera.width>=camera.height||![top,bottom,left,right].every(finite))return camera;
 const bounds=trainingViewBounds(camera,geometry);if(!bounds)return camera;
 top=Math.max(0,top);bottom=Math.min(camera.height,bottom);left=Math.max(0,left);right=Math.max(0,right);
 const minOffset=left-bounds.minX,maxOffset=camera.width-right-bounds.maxX;
 // No actor or zoom shrinkage. On impossibly small/zoomed layouts, retain the
 // closer view; ordinary aim cancellation on resize remains the UI's boundary.
 if(bottom-top<bounds.maxY-bounds.minY||minOffset>maxOffset)return camera;
 return Object.freeze({...camera,offsetX:clamp(camera.width/2-bounds.centerX*camera.scale,minOffset,maxOffset),
  offsetY:top+(bottom-top-(bounds.maxY-bounds.minY))/2-bounds.minY});
}
