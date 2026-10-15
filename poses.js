// POSE DATA (original stick-figure silhouettes inspired by yoga poses). Add new poses here only.
// Angles in degrees: 0 = down, 90 = toward screen-right, -90 = toward screen-left, 180 = up.
// a = arms {l,r}: [upper arm, forearm]   lg = legs {l,r}: [thigh, shin]
// lean = torso tilt (0 upright, 90 = head to the right, 180 = upside down)   at = [x,y] hip position on the 0-1 canvas
// prof = side-on view   d = difficulty   safe = allowed in Safe Mode   seated = doable sitting down
const POSES = [
  // EASY
  { id: 'sky',      d: 'easy', safe: true, seated: true, a: { r: [180, 180], l: [-180, -180] } },
  { id: 'tpose',    d: 'easy', safe: true, seated: true, a: { r: [90, 90], l: [-90, -90] } },
  { id: 'cactus',   d: 'easy', safe: true, seated: true, a: { r: [90, 180], l: [-90, -180] } },
  { id: 'prayer',   d: 'easy', safe: true, seated: true, a: { r: [15, -118], l: [-15, 118] } },
  { id: 'lotus',    d: 'easy', safe: true, seated: true, at: [.5, .7], a: { r: [30, 28], l: [-30, -28] }, lg: { r: [80, -100], l: [-80, 100] } },
  { id: 'seatedSide', d: 'easy', safe: true, seated: true, at: [.5, .72], lean: 20, a: { r: [140, 140], l: [160, 160] }, lg: { r: [80, -100], l: [-80, 100] } },
  { id: 'catcow',   d: 'easy', safe: true, seated: false, prof: true, at: [.62, .6], lean: -65, a: { r: [0, 0], l: [0, 0] }, lg: { r: [0, 90], l: [0, 90] } },
  // MEDIUM
  { id: 'sidebend', d: 'medium', safe: true, seated: true, lean: 28, a: { r: [145, 145], l: [-40, 46] } },
  { id: 'tree',     d: 'medium', safe: false, seated: false, a: { r: [165, 200], l: [-165, -200] }, lg: { r: [50, -105], l: [0, 0] } },
  { id: 'treeArms', d: 'medium', safe: false, seated: false, a: { r: [90, 120], l: [-90, -120] }, lg: { r: [50, -105], l: [0, 0] } },
  { id: 'crescent', d: 'medium', safe: true, seated: false, prof: true, at: [.55, .6], lean: 10, a: { r: [155, 160], l: [-20, -10] }, lg: { r: [80, 0], l: [-60, -80] } },
  { id: 'seatedFold', d: 'medium', safe: true, seated: false, at: [.4, .72], lean: 65, a: { r: [90, 95], l: [120, 100] }, lg: { r: [90, 90], l: [-70, 20] } },
  { id: 'boat',     d: 'medium', safe: true, seated: false, prof: true, at: [.45, .72], lean: -30, a: { r: [90, 90], l: [90, 90] }, lg: { r: [135, 135], l: [135, 135] } },
  { id: 'warrior',  d: 'medium', safe: true, seated: false, a: { r: [90, 90], l: [-90, -90] }, lg: { r: [50, 0], l: [-30, -30] } },
  // HARD
  { id: 'dancer',   d: 'hard', safe: false, seated: false, prof: true, a: { r: [-125, -30], l: [-110, -25] }, lg: { l: [0, 0], r: [-100, 180] } },
  { id: 'dancer2',  d: 'hard', safe: false, seated: false, prof: true, lean: -15, a: { r: [100, 100], l: [-90, -90] }, lg: { l: [0, 0], r: [120, 170] } },
  { id: 'splits',   d: 'hard', safe: false, seated: false, at: [.5, .78], lean: -15, a: { r: [150, 160], l: [-45, -60] }, lg: { l: [-90, -90], r: [90, 90] } },
  { id: 'sidePlank', d: 'hard', safe: false, seated: false, prof: true, at: [.6, .52], lean: -53, a: { r: [0, 0], l: [180, 180] }, lg: { l: [53, 53], r: [53, 53] } },
