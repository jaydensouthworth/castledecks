/** The Crownroad's geographic route is presentation data, never progression data. */
export const MAP_REGION_WIDTH=300;
export const MAP_HEIGHT=360;
const regionPoints=[
 [[45,276],[132,246],[224,286],[248,207],[158,165],[246,94]],
 [[45,95],[129,118],[220,91],[248,174],[160,199],[65,178],[50,266],[141,290],[244,276]],
 [[46,278],[129,245],[214,288],[251,209],[178,172],[81,188],[65,100],[231,103]],
 [[49,101],[146,77],[248,110],[224,189],[125,178],[89,265],[239,278]],
];
export const CAMPAIGN_MAP_POINTS=Object.freeze(regionPoints.flatMap((points,index)=>points.map(([x,y])=>Object.freeze({x:x+index*MAP_REGION_WIDTH,y,regionIndex:index}))));
export function campaignRoadPath(points=CAMPAIGN_MAP_POINTS){return points.map(({x,y},index)=>`${index?'L':'M'}${x} ${y}`).join(' ');}
export function mapRegionScrollLeft(regionIndex,viewportWidth){return Math.max(0,Math.min(1200-viewportWidth,regionIndex*MAP_REGION_WIDTH+(MAP_REGION_WIDTH-viewportWidth)/2));}

/** Prefer the region view, but keep the selected 48px standard visible in narrow workspaces. */
export function mapSelectionScrollLeft(regionIndex,viewportWidth,level){
 const point=CAMPAIGN_MAP_POINTS[level-1];if(!point)return mapRegionScrollLeft(regionIndex,viewportWidth);
 let left=mapRegionScrollLeft(regionIndex,viewportWidth);
 if(point.x-32<left)left=point.x-32;
 if(point.x+32>left+viewportWidth)left=point.x+32-viewportWidth;
 return Math.max(0,Math.min(1200-viewportWidth,left));
}
