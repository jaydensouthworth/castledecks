/** Read-only campaign directory. Only authored, implemented content is registered.
 * Pagination is independent of the live campaign's thirty-field engine limit.
 * Large directories belong in tests until their content and game rules exist. */
import {CAMPAIGN_REGIONS,encounterBrief,campaignProgress} from './campaign-atlas-model.mjs';
import {EXPEDITION_FIELDS,EXPEDITION_LENGTH} from './expedition-data.mjs';
export const HALL_BROWSER_PAGE_SIZE=8;
export function hallCampaignCatalog({profile=null,run=null}={}){
 const progress=profile?campaignProgress(profile):null;
 return [
  {id:'campaign',name:'The Crownroad',assisted:!!progress?.assisted,groupLabel:'Regions',stageLabel:'Battle',description:'Thirty authored fields across four regions.',
   regions:CAMPAIGN_REGIONS.map(region=>({...region,stages:Array.from({length:region.last-region.first+1},(_,i)=>{
    const level=region.first+i,brief=encounterBrief(level,{profile});
    return {id:String(level),number:level,name:brief.name,regionId:region.id,regionName:region.name,state:progress?brief.status:'unopened',objective:brief.objective,advice:brief.advice};
   })}))},
  {id:'expedition',name:'Wayfarer Charter',groupLabel:'Legs',stageLabel:'Leg',description:'Four legs through six authored fields. Each run follows one branch at a time.',
   regions:Array.from({length:EXPEDITION_LENGTH},(_,index)=>{
    const leg=index+1,id=`leg-${leg}`;
    return {id,name:`Leg ${leg}`,description:leg===1?'Establish your foothold':leg===4?'Finish at Storm Crown':'Choose a road after the preceding victory',art:leg===1?'hearthwood':leg===2?'bannerfen':leg===3?'frostpine':'cinderlands',
     stages:Object.values(EXPEDITION_FIELDS).filter(field=>field.leg===leg).map(field=>{
      const chosen=run?.state.path.includes(field.id),cleared=chosen&&field.leg<=run.state.cleared;
      const available=run?.choices.some(choice=>choice.id===field.id);
      const state=!run?'unopened':cleared?'cleared':field.id===run.current.id?'current':available?'available':!chosen&&leg<=run.state.path.length?'bypassed':'unreached';
      return {id:field.id,number:field.leg,name:field.name,regionId:id,regionName:`Leg ${leg}`,state,objective:field.objectiveText,advice:field.tradeoff};
     })};
   })},
 ];
}
const positivePage=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const normalize=value=>String(value??'').trim().toLocaleLowerCase();
export function campaignBrowserPage(catalog,{campaignId='campaign',regionId=null,query='',page=0,regionPage=0,stageId=null}={}){
 const campaign=catalog.find(item=>item.id===campaignId)??catalog[0];
 if(!campaign)return null;
 const regions=campaign.regions??[],region=regions.find(item=>item.id===regionId)??regions[0]??null;
 const search=normalize(query),allStages=regions.flatMap(item=>item.stages??[]);
 const filtered=search?allStages.filter(stage=>normalize(`${stage.number} ${campaign.stageLabel} ${stage.name} ${stage.regionName}`).includes(search)):(region?.stages??[]);
 const pageCount=Math.max(1,Math.ceil(filtered.length/HALL_BROWSER_PAGE_SIZE)),safePage=Math.min(positivePage(page),pageCount-1);
 const regionPageCount=Math.max(1,Math.ceil(regions.length/HALL_BROWSER_PAGE_SIZE));
 const safeRegionPage=Math.min(positivePage(regionPage),regionPageCount-1);
 const stages=filtered.slice(safePage*HALL_BROWSER_PAGE_SIZE,(safePage+1)*HALL_BROWSER_PAGE_SIZE);
 const selected=allStages.find(stage=>stage.id===stageId)??stages[0]??null;
 return {campaign,region,regions:regions.slice(safeRegionPage*HALL_BROWSER_PAGE_SIZE,(safeRegionPage+1)*HALL_BROWSER_PAGE_SIZE),regionCount:regions.length,regionPage:safeRegionPage,regionPageCount,stages,total:allStages.length,matched:filtered.length,page:safePage,pageCount,start:filtered.length?safePage*HALL_BROWSER_PAGE_SIZE+1:0,end:Math.min(filtered.length,(safePage+1)*HALL_BROWSER_PAGE_SIZE),selected,query:String(query??'')};
}
export const hallStageStatus=(state,assisted=false)=>assisted&&state==='cleared'?'Reached · assisted':assisted&&state==='frontier'?'Assisted frontier':({cleared:'Cleared',frontier:'Earned frontier',locked:'Locked',unopened:'Not opened',current:'Current field',available:'Road available',bypassed:'Other branch',unreached:'Ahead'})[state]??'Inspect';
