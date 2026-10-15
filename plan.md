# POSE RELAY — Game Plan (Idea 1)

> A "Human Tetris meets Charades" hybrid game on the theme **Wellness**.
> 50% physical (posing, stretching, moving) / 50% social media interface (shared screen, emoji reactions, shareable results).
> Working title: **Pose Relay** (placeholder, rename freely).

This document is the build plan to hand to Claude Code. It covers the game design (Players, Rules, Goals, Space, Time, Resources, Conflict), the social media and offline layers, the 10-emoji system, the MVP, the differentiating final outcomes, the role of AI, and a technical build plan.

---

## 1. Concept Description

Human Tetris, but played as a charades game.

- The screen displays a **cutout (silhouette) of a pose** that must be recreated.
- The **Poser** (main player) stands **facing away from the screen** and cannot see it.
- The **Describers** (other players) can see the screen and must **verbally describe the pose** to the Poser.
- The Poser only progresses to the next level if their pose is accurate enough to match the silhouette within the time limit.
- Inspired by: Human Tetris / Hole in the Wall (pose matching), Heads Up! (guessing with a team), Just Dance (screen-led body movement).

**Core loop:** See pose → describe → pose → check match → level up (or pass to next player).

**Wellness angle:** stretching, flexibility, balance, laughter, social connection, ice-breaking, movement with friends instead of passive screen time.

---

## 2. Game Design Framework

### 2.1 Players
- **Count:** 3 to 7 players (1 Poser + 2 to 6 Describers). Multiplayer pose mode allows 3+ people to pose together.
- **Ages:** Kids, teens, young adults.
- **Roles:**
  - **Poser**: faces away from the screen, relies fully on trust.
  - **Describers**: see the screen, give verbal instructions.
  - **Next-up**: the player waiting to take over if the Poser fails.

### 2.2 Rules
1. The Poser **cannot look at the screen**.
2. The pose must be completed **within the time limit** to progress to the next level.
3. Other players **must describe** the pose (no touching, no moving the Poser's body, no mimicking the pose themselves in front of the Poser).
4. The Poser must **accurately match** the pose displayed on screen.
5. If the Poser **fails within the time limit**, the **next player starts** as Poser.
6. **Multiplayer pose option:** 3 or more people pose together (team pose), with the remaining players describing.
7. *(Added for safety)* No jumping, flipping, or forced balance poses on hard floors. A "Safe Mode" filter removes risky poses.
8. *(Added for fairness)* Describers cannot use the pose's name if the game shows one (e.g. "Tree Pose"), only body-part descriptions.

### 2.3 Goals
1. Get the Poser to achieve the pose with **minimal description from the audience**. The pose must be accurate enough to match the silhouette on screen.
2. Strengthen **body flexibility** and **social connectivity** among players.
3. Work as a **fun ice-breaker** that lifts a dull atmosphere.

**Win condition (proposed):** Team score based on levels cleared and accuracy. Individual bonus awards (Best Describer, Most Flexible, Funniest Fail) keep eliminated players engaged.

### 2.4 Space
- Any relatively open space where limbs can stretch out and multiple people can pose.
- No cramped or dangerous spaces.
- Stable ground preferred, as poses can get complex.
- Screen (TV, laptop, or projector) visible to Describers and positioned behind the Poser.

### 2.5 Time
- The whole game can run as long as players want, **until exhaustion**.
- **In-game timer:** around **1 minute** per pose attempt.
- **Rapid-fire rounds** (e.g. 20 to 30 seconds each) depending on game mode.
- Suggested session: 15 to 30 minutes.

### 2.6 Resources
- **Human Tetris** (pose-matching concept) and **Heads Up** (describe-to-guess concept) as reference mechanics.
- Screen + browser (laptop, phone, or TV).
- Optional: a second device used as a camera.
- Optional: stable floor mat / yoga mat.

### 2.7 Conflict
- The Poser **cannot see the screen** and must **rely on and trust the other players**.
- Multiple Describers can give the **same instruction in different ways**, which causes **confusion and tension** (this is the fun conflict).
- Time pressure increases chaos.
- Left/right confusion (Describer's left vs Poser's left) is an intentional comedic hazard.

---

## 3. Social Media and Internet Use (the 50% digital)

The digital side is a **shared screen + live reaction layer + shareable output**, so the game feels like a social media experience, not just a timer.

1. **Shared Pose Screen:** the main game screen (web app) displays the pose cutout and timer. Players join by room code on their own phones (no account required).
2. **Live Emoji Reactions:** Describers and spectators tap emojis on their phones. Reactions float on the shared screen in real time (see Section 5).
3. **Pose Challenge Links:** a player can send a **challenge link** to friends (a specific set of poses). Friends play their own session and compare scores.
4. **Privacy by design:** the app works with **silhouettes only**. Camera video is processed on-device and never stored or uploaded.

---

## 4. Offline Aspects (the 50% physical)

- All core gameplay is physical: standing, listening, posing, stretching, laughing.
- Verbal communication is face to face. The game requires **no internet during play** in Local Mode (poses are bundled; the timer and scoring run locally).
- Judging can be fully human: Describers hold up the **accuracy verdict** with hand signals or emoji taps (Human Judge Mode).
- Works without any camera or sensors in MVP.
- Physical items: open floor space, optional mat, and a screen.
- Offline-friendly fallback: a printable deck of silhouette pose cards (same game with paper instead of screen).

---

## 5. The 10-Emoji Communication System

Maximum **10 emojis** as the special communication mode. They communicate **outcomes** and **real-time feedback** without breaking the "describe with words" rule.

| # | Emoji | Name | Meaning / Outcome | Who uses it |
|---|-------|------|-------------------|-------------|
| 1 | 🎯 | Nailed It | Pose matches (success, level cleared) | Judge / AI |
| 2 | 🔥 | Getting Hot | Very close to the target pose | Describers |
| 3 | ❄️ | Getting Cold | Moving away from the target pose | Describers |
| 4 | 👀 | Almost | Nearly there, one small fix left | Describers |
| 5 | 😵 | Confusion | Conflicting instructions / lost Poser | Poser or Describers |
| 6 | 🤣 | Funny Fail | Hilarious attempt (counts as a social point) | Anyone |
| 7 | 🤝 | Teamwork | Multi-person pose success / great describing | Describers |
| 8 | ⏱️ | Time's Up | Time limit reached, next player starts | System |
| 9 | 🏆 | Level Cleared | Advance to the next level / combo bonus | System |
| 10 | 🧘 | Stretch Break | Wellness pause: guided 20-second stretch for everyone | System / any player |

**Rules for emojis:**
- Emojis give **outcomes and feedback only**, never body-part instructions.
- Describers still have to use **words** for the actual description.
- Emoji tallies feed the end-of-round **result card** and awards.

---

## 6. MVP (Minimum Viable Product)

The goal of the MVP is to prove the core loop is fun with **human judging** and **zero AI dependency**.

**In scope:**
- Web app (runs in any modern browser), shared-screen "host" view.
- Library of **~30 original silhouette poses** across 3 difficulty levels (easy, medium, hard), designed to be copyright-free.
- Pose display + countdown timer (default 60s, rapid-fire 20 to 30s).
- Player setup: 3 to 7 players, rotating Poser order.
- **Human judging:** Describers press a button to confirm Match / No Match.
- **Level progression** and **pass-the-Poser** logic on fail.
- **Emoji panel** with the 10 emojis (on-screen buttons, floating reactions).
- Basic scoring (levels cleared, time bonus).
- Rulebook screen (How to Play).
- Safe Mode toggle (removes risky poses).
- Works locally on one device (pass and play), with optional room-code join as the next step.

**Out of scope for MVP:** camera pose detection, accounts, leaderboards, community pose packs, AI pose generation.

**MVP success criteria:**
- A group of 4 can start and finish a session in under 2 minutes of setup.
- Playtesters laugh, communicate, and want another round.
- At least 80% of poses are describable in words within 60 seconds.

---

## 7. Differentiating Final Outcomes

What makes the final product different from existing games:

1. **Reverse charades:** the audience speaks and the performer acts, with the performer blind to the target. This reverses the usual charades format.
2. **Trust-based communication:** the core tension is trust and clarity of language, not speed or button mashing.
3. **Wellness embedded in play:** stretching and flexibility are the engine of the game, plus built-in 🧘 Stretch Breaks.
4. **AI pose judging (final version):** the camera scores the match automatically, so nobody has to argue about accuracy.
5. **Silhouette-matching "Human Tetris" feel:** progressive difficulty (levels get stranger, multi-player poses, tighter holes).
6. **Social layer:** emoji reactions, shareable result cards, challenge links.
7. **Inclusive by design:** adjustable difficulty, Safe Mode, seated and low-mobility pose sets.
8. **Privacy-first:** silhouettes and on-device processing only.

---

## 8. Roles of AI in this Process

Split into **AI in the game** (product features) and **AI in the design/build process**.

### 8.1 AI inside the game
| Role | Description | Phase |
|------|-------------|-------|
| **Pose judge** | A pose-estimation model (e.g. MediaPipe Pose or TensorFlow.js MoveNet) compares the Poser's body keypoints to the target silhouette's keypoints and returns an accuracy score (0 to 100). A threshold (e.g. 75%) decides Match. | Final |
| **Adaptive difficulty** | Picks the next pose based on how the group is performing. | Final |
| **Pose generator** | Creates new original silhouette poses from a skeleton/keypoint definition so the library never runs out. | Final / Stretch |
| **Describer coach (optional)** | After a round, suggests clearer descriptive phrases ("try 'right hand to the sky' instead of 'up there'"). | Stretch |
| **Highlights and result card** | Summarizes the round (best describer, funniest fail, accuracy) into the share card. | Final |

> AI never replaces the human experience: the people **talk, move, and laugh**. AI only **judges, adapts, and summarizes**.

### 8.2 AI in the design and development process
- **Claude Code** builds the app from this plan.
- AI assists with **pose library creation** (keypoint definitions, difficulty tagging).
- AI assists with **playtest analysis** (summarizing feedback, spotting confusing rules).
- AI assists with **rulebook drafting** and iteration.

### 8.3 Ethical guardrails for AI
- Process camera input **on-device**; store nothing.
- No face recognition, no body-shape scoring, only pose-keypoint matching.
- Always allow **human override** of the AI verdict.
- Make poses accessible, and never shame players for body type or flexibility.

---

## 9. Game Flow and Modes

### 9.1 Standard flow
1. **Setup:** pick the number of players, difficulty, Safe Mode on/off.
2. **Rulebook flash:** a 20-second "How to Play" screen.
3. **Round start:** Poser turns away from the screen. The pose appears. Timer starts (60s).
4. **Describe:** Describers speak. Reaction emojis float on screen.
5. **Lock pose:** the Poser says "Locked!" (or a Describer presses Lock).
6. **Judge:** the match is verified (human in MVP, AI in final).
7. **Outcome:** 🎯/🏆 → next level for the same Poser, or ⏱️ → next player becomes Poser.
8. **Stretch Break:** every N rounds, 🧘 triggers a 20-second guided stretch.
9. **Session end:** result card, awards, option to share.

### 9.2 Modes
- **Classic:** 60s per pose, same Poser continues while succeeding.
- **Rapid Fire:** 20 to 30s per pose, quick rotation.
- **Team Pose:** 3+ players pose together as one silhouette, the rest describe.
- **Mute Describers (stretch):** Describers may only use 5 words per instruction.
- **Chill Mode:** no timer, focus on stretching and laughing.

---

## 10. Technical Plan (for Claude Code)

### 10.1 Suggested stack
- **Frontend:** React + Vite + TypeScript, Tailwind CSS (or plain CSS modules).
- **Rendering poses:** SVG silhouettes defined from keypoint data (original, copyright-free).
- **Realtime (phase 2):** WebSocket (Socket.IO or a lightweight alternative) for room codes and phone reactions.
- **Pose detection (phase 3):** MediaPipe Pose or TF.js MoveNet, running in the browser.
- **State management:** Zustand or React context.
- **Hosting:** static hosting (Vercel/Netlify) plus a small Node server for rooms.
- **Offline support:** PWA with service worker so Local Mode works with no internet.

### 10.2 Core data models
```ts
type Difficulty = 'easy' | 'medium' | 'hard';

interface Pose {
  id: string;
  name: string;               // internal name, hidden from players if hideNames = true
  difficulty: Difficulty;
  playersRequired: number;    // 1 for solo pose, 3+ for team pose
  keypoints: Keypoint[];      // normalized 0-1 body joints used to draw the silhouette and for AI matching
  safeMode: boolean;          // true if allowed in Safe Mode
  seatedFriendly: boolean;
  tags: string[];             // e.g. ['arms', 'balance', 'stretch']
}

interface Keypoint { joint: string; x: number; y: number; }

interface Player { id: string; name: string; score: number; role: 'poser' | 'describer'; }

interface Round {
  poseId: string;
  poserId: string;
  timeLimitSec: number;
  startedAt: number;
  result: 'match' | 'timeout' | 'skipped';
  accuracy?: number;          // from AI judge
  emojiEvents: EmojiEvent[];
}

type EmojiId = 'nailed' | 'hot' | 'cold' | 'almost' | 'confused' | 'funny' | 'team' | 'timeup' | 'level' | 'stretch';

interface EmojiEvent { emoji: EmojiId; fromPlayerId: string; at: number; }

interface GameSession {
  code: string;
  mode: 'classic' | 'rapid' | 'team' | 'chill';
  players: Player[];
  difficulty: Difficulty;
  safeMode: boolean;
  level: number;
  rounds: Round[];
}
```

### 10.3 Key screens
1. **Home / Setup** (players, mode, difficulty, Safe Mode)
2. **How to Play** (rulebook)
3. **Game Screen** (pose silhouette, timer, current Poser, emoji bar, floating reactions)
4. **Judge Overlay** (Match / No Match in MVP, accuracy meter in final)
5. **Stretch Break Screen** (animated guided stretch)
6. **Result Card** (score, emoji stats, awards, share/save)

### 10.4 Judging logic
- **MVP:** human vote (majority of Describers confirm Match).
- **Final:** compute similarity between the Poser's detected keypoints and the target keypoints (normalize by torso size, compare joint angles, not absolute positions). Return a 0 to 100 score. Match if score >= threshold (configurable per difficulty).
- **Camera note:** the Poser faces away from the screen, so use a **second device** (phone propped to face the Poser from the front/side) as the camera, or run pose estimation on a back view with a mirrored silhouette option. Include a **camera setup helper** screen.

### 10.5 Accessibility
- High-contrast silhouettes, colour-blind safe palette.
- Large tap targets for the emoji bar.
- Optional audio countdown cues.
- Seated and low-mobility pose sets.

---

## 11. Build Phases

**Phase 0: Foundations (1 to 2 days)**
- Scaffold the project, set up the theme, and create the pose data format and renderer.
- Create 10 starter silhouettes.

**Phase 1: MVP core loop (3 to 5 days)**
- Setup screen, round loop, timer, Poser rotation, human judging, level progression.
- Emoji bar with floating reactions (local).
- Rulebook screen and Safe Mode.
- Expand library to ~30 poses.

**Phase 2: Social layer (3 to 4 days)**
- Room codes and phone join, real-time emoji reactions from phones.
- Result card generation and share/save.
- Challenge links.

**Phase 3: AI judging (4 to 6 days)**
- Integrate pose estimation, camera setup helper, scoring, human override.
- Tune thresholds per difficulty with playtests.

**Phase 4: Polish and refine (ongoing)**
- Adaptive difficulty, pose generator, Stretch Break animations, PWA offline mode, accessibility audit.

---

## 12. Testing and Design Thinking Checkpoints

Follow the **Create → Test → Refine** loop:
1. **Paper test:** printed silhouette cards, a timer, and spoken description (no tech). Validate rules and conflict.
2. **MVP playtest:** 3 groups (kids, teens, young adults) of 3 to 7 players.
3. **Questions to ask playtesters:**
   - Was it clear what to do within the first minute?
   - Did conflicting instructions feel funny or frustrating?
   - Were any poses impossible to describe or unsafe?
   - Did the emojis help or distract?
   - Did you feel more connected afterwards?
4. **Metrics:** poses cleared per session, average describing time, emoji usage, laughter moments (observed), requests for another round.
5. **Faculty review:** present this idea alongside alternatives before finalizing.

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Physical injury from awkward poses | Safe Mode, warm-up screen, no jumping poses, stable-ground warning |
| Poses too hard to describe | Tag describability during playtests, remove or rework poses |
| Camera cannot see a Poser facing away | Second-device camera, human judging fallback |
| Arguments about accuracy | AI judge with human override, adjustable threshold |
| Players feel excluded or self-conscious | Seated poses, Chill Mode, 🤣 reframes fails as wins |
| Privacy concerns | On-device processing only, silhouettes only, no stored video |
| Copyright | All silhouettes and assets are original, generated from keypoint data |

---

## 14. Rulebook Outline (deliverable)

1. Title and theme (Wellness)
2. Overview and goal
3. Players and roles
4. What you need (Resources)
5. Space and safety
6. Setup
7. How to play (step by step)
8. Rules and fouls
9. Emoji guide (the 10 emojis)
10. Scoring and winning
11. Game modes
12. Conflict and strategy tips
13. Accessibility options

---

## 15. Instructions for Claude Code

When building from this plan:
1. Start with **Phase 0 and Phase 1** only, and confirm the core loop works before adding the social layer or AI.
2. Keep pose data **separate from UI code** (JSON files) so poses can be added easily.
3. Build the **emoji system as a reusable component** with exactly the 10 emojis defined in Section 5 and no others.
4. Make **judging pluggable**: define a `Judge` interface with `HumanJudge` (MVP) and `PoseAIJudge` (later) implementations.
5. All visual assets must be **original** (SVG generated from keypoints). No copyrighted images.
6. Include a README with run instructions, the rulebook, and a playtest checklist.
7. Write small unit tests for round progression, Poser rotation, and scoring.
