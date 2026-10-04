/** Test-only legacy fixtures. Deliberately emit the frozen pre-castle schemas;
 * production never downgrades a document or strips supported ownership. */
import {restoreProfiles} from '../fixtures/frozen69-codecs/engine/profile-manager.mjs';
export function legacyProfileBundle(manager){
 const value=JSON.parse(manager.exportBundle());value.schema='bowmaster-reconstruction-profiles-1';
 for(const record of [...value.profiles,...value.retired]){record.profile.schema='bowmaster-reconstruction-2';delete record.profile.castles;delete record.profile.appearance;}
 const text=JSON.stringify(value);restoreProfiles(text);return text;
}
export function legacyDeck(deck){const {castle,...value}=deck;return value;}
