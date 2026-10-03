import {getCardInsights} from './armory-insights.mjs';
// Search descriptor prose, not inferred synonyms or rank-dependent metric values.
// Indexed once per model construction; the shared cache is bounded to live IDs.
const descriptors=new Map();
export function cardRuleSearchText(record){
 const id=record?.id;if(descriptors.has(id))return descriptors.get(id);
 const insights=getCardInsights(record),known=insights.metrics.length>0;
 const text=known?[...insights.metrics.flatMap(metric=>[metric.label,metric.scope]),...insights.notes,...insights.tactics].join(' '):'';
 if(known)descriptors.set(id,text);return text;
}
