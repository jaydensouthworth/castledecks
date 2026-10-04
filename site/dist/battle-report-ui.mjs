import {formatBattleReport} from './battle-report.mjs';
import {createBattleRenderProfilerUI} from './battle-render-profiler-ui.mjs';
/** User-initiated presentation/clipboard/download only. The supplied recorder
 * owns a bounded local history. This adapter never reads editable user text. */
export function createBattleReportUI({document,window,getState,onClose}){
 const $=id=>document.querySelector(id);
 let currentText='',generation=0;
 const renderProfileUI=createBattleRenderProfilerUI({document,getState,now:()=>performance.now(),onChange:()=>{render();status('Rendering sample updated. Nothing is sent automatically.');}});
 const status=text=>$('#battleReportStatus').textContent=text;
 function render(){const {battle,recorder,context}=getState();currentText=formatBattleReport(recorder.snapshot(battle,context))+'\n\n'+renderProfileUI.render();$('#battleReportText').value=currentText;$('#battleReportRecording').checked=recorder.enabled;}
 function open(){generation++;render();status('Snapshot ready. Nothing is sent automatically.');}
 function close(){generation++;onClose();}
 $('#closeBattleReport').onclick=close;
 $('#battleReportRefresh').onclick=()=>{render();status('Snapshot refreshed.');};
 $('#battleReportRecording').onchange=()=>{const {recorder}=getState();recorder.setEnabled($('#battleReportRecording').checked);render();status(recorder.enabled?'Recording normalized battle events in memory. Resume play to collect them.':'Recording off. History cleared.');};
 $('#battleReportClear').onclick=()=>{getState().recorder.clear();render();status('History cleared.');};
 $('#battleReportCopy').onclick=async()=>{
  const request=++generation;
  try{if(typeof window.navigator?.clipboard?.writeText!=='function')throw new Error('unavailable');await window.navigator.clipboard.writeText(currentText);if(request===generation)status('Report copied. Share it only when you choose.');}
  catch{if(request===generation){status('Copy was unavailable. Select the report text to copy it, or download the text file.');$('#battleReportText').focus?.();$('#battleReportText').select?.();}}
 };
 $('#battleReportDownload').onclick=()=>{
  let url,link;
  try{
   if(typeof window.URL?.createObjectURL!=='function')throw new Error('unavailable');
   url=window.URL.createObjectURL(new Blob([currentText],{type:'text/plain;charset=utf-8'}));
   link=document.createElement('a');link.href=url;link.download='castledecks-battle-diagnostics.txt';document.body.appendChild(link);link.click();
   status('Text-file download requested. This report cannot restore a game.');
  }catch{status('Download was unavailable. Use Copy report or select the report text.');}
  finally{link?.remove?.();if(url)window.setTimeout(()=>window.URL.revokeObjectURL(url),0);}
 };
 return {open,close};
}
