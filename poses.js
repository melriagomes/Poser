const POSES_VERSION = 4;
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
  { id: 'warrior3', d: 'hard', safe: false, seated: false, prof: true, at: [.4, .45], lean: 90, a: { r: [90, 90], l: [90, 90] }, lg: { l: [0, 0], r: [-90, -90] } },
  { id: 'headstand', d: 'hard', safe: false, seated: false, at: [.5, .42], lean: 180, a: { r: [-25, 25], l: [25, -25] }, lg: { r: [180, 180], l: [180, 180] } },
  { id: 'crow',     d: 'hard', safe: false, seated: false, prof: true, at: [.45, .45], lean: 110, a: { r: [10, -10], l: [10, -10] }, lg: { r: [75, -110], l: [75, -110] } },
  { id: 'bow',      d: 'hard', safe: false, seated: false, prof: true, at: [.5, .72], lean: 45, a: { r: [-140, -110], l: [-130, -100] }, lg: { r: [-120, 190], l: [-120, 190] } },
  // wide stance, torso tipped sideways over the front leg: bottom hand to the shin, top arm straight up
  { id: 'triangle', d: 'hard', safe: true, seated: false, at: [.4, .52], lean: 75, a: { r: [0, 0], l: [180, 180] }, lg: { r: [35, 35], l: [-35, -35] } },
  // front knee bent at 90 degrees, top arm reaching overhead in one line with the back leg
  { id: 'extendedSide', d: 'hard', safe: true, seated: false, at: [.45, .55], lean: 60, a: { r: [0, 0], l: [120, 120] }, lg: { r: [90, 0], l: [-55, -55] } },
  // low plank: body in a straight line just above the floor, elbows bent back along the ribs
  { id: 'chaturanga', d: 'hard', safe: true, seated: false, prof: true, at: [.42, .58], lean: 70, a: { r: [-60, 0], l: [-60, 0] }, lg: { r: [-70, -70], l: [-70, -70] } },
  // balance on one leg, torso flat, other leg lifted level, arms in one vertical line
  { id: 'halfMoon', d: 'hard', safe: false, seated: false, at: [.45, .5], lean: 90, a: { r: [0, 0], l: [180, 180] }, lg: { r: [0, 0], l: [-90, -90] } },
  // full backbend: hands and feet on the floor, hips pushed up high, head hanging between the arms
  { id: 'wheel', d: 'hard', safe: false, seated: false, prof: true, at: [.6, .45], lean: -110, a: { r: [-15, -10], l: [-15, -10] }, lg: { r: [30, 0], l: [30, 0] } },
  // folded over the standing leg, other leg kicked high behind, hands holding the ankle
  { id: 'standingSplit', d: 'hard', safe: false, seated: false, prof: true, at: [.45, .4], lean: 148, a: { r: [-60, 6], l: [-60, 6] }, lg: { r: [0, 0], l: [-160, -160] } },
  // upside down on straight arms, legs opened wide in a V
  { id: 'handstand', d: 'hard', safe: false, seated: false, sc: .9, at: [.5, .4], lean: 180, a: { r: [0, 0], l: [0, 0] }, lg: { r: [135, 135], l: [-135, -135] } },
  // DUO POSES (n: 2). figs[0] stands on screen-LEFT, figs[1] on screen-RIGHT; both are drawn at 80% size.
  { id: 'holdHands',  d: 'easy', n: 2, touch: [[0, 'r', 1, 'l']], safe: true, seated: true, figs: [{ at: [.32, .6], a: { r: [20, 40] } }, { at: [.68, .6], a: { l: [-20, -40] } }] },
  { id: 'doubleFive', d: 'easy', n: 2, touch: [[0, 'r', 1, 'l']], safe: true, seated: true, figs: [{ at: [.32, .6], a: { r: [152, 152], l: [-150, -150] } }, { at: [.68, .6], a: { l: [-152, -152], r: [150, 150] } }] },
  { id: 'reach',      d: 'easy', n: 2, touch: [[0, 'r', 1, 'l']], safe: true, seated: true, figs: [{ at: [.24, .6], a: { r: [90, 90] } }, { at: [.76, .6], a: { l: [-90, -90] } }] },
  { id: 'cheer',      d: 'easy', n: 2, safe: true, seated: true, figs: [{ at: [.3, .6], a: { r: [180, 180], l: [-180, -180] }, lg: { r: [25, 25], l: [-25, -25] } }, { at: [.7, .6], a: { r: [180, 180], l: [-180, -180] }, lg: { r: [25, 25], l: [-25, -25] } }] },
  { id: 'tent',       d: 'medium', n: 2, touch: [[0, 'r', 1, 'l']], safe: true, seated: false, figs: [{ at: [.3, .62], lean: 20, a: { r: [164, 164], l: [-60, -60] } }, { at: [.7, .62], lean: -20, a: { l: [-164, -164], r: [60, 60] } }] },
  { id: 'duoDance',   d: 'medium', n: 2, safe: true, seated: false, figs: [
      { at: [.3, .6], lean: 8, a: { r: [170, 170], l: [-60, -30] }, lg: { r: [40, 0], l: [-20, -20] } },
      { at: [.7, .6], lean: -8, a: { l: [-170, -170], r: [60, 30] }, lg: { l: [-40, 0], r: [20, 20] } }] },
  { id: 'duoWarrior', d: 'medium', n: 2, touch: [[0, 'r', 1, 'l']], safe: true, seated: false, figs: [
      { at: [.24, .6], a: { r: [90, 90], l: [-175, -175] }, lg: { r: [50, 0], l: [-30, -30] } },
      { at: [.76, .6], a: { l: [-90, -90], r: [175, 175] }, lg: { l: [-50, 0], r: [30, 30] } }] },
  { id: 'duoBend',    d: 'medium', n: 2, safe: true, seated: false, figs: [{ at: [.3, .6], lean: 28, a: { r: [145, 145], l: [-40, 46] } }, { at: [.7, .6], lean: -28, a: { l: [-145, -145], r: [40, -46] } }] },
  { id: 'twinTrees',  d: 'hard', n: 2, touch: [[0, 'r', 1, 'l']], safe: false, seated: false, figs: [
      { at: [.32, .6], a: { r: [152, 152], l: [-150, -150] }, lg: { l: [-50, 105], r: [0, 0] } },
      { at: [.68, .6], a: { l: [-152, -152], r: [150, 150] }, lg: { r: [50, -105], l: [0, 0] } }] },
  // both balancing on their sit bones, leaning back, legs raised so the soles of their feet meet
  { id: 'partnerBoat', d: 'hard', n: 2, safe: true, seated: false, figs: [
      { prof: true, at: [.27, .72], lean: -30, a: { r: [90, 90], l: [90, 90] }, lg: { r: [135, 135], l: [135, 135] } },
      { prof: true, at: [.73, .72], lean: 30, a: { r: [-90, -90], l: [-90, -90] }, lg: { r: [-135, -135], l: [-135, -135] } }] },
  // mirrored triangles tipping away from each other, top arms straight up
  { id: 'twinTriangle', d: 'hard', n: 2, safe: true, seated: false, figs: [
      { at: [.32, .55], lean: -75, a: { l: [0, 0], r: [180, 180] }, lg: { r: [35, 35], l: [-35, -35] } },
      { at: [.68, .55], lean: 75, a: { r: [0, 0], l: [180, 180] }, lg: { r: [35, 35], l: [-35, -35] } }] },
  // backs pressed together, both sitting in an invisible chair with thighs level, arms reaching forward
  { id: 'backToBack', d: 'hard', n: 2, safe: true, seated: false, figs: [
      { prof: true, at: [.43, .58], a: { r: [-90, -90], l: [-90, -90] }, lg: { r: [-90, 0], l: [-90, 0] } },
      { prof: true, at: [.57, .58], a: { r: [90, 90], l: [90, 90] }, lg: { r: [90, 0], l: [90, 0] } }] },
  // facing each other in dancer pose: front hands joined in the middle, back hand holding the lifted foot
  { id: 'partnerDancer', d: 'hard', n: 2, touch: [[0, 'r', 1, 'l']], safe: false, seated: false, figs: [
      { at: [.22, .55], lean: 15, a: { r: [140, 140], l: [-60, -20] }, lg: { l: [0, 0], r: [-110, 170] } },
      { at: [.78, .55], lean: -15, a: { l: [-140, -140], r: [60, 20] }, lg: { r: [0, 0], l: [110, -170] } }] },
];
