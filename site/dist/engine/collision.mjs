/** Numeric collision-region calibration only; no art is included.
 * Authored bounds were measured privately. Flash twip-edge rounding remains
 * unverified. The independent world transform takes an axis-aligned envelope.
 */
export const COLLISION_REGIONS={
  "enemyGrunt": {
    "hitbox": [
      -10.2,
      7.233830059133,
      -43.05,
      9.976245117188
    ],
    "headbox": [
      -10.45,
      7.555807512673,
      -43.3,
      -28.617687988281
    ]
  },
  "enemyTallGrunt": {
    "hitbox": [
      -9.3,
      12.112571449298,
      -61.4,
      4.880151367188
    ],
    "headbox": [
      -9.3,
      12.121650456497,
      -61.95,
      -43.13115234375
    ]
  },
  "enemyTrebuchet": {
    "hitbox": [
      -42.5,
      42.589523587842,
      -20.9,
      13.880883789063
    ],
    "headbox": [
      -20.0,
      17.942773262504,
      -20.9,
      -1.490850830078
    ]
  },
  "enemyArcher": {
    "hitbox": [
      -10.15,
      6.412245368026,
      -39.6,
      7.414373779297
    ],
    "headbox": [
      -10.55,
      7.034968826035,
      -39.75,
      -26.119964599609
    ]
  },
  "enemyPriest": {
    "hitbox": [
      -7.55,
      7.212999764876,
      -36.3,
      6.522967529297
    ],
    "headbox": [
      -7.3,
      7.19864043761,
      -36.15,
      -24.073156738281
    ]
  },
  "enemyMount": {
    "hitbox": [
      -8.8,
      8.071999731287,
      -55.65,
      -8.789617919922
    ],
    "headbox": [
      -8.65,
      7.860441621067,
      -55.5,
      -41.266387939453
    ]
  },
  "friendlyGrunt": {
    "hitbox": [
      -11.0,
      7.900356751401,
      -44.0,
      5.27734375
    ],
    "headbox": [
      -10.6,
      7.713425638946,
      -44.0,
      -28.137969970703
    ]
  },
  "friendlyTallGrunt": {
    "hitbox": [
      -11.0,
      10.412571449298,
      -58.9,
      4.983544921875
    ],
    "headbox": [
      -10.65,
      10.076305316901,
      -59.15,
      -39.740850830078
    ]
  },
  "friendlyTrebuchet": {
    "hitbox": [
      -42.1,
      42.989523587842,
      -21.25,
      13.530883789062
    ],
    "headbox": [
      -19.6,
      18.342773262504,
      -21.25,
      -1.840850830078
    ]
  },
  "friendlyArcher": {
    "hitbox": [
      -8.55,
      8.012245368026,
      -40.8,
      3.6345703125
    ],
    "headbox": [
      -8.25,
      7.791537602199,
      -40.8,
      -27.350506591797
    ]
  },
  "friendlyPriest": {
    "hitbox": [
      -7.9,
      6.862999764876,
      -36.85,
      2.924108886719
    ],
    "headbox": [
      -7.65,
      6.84864043761,
      -37.1,
      -22.736291503906
    ]
  },
  "friendlyMount": {
    "hitbox": [
      -7.4,
      11.473119729804,
      -58.0,
      -11.139617919922
    ],
    "headbox": [
      -7.8,
      11.763658336177,
      -58.5,
      -43.562805175781
    ]
  },
  "enemyCastle": {
    "hitbox": [
      -57.95,
      60.068548639491,
      -211.65,
      -26.749334716797
    ]
  },
  "friendlyCastle": {
    "hitbox": [
      -34.5,
      30.897691032384,
      -218.7,
      -35.669360351562
    ]
  },
  "hero": {
    "hitbox": [
      -20.35,
      18.608019891055,
      -55.75,
      7.748565673828
    ]
  }
};
// Highwatch extends the historical side-specific stone rectangle only upward.
// Keep the different original widths, lower edges, flag pads and ground aprons.
for (const [base, highwatch] of [
  ['friendlyCastle', 'friendlyHighwatchCastle'],
  ['enemyCastle', 'enemyHighwatchCastle'],
]) {
  const [left, right, top, bottom] = COLLISION_REGIONS[base].hitbox;
  COLLISION_REGIONS[highwatch] = {hitbox: [left, right, top - 50, bottom]};
}

export function worldBounds(local,{x,y,scaleX=1,scaleY=1,rotation=0}) {
 const radians=rotation*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
 const points=[];for(const px of [local[0],local[1]])for(const py of [local[2],local[3]])points.push({x:x+px*scaleX*c-py*scaleY*s,y:y+px*scaleX*s+py*scaleY*c});
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),top=Math.min(...ys);
 return {x:left,y:top,width:Math.max(...xs)-left,height:Math.max(...ys)-top};
}
export function unitRegions(kind,transform) {const regions=COLLISION_REGIONS[kind];if(!regions)throw new RangeError('Unknown collision geometry');return Object.fromEntries(Object.entries(regions).map(([name,box])=>[name,worldBounds(box,transform)]));}

Object.assign(COLLISION_REGIONS, {
  "tower": {
    "hitbox": [
      -29.25,
      28.268180902116,
      -127.65,
      64.737847900391
    ]
  },
  "enemyAir": {
    "hitbox": [
      -28.65,
      27.819288541004,
      -20.05,
      19.856860351562
    ],
    "headbox": [
      -28.5,
      -9.24502790859,
      -8.05,
      14.722186279297
    ]
  },
  "friendlyAir": {
    "hitbox": [
      -30.5,
      29.556564503117,
      -21.2,
      21.184002685547
    ]
  },
  "enemyPoisonDragon": {
    "hitbox": [
      -28.65,
      27.819288541004,
      -20.05,
      19.856860351562
    ],
    "headbox": [
      -28.5,
      -9.24502790859,
      -8.05,
      14.722186279297
    ]
  },
  "enemyFireDragon": {
    "hitbox": [
      -28.65,
      27.819288541004,
      -20.05,
      19.856860351562
    ],
    "headbox": [
      -28.5,
      -9.24502790859,
      -8.05,
      14.722186279297
    ]
  },
  "enemyIceDragon": {
    "hitbox": [
      -28.65,
      27.819288541004,
      -20.05,
      19.856860351562
    ],
    "headbox": [
      -28.5,
      -9.24502790859,
      -8.05,
      14.722186279297
    ]
  },
  "enemyIceDemon": {
    "hitbox": [
      -13.4,
      12.992139868345,
      -71.05,
      11.358569335938
    ],
    "headbox": [
      -13.25,
      12.79927383177,
      -71.05,
      -50.810711669922
    ]
  },
  "enemyFireDemon": {
    "hitbox": [
      -13.4,
      12.992139868345,
      -71.05,
      11.358569335938
    ],
    "headbox": [
      -13.25,
      12.79927383177,
      -71.05,
      -50.810711669922
    ]
  },
  "enemyGorath": {
    "hitbox": [
      -64.6,
      65.98282648446,
      -223.65,
      14.959252929687
    ],
    "headbox": [
      -40.45,
      41.125413742568,
      -199.2,
      -134.400469970703
    ]
  }
});
