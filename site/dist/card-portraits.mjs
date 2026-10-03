/** Original, decorative card portraits. These never define game data or rarity.
 * Three shared 960×720 WebP atlases: 636 KiB encoded / 7.91 MiB decoded total.
 * No preloading, canvas, animation, external requests, or per-card raster assets.
 * Native lazy images exist only for cards already mounted by paginated views.
 */
const SOURCE_WIDTH=1448,SOURCE_HEIGHT=1086;
const sheets=Object.freeze({
 martial:{file:'card-martial-v1.webp',x:[0,482,965,1448],y:[0,362,724,1086],ids:['grunt','archer','tallGrunt','mount','trebuchet','priest','air','gorath','arrow']},
 arcane:{file:'card-arcane-v1.webp',x:[0,483,965,1448],y:[0,355,701,1086],ids:['fireArrow','iceArrow','pierceArrow','bombArrow','flakArrow','thunderArrow','meteorArrow','cometArrow','healWave']},
 beasts:{file:'card-beasts-v1.webp',x:[0,482,965,1448],y:[0,361,724,1086],ids:['poisonDragon','fireDragon','iceDragon','fireDemon','iceDemon','bombWave','fireWave','iceWave']}
});
const focusY={grunt:0,archer:15,tallGrunt:0,mount:15,trebuchet:25,priest:15,air:35,gorath:0,fireDemon:10,iceDemon:10};
const manifest=Object.freeze(Object.fromEntries(Object.entries(sheets).flatMap(([sheet,atlas])=>atlas.ids.map((id,index)=>{
 const col=index%3,row=Math.floor(index/3),x=atlas.x[col]+2,y=atlas.y[row]+2,w=atlas.x[col+1]-x-2,h=atlas.y[row+1]-y-2;
 return [id,Object.freeze({sheet,index,file:atlas.file,x,y,w,h,focusY:focusY[id]??50})];
}))));
export const CARD_PORTRAITS=manifest;
export const CARD_PORTRAIT_BUDGET=Object.freeze({atlasCount:3,width:960,height:720,encodedBytes:651018,decodedBytes:960*720*4*3});
const pct=value=>Number(value.toFixed(5));
export function preferCardIcons(environment=globalThis){
 return !!(environment.navigator?.connection?.saveData||environment.matchMedia?.('(prefers-reduced-data: reduce)').matches||environment.matchMedia?.('(forced-colors: active)').matches);
}
/** fallbackIcon is the existing trusted code-native SVG, never record text. */
export function cardPortrait(id,fallbackIcon='',{environment=globalThis}={}){
 const art=Object.hasOwn(manifest,id)?manifest[id]:null,fallback=`<span class="card-portrait-fallback card-medallion skill-icon">${fallbackIcon}</span>`;
 if(!art||preferCardIcons(environment))return `<span class="card-portrait card-portrait--icon" aria-hidden="true">${fallback}</span>`;
 const src=new URL('./images/cards/'+art.file,import.meta.url).href;
 const crop=`width:${pct(SOURCE_WIDTH/art.w*100)}%;height:${pct(SOURCE_HEIGHT/art.h*100)}%;left:${pct(-art.x/art.w*100)}%;top:${pct(-art.y/art.h*100)}%`;
 return `<span class="card-portrait" data-card-portrait="${id}" style="--portrait-focus-y:${art.focusY}%" aria-hidden="true">${fallback}<span class="card-portrait-window" style="aspect-ratio:${art.w}/${art.h}"><img class="card-portrait-image" data-card-atlas="${art.sheet}" src="${src}" alt="" width="960" height="720" loading="lazy" decoding="async" fetchpriority="low" draggable="false" style="${crop}"></span></span>`;
}
/** Capture handlers work for subsequently inserted and cache-hit images. The
 * fallback remains painted until successful load, and survives a failed fetch.
 */
const bindings=new WeakMap();
export function bindCardPortraits(root){
 if(bindings.has(root))return ()=>{};
 const settle=event=>{const img=event.target;if(img?.getAttribute?.('data-card-atlas')==null)return;const frame=img.parentElement?.parentElement;if(!frame?.classList?.contains('card-portrait'))return;frame.setAttribute('data-art-state',event.type==='load'&&img.naturalWidth>0?'ready':'failed');};
 root.addEventListener('load',settle,true);root.addEventListener('error',settle,true);
 const dispose=()=>{root.removeEventListener('load',settle,true);root.removeEventListener('error',settle,true);bindings.delete(root);};bindings.set(root,dispose);return dispose;
}
