// POSE DATA (original, copyright-free). Add new poses here; no other file needs to change.
// Angles are in degrees, measured from "straight down": 90 = toward screen-right, -90 = toward screen-left, 180 = straight up.
// a = arms {l,r}: [upper arm, forearm]   lg = legs {l,r}: [thigh, shin]   lean = torso tilt (+ = screen-right)
// d = difficulty (easy|medium|hard)  safe = allowed in Safe Mode  seated = can be done sitting
const POSES = [
  // EASY
  { id: 'star',    d: 'easy', safe: true, seated: false, a: { r: [135, 135], l: [-135, -135] }, lg: { r: [20, 20], l: [-20, -20] } },
  { id: 'tpose',   d: 'easy', safe: true, seated: true,  a: { r: [90, 90], l: [-90, -90] } },
  { id: 'sky',     d: 'easy', safe: true, seated: true,  a: { r: [180, 180], l: [-180, -180] } },
  { id: 'vee',     d: 'easy', safe: true, seated: true,  a: { r: [155, 155], l: [-155, -155] } },
  { id: 'cactus',  d: 'easy', safe: true, seated: true,  a: { r: [90, 180], l: [-90, -180] } },
  { id: 'prayer',  d: 'easy', safe: true, seated: true,  a: { r: [15, -118], l: [-15, 118] } },
  { id: 'hips',    d: 'easy', safe: true, seated: true,  a: { r: [40, -46], l: [-40, 46] } },
  { id: 'wide',    d: 'easy', safe: true, seated: false, a: { r: [25, 25], l: [-25, -25] }, lg: { r: [25, 25], l: [-25, -25] } },
  // MEDIUM
  { id: 'leanR',   d: 'medium', safe: true, seated: true, lean: 28,  a: { r: [145, 145], l: [-40, 46] } },
  { id: 'leanL',   d: 'medium', safe: true, seated: true, lean: -28, a: { l: [-145, -145], r: [40, -46] } },
  { id: 'goal',    d: 'medium', safe: true, seated: true, a: { r: [180, 180], l: [-90, -90] } },
  { id: 'diag',    d: 'medium', safe: true, seated: true, a: { r: [135, 135], l: [-45, -45] } },
  { id: 'diag2',   d: 'medium', safe: true, seated: true, a: { l: [-135, -135], r: [45, 45] } },
  { id: 'warrior', d: 'medium', safe: true, seated: false, a: { r: [90, 90], l: [-90, -90] }, lg: { r: [50, 0], l: [-30, -30] } },
  { id: 'lunge',   d: 'medium', safe: true, seated: false, a: { r: [180, 180], l: [-180, -180] }, lg: { r: [45, 0], l: [-45, 0] } },
  // HARD
  { id: 'tree',    d: 'hard', safe: false, seated: false, a: { r: [170, 170], l: [-170, -170] }, lg: { r: [50, -105], l: [0, 0] } },
  { id: 'sidekick',d: 'hard', safe: false, seated: false, a: { r: [90, 90], l: [-90, -90] }, lg: { r: [80, 80], l: [0, 0] } },
  { id: 'treeLean',d: 'hard', safe: false, seated: false, lean: 15, a: { r: [160, 160], l: [-160, -160] }, lg: { l: [-50, 105], r: [0, 0] } },
];
