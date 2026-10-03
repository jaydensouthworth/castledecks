/** Responsive presentation framing only. Simulation coordinates never change. */
import {WORLD_WIDTH,WORLD_HEIGHT} from './world-camera.mjs';
const finite = value => Number.isFinite(value);

/** Fit existing world geometry between real HUD instruments. Keep the original
 * scale whenever possible; only a genuinely short layout needs a smaller view.
 * Aim origins are the battle's fixed possible garrison/ground extrema, avoiding
 * a camera jump whenever the player enters or leaves a building. */
export function frameCombatCamera(camera,{groundY,structureTopY,aimOriginTopY,top,bottom,
 ringWorldRadius=69.2,ringMinPixels=22}={}){
 if(!camera.renderable||![groundY,structureTopY,aimOriginTopY,top,bottom].every(finite)||bottom-top<=ringMinPixels+1)return camera;
 top=Math.max(0,top);bottom=Math.min(camera.height,bottom);
 const available=bottom-top,structureSpan=groundY-structureTopY,aimSpan=groundY-aimOriginTopY;
 if(available<=ringMinPixels+1||structureSpan<=0||aimSpan<=0)return camera;
 const scale=Math.min(camera.scale,available/structureSpan,
  available/(aimSpan+ringWorldRadius),(available-ringMinPixels)/aimSpan);
 if(!(scale>0))return camera;
 const lower=Math.max(top-structureTopY*scale,
  top+Math.max(ringMinPixels,ringWorldRadius*scale)-aimOriginTopY*scale);
 const upper=bottom-groundY*scale;
 const preferred=camera.height/2-WORLD_HEIGHT/2*scale;
 const offsetY=Math.max(lower,Math.min(upper,preferred));
 return Object.freeze({...camera,scale,offsetX:camera.width/2-WORLD_WIDTH/2*scale,offsetY});
}
