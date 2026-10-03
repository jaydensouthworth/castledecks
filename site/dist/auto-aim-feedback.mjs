/** Read-only feedback for the same bounded Auto aim solver used at launch.
 * This does not retarget shots, change power, or replace the source controller.
 */
import {assistedAutoAim as autoAim} from './engine/assisted-auto-aim.mjs';

export function autoAimFeedback(origin,pointer,{powerPercent=100,angleMode=1,gravity=.3}={}){
 if(![origin?.x,origin?.y,pointer?.x,pointer?.y,powerPercent,gravity].every(Number.isFinite)||powerPercent<=0||gravity<=0)return {state:'invalid',hint:'Choose another aim point',message:'Cannot calculate this aim point. Choose another point.'};
 const options={powerPercent,angleMode,gravity},aim=autoAim(origin,pointer,options);
 if(aim.canFire&&[aim.vx,aim.vy].every(Number.isFinite))return {state:aim.rangeAssisted?'assisted':'reachable',hint:aim.rangeAssisted?'Range assist · Lead moving targets':null,message:null,aim};
 if(['invalid','outside-assist-area','flight-ceiling'].includes(aim.reason))return {state:'invalid',hint:'Choose another aim point',message:'Cannot calculate this aim point. Choose another point.'};
 const fullPower=powerPercent<100?autoAim(origin,pointer,{...options,powerPercent:100}):null;
 if(fullPower?.canFire&&[fullPower.vx,fullPower.vy].every(Number.isFinite))return {state:'unreachable',hint:`Out of range at ${powerPercent}% · Increase power`,message:`Out of range at ${powerPercent}% power. Increase power in Settings → Configure precise aim.`};
 return {state:'unreachable',hint:'Beyond range assist · Move closer or wait for the target',message:'Out of range beyond the assist limit, even at 100% power. Move closer or wait for the target to come into range.'};
}
