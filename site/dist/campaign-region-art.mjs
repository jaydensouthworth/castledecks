/**
 * Castledecks' distant campaign scenery. Presentation only: never writes to a
 * battle, never samples gameplay RNG, and never contributes collision geometry.
 * Four original paintings; five static lighting treatments. No animation means
 * reduced-motion users get the same complete scene without an extra code path.
 */
const freeze = Object.freeze;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const REGION_ART_LIMITS = freeze({imageEntries: 2, imageWidth: 1774,
 imageHeight: 887, canvasEdge: 1774, canvasPixels: 1774 * 887, pixelRatio: 2});
export const REGION_ART = freeze({
 oaks: freeze({id:'hearthwood', name:'Hearthwood', first:1, last:6,
  url:'./images/regions/hearthwood.webp', sky:'#899c9c', mist:'#718078', portraitFocus:.30,
  ground:freeze(['#58684b','#3d5040','#293d35']), rim:'#a3b480', fleck:'#aaba8266', strata:'#233b323d'}),
 lowlands: freeze({id:'bannerfen', name:'Bannerfen', first:7, last:15,
  url:'./images/regions/bannerfen.webp', sky:'#9ba9aa', mist:'#687e77', portraitFocus:.52,
  ground:freeze(['#72704b','#4f5d45','#31463d']), rim:'#beb783', fleck:'#c6bb8466', strata:'#2b40343d'}),
 pines: freeze({id:'frostpine', name:'Frostpine', first:16, last:23,
  url:'./images/regions/frostpine.webp', sky:'#819da4', mist:'#607e80', portraitFocus:.78,
  ground:freeze(['#536d65','#38574f','#28413e']), rim:'#a7c1b2', fleck:'#c0d4c966', strata:'#243e413d'}),
 wasteland: freeze({id:'cinderlands', name:'Cinderlands', first:24, last:30,
  url:'./images/regions/cinderlands.webp', sky:'#ad9b8c', mist:'#7c706b', portraitFocus:.18,
  ground:freeze(['#76635a','#564f4a','#3c4140']), rim:'#c9a487', fleck:'#c6a88866', strata:'#372f303d'})
});
const DAYPARTS = freeze({
 dawn: freeze({name:'Dawn', wash:'#9c7598', alpha:.13, top:'#526981', topAlpha:.16,
  horizon:'#f5c28e', horizonAlpha:.22, groundTint:'#63747b', groundAlpha:.11}),
 noon: freeze({name:'Noon', wash:'#d0e4e0', alpha:.07, top:'#7fa8bb', topAlpha:.06,
  horizon:'#f4e8b6', horizonAlpha:.07, groundTint:'#acb79a', groundAlpha:.03}),
 default: freeze({name:'Daylight', wash:'#d3c29d', alpha:.025, top:'#63838d', topAlpha:.04,
  horizon:'#e9d5ad', horizonAlpha:.05, groundTint:'#728572', groundAlpha:0}),
 dusk: freeze({name:'Dusk', wash:'#684b6f', alpha:.25, top:'#373e62', topAlpha:.27,
  horizon:'#e8a87c', horizonAlpha:.17, groundTint:'#60566e', groundAlpha:.14}),
 night: freeze({name:'Night', wash:'#263d62', alpha:.58, top:'#172844', topAlpha:.34,
  horizon:'#87a9be', horizonAlpha:.08, groundTint:'#36576c', groundAlpha:.22})
});
function mixColor(a, b, amount) {
 const A=parseInt(a.slice(1),16), B=parseInt(b.slice(1),16);
 const channel=shift=>Math.round(((A>>shift)&255)*(1-amount)+((B>>shift)&255)*amount).toString(16).padStart(2,'0');
 return `#${channel(16)}${channel(8)}${channel(0)}`;
}
const SCENES = freeze(Object.fromEntries(Object.entries(REGION_ART).map(([scenery, region])=>
 [scenery,freeze(Object.fromEntries(Object.entries(DAYPARTS).map(([timeOfDay, lighting])=>
  [timeOfDay,freeze({key:`${scenery}:${timeOfDay}`,scenery,timeOfDay,region,lighting,
   ground:freeze(region.ground.map(c=>mixColor(c,lighting.groundTint,lighting.groundAlpha))),
   rim:mixColor(region.rim,lighting.groundTint,lighting.groundAlpha*.4)})])))])));

/** Returns a precomputed identity, not a new per-frame object. Metadata wins. */
export function campaignScene(data) {
 const level=Number.isFinite(data?.level)?clamp(Math.floor(data.level),1,30):1;
 const fallback=level<=6?'oaks':level<=15?'lowlands':level<=23?'pines':'wasteland';
 const region=Object.hasOwn(SCENES,data?.scenery)?SCENES[data.scenery]:SCENES[fallback];
 return Object.hasOwn(region,data?.timeOfDay)?region[data.timeOfDay]:region.default;
}

/** Additional presentation backing store only. The main game canvas is unchanged. */
export function sceneBackingSize(width, height, requestedDpr=1) {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const dpr=Number.isFinite(requestedDpr)&&requestedDpr>0?requestedDpr:1;
 const scale=Math.min(dpr,REGION_ART_LIMITS.pixelRatio,REGION_ART_LIMITS.canvasEdge/width,
  REGION_ART_LIMITS.canvasEdge/height,Math.sqrt(REGION_ART_LIMITS.canvasPixels/width/height));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}

function gradient(c,x0,y0,x1,y1,a,b) {const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function releaseImage(image) {
 if(!image)return;
 image.onload=null;image.onerror=null;
 if(typeof image.close==='function')image.close();
 else if(typeof image.removeAttribute==='function')image.removeAttribute('src');
}
function defaultImage(){return typeof Image==='undefined'?null:new Image();}
function defaultCanvas(){return typeof document==='undefined'?null:document.createElement('canvas');}

/**
 * At most two decoded region images + one composition canvas. Switching daypart
 * overwrites the canvas; switching region evicts the least-recent image before
 * starting another load. Failed assets remain bounded and use a calm fallback.
 */
export function createCampaignRegionArt({createImage=defaultImage,createCanvas=defaultCanvas,onInvalidate=()=>{}}={}) {
 const images=new Map();
 let activeScene=null,composition=null,compositionKey='',disposed=false;
 let terrainContext=null,terrainScene=null,terrainInk=null;
 let terrainA=1,terrainB=0,terrainC=0,terrainD=1,terrainE=0,terrainF=0;
 let highContrast=false;
 const stats={loads:0,compositions:0,failures:0,evictions:0};
 function clearComposition(){compositionKey='';}
 function ensureImage(scene) {
  const id=scene.region.id;
  if(images.has(id)){const found=images.get(id);images.delete(id);images.set(id,found);return found;}
  while(images.size>=REGION_ART_LIMITS.imageEntries){const [oldId,old]=images.entries().next().value;images.delete(oldId);releaseImage(old.image);old.image=null;stats.evictions++;}
  const image=createImage();const entry={image,state:image?'loading':'failed',width:0,height:0};images.set(id,entry);
  if(!image)return entry;
  stats.loads++;
  image.decoding='async';
  const loaded=()=>{
   if(disposed||images.get(id)!==entry)return;
   const w=image.naturalWidth??image.width,h=image.naturalHeight??image.height;
   if(!(w>0&&h>0&&w<=REGION_ART_LIMITS.imageWidth&&h<=REGION_ART_LIMITS.imageHeight)){failed();return;}
   entry.state='ready';entry.width=w;entry.height=h;
   if(activeScene?.region.id===id){clearComposition();onInvalidate();}
  };
  const failed=()=>{
   if(disposed||images.get(id)!==entry)return;
   entry.state='failed';entry.width=entry.height=0;stats.failures++;
   releaseImage(entry.image);entry.image=null;
   if(activeScene?.region.id===id){clearComposition();onInvalidate();}
  };
  image.onload=loaded;image.onerror=failed;image.src=scene.region.url;
  return entry;
 }
 function fallback(c,w,h,scene) {
  c.fillStyle=gradient(c,0,0,0,h,scene.region.sky,scene.region.mist);c.fillRect(0,0,w,h);
 }
 function compose(c,w,h,scene,entry) {
  c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  fallback(c,w,h,scene);
  if(entry.state==='ready'&&entry.image){
   // Cover preserves the painting's proportions. This is a distant screen-space
   // plate, deliberately independent of world-space collision and camera pan.
   const scale=Math.max(w/entry.width,h/entry.height),dw=entry.width*scale,dh=entry.height*scale;
   const portraitAmount=clamp((h/w-1)*2,0,1),focus=.5+(scene.region.portraitFocus-.5)*portraitAmount;
   c.drawImage(entry.image,(w-dw)*focus,(h-dh)/2-h*.13*portraitAmount,dw,dh);
   if(portraitAmount>0){
    // Bring each biome's distinctive distant silhouette into a tall viewport.
    // The painting is never stretched; lower haze hides the crop's bottom edge.
    c.fillStyle=gradient(c,0,h*.65,0,h*.86,`${scene.region.mist}00`,scene.region.mist);c.fillRect(0,h*.65,w,h*.35);
   }
  }
  const light=scene.lighting;
  c.globalAlpha=light.alpha;c.fillStyle=light.wash;c.fillRect(0,0,w,h);
  c.globalAlpha=light.topAlpha;c.fillStyle=gradient(c,0,0,0,h*.68,light.top,`${light.top}00`);c.fillRect(0,0,w,h*.68);
  const horizon=c.createLinearGradient(0,0,0,h);horizon.addColorStop(0,`${light.horizon}00`);horizon.addColorStop(.24,`${light.horizon}00`);horizon.addColorStop(.54,light.horizon);horizon.addColorStop(.84,`${light.horizon}00`);horizon.addColorStop(1,`${light.horizon}00`);
  c.globalAlpha=light.horizonAlpha;c.fillStyle=horizon;c.fillRect(0,0,w,h);
  // Low-frequency veil keeps battlefield silhouettes distinct from the detailed
  // painting. It never covers actors, terrain, projectiles, badges or targets.
  c.globalAlpha=highContrast ? .24 : .07;c.fillStyle='#243848';c.fillRect(0,0,w,h);
  c.globalAlpha=1;c.restore();
 }
 function setScene(data) {
  const scene=campaignScene(data);if(activeScene!==scene){activeScene=scene;clearComposition();terrainScene=null;}
  return scene;
 }
 function drawBackdrop(c,width,height,data,{pixelRatio=1,contrast=false}={}) {
  if(disposed||!c)return false;
  const size=sceneBackingSize(width,height,pixelRatio);if(!size)return false;
  const scene=setScene(data),entry=ensureImage(scene);
  if(highContrast!==!!contrast){highContrast=!!contrast;clearComposition();}
  const key=`${scene.key}/${size.width}/${size.height}/${entry.state}/${highContrast}`;
  if(!composition)composition=createCanvas();
  if(composition){
   if(compositionKey!==key){
    if(composition.width!==size.width)composition.width=size.width;
    if(composition.height!==size.height)composition.height=size.height;
    const cc=composition.getContext('2d');
    if(cc){compose(cc,size.width,size.height,scene,entry);compositionKey=key;stats.compositions++;}
   }
   if(compositionKey===key){c.drawImage(composition,0,0,width,height);return true;}
  }
  // Canvas allocation/context failure remains playable and does not retry a
  // high-cost decoded composition every frame.
  c.save();fallback(c,width,height,scene);c.restore();return false;
 }
 function drawTerrain(c,terrainView,data,{contrast=false}={}) {
  if(disposed||!c||!terrainView?.surface?.length||!terrainView?.polygon?.length)return;
  const scene=setScene(data),ground=terrainView.surface,polygon=terrainView.polygon;
  // CanvasGradient captures the creation transform. Camera/DPR changes must
  // rebuild it, while ordinary game frames reuse it. getTransform returns only
  // one tiny native matrix; no per-frame meshes, paths, or palettes are allocated.
  const t=c.getTransform?.();
  const changed=t&&(t.a!==terrainA||t.b!==terrainB||t.c!==terrainC||t.d!==terrainD||t.e!==terrainE||t.f!==terrainF);
  if(terrainContext!==c||terrainScene!==scene||changed){
   terrainContext=c;terrainScene=scene;terrainInk=c.createLinearGradient(0,400,0,1200);
   terrainInk.addColorStop(0,scene.ground[0]);terrainInk.addColorStop(.45,scene.ground[1]);terrainInk.addColorStop(1,scene.ground[2]);
   if(t){terrainA=t.a;terrainB=t.b;terrainC=t.c;terrainD=t.d;terrainE=t.e;terrainF=t.f;}
  }
  c.save();c.beginPath();c.moveTo(polygon[0][0],polygon[0][1]);for(let i=1;i<polygon.length;i++)c.lineTo(polygon[i][0],polygon[i][1]);c.closePath();
  c.fillStyle=terrainInk;c.fill();c.clip();
  if(!contrast){
   // All material marks sit BELOW the exact collision surface. No decorative
   // boulder, grass, hill or tree can be mistaken for physical cover.
   c.strokeStyle=scene.region.strata;c.lineWidth=scene.scenery==='wasteland'?3:2;c.beginPath();
   for(let layer=0;layer<3;layer++)for(let i=0;i<ground.length;i++){
    const x=ground[i][0],y=ground[i][1]+21+layer*31+(i%7)*1.3;
    if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
   }
   c.stroke();c.strokeStyle=scene.region.fleck;c.lineWidth=1.5;c.beginPath();
   for(let i=1;i<ground.length-1;i+=2){
    const x=ground[i][0]+(i*7%11),y=ground[i][1]+8+(i*5%13);
    c.moveTo(x,y);c.lineTo(x+(scene.scenery==='wasteland'?9:4),y+(scene.scenery==='pines'?3:1));
   }
   c.stroke();
  }
  c.restore();c.save();c.beginPath();c.moveTo(ground[0][0],ground[0][1]);for(let i=1;i<ground.length;i++)c.lineTo(ground[i][0],ground[i][1]);
  c.strokeStyle=contrast?'#e4dcb5':scene.rim;c.lineWidth=contrast?4:3;c.stroke();c.restore();
 }
 function dispose() {
  disposed=true;for(const entry of images.values())releaseImage(entry.image);images.clear();
  if(composition){composition.width=composition.height=1;composition=null;}
  activeScene=null;terrainContext=null;terrainScene=null;terrainInk=null;compositionKey='';
 }
 function diagnostics(){return {...stats,disposed,scene:activeScene?.key??null,imageEntries:images.size,
  decodedBytes:[...images.values()].reduce((sum,e)=>sum+e.width*e.height*4,0),
  canvasBytes:composition?composition.width*composition.height*4:0};}
 return {drawBackdrop,drawTerrain,setScene,dispose,diagnostics};
}
