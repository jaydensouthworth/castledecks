/** New-game recruitment and companion design, not recovered original balance.
 * Every campaign fighter variant is represented. Castles/towers are structures.
 */
export const REGULAR_RECRUIT_IDS=Object.freeze(['grunt','tallGrunt','archer','priest','mount','trebuchet','air','poisonDragon','fireDragon','iceDragon','fireDemon','iceDemon']);
export const RECRUIT_SKILLS=Object.freeze({
 air:{name:'Air Fighter',price:2500,cooldown:990,summon:{cost:40,amount:2,population:2},description:'Two aerial archers patrol above the field. Costs 40 gold and 4 reserve per squad.'},
 poisonDragon:{name:'Poison Dragon',price:4000,cooldown:1320,summon:{cost:65,amount:1,population:3},description:'One airborne dragon applies stacking poison to enemies. Costs 65 gold and 3 reserve.'},
 fireDragon:{name:'Fire Dragon',price:4000,cooldown:1320,summon:{cost:65,amount:1,population:3},description:'One airborne dragon strikes with fire and a lingering enemy-only burn. Costs 65 gold and 3 reserve.'},
 iceDragon:{name:'Ice Dragon',price:4000,cooldown:1320,summon:{cost:65,amount:1,population:3},description:'One airborne dragon slows enemies with frost. Costs 65 gold and 3 reserve.'},
 fireDemon:{name:'Fire Demon',price:5000,cooldown:1980,summon:{cost:90,amount:1,population:4},description:'One durable fire-resistant frontline fighter can recover and capture flags. Costs 90 gold and 4 reserve.'},
 iceDemon:{name:'Ice Demon',price:5000,cooldown:1980,summon:{cost:90,amount:1,population:4},description:'One durable ice-resistant frontline fighter can recover and capture flags. Costs 90 gold and 4 reserve.'}
});
export const COMPANIONS=Object.freeze({
 gorath:Object.freeze({id:'gorath',name:'Gorath',title:'The Earthshaker',price:7500,summonCost:150,recoveryTicks:60*33,defeatRecoveryTicks:90*33,signatureName:'Earthshatter',signatureCooldownTicks:15*33,description:'A persistent co-hero with armored defenses and close-range stomps. Command Earthshatter to send a stunning shockwave toward enemies. Stays until recalled, defeated, or the battle ends. Uses a separate companion slot and no reserve.'})
});
export const FRIENDLY_RECRUIT_GEOMETRY=Object.freeze({poisonDragon:'enemyPoisonDragon',fireDragon:'enemyFireDragon',iceDragon:'enemyIceDragon',fireDemon:'enemyFireDemon',iceDemon:'enemyIceDemon',gorath:'enemyGorath'});
