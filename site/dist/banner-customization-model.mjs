/** Existing profile identity only. Drafts never mutate profiles or save formats. */
import {validatePlayerPaletteId} from './player-palette.mjs';
export const BANNER_NAME_LIMIT=32;
export function bannerIdentity(profile){return {name:profile.name,paletteId:validatePlayerPaletteId(profile.paletteId)};}
export function validateBannerDraft(draft,original){
 if(!draft||typeof draft.name!=='string')throw new TypeError('Enter a banner name.');
 // A historical/imported name is preserved byte-for-byte when only colors change.
 // New names are bounded at this UI boundary, without changing the save codec.
 const name=draft.name===original.name?original.name:draft.name.trim();
 if(draft.name!==original.name&&(!name||name.length>BANNER_NAME_LIMIT||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufffe\uffff]/u.test(name)||[...name].some(char=>char.codePointAt(0)>=0xd800&&char.codePointAt(0)<=0xdfff)))throw new TypeError(`Use 1–${BANNER_NAME_LIMIT} characters without line breaks or control characters.`);
 return {name,paletteId:validatePlayerPaletteId(draft.paletteId)};
}
export function applyBannerIdentity(profile,draft,original){
 const next=validateBannerDraft(draft,original);
 if(profile.name!==original.name||profile.paletteId!==original.paletteId)return {ok:false,message:'Your banner changed while this preview was open. Reopen customization to try again.'};
 for(const key of ['name','paletteId']){const field=Object.getOwnPropertyDescriptor(profile,key);if(!field||!Object.hasOwn(field,'value')||!field.writable)return {ok:false,message:'This banner cannot be edited here.'};}
 const changed=next.name!==profile.name||next.paletteId!==profile.paletteId;
 if(changed)Object.defineProperties(profile,{name:{value:next.name},paletteId:{value:next.paletteId}});
 return {ok:true,changed,...next};
}
