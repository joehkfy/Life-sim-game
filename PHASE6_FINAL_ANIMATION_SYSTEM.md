# Life Sim — Consolidated Animation System

This is the consolidated animation pass intended to bring the current character pipeline together in one update. It builds on the Phase 6A/6B GLB avatar and replaces repeated, disconnected pose tweaks with a named skeletal-clip controller.

## Character asset

- Original procedural stylized humanoid asset at `client/public/models/characters/life-sim-donghua-base.glb`.
- 41-joint skeleton: body, arms, legs, articulated finger chains, and secondary hair-tip joints.
- 19 skinned mesh groups, including selectable hair styles, clothing, face parts, and finger geometry.
- Facial morph targets for blink, mouth-open, smile, raised brows, and frowning brows.
- Separate attached props for food, drink, phone, book, toothbrush, and a small carry box.

## Animation library

The GLB currently contains 54 named clips:

- **Locomotion:** `Idle`, `IdleLook`, `WalkStart`, `Walk`, `WalkStop`, `RunStart`, `Run`, `RunStop`, `Jump`, `Land`, `CrouchDown`, `Crouch`, `CrouchUp`.
- **Furniture and rest:** `SitDown`, `SitIdle`, `StandUp`, `Relax`, `WatchTV`, `WatchTVStanding`, `LieDown`, `Sleep`, `WakeUp`.
- **Home activities:** `Type`, `Read`, `Eat`, `Cook`, `Shower`, `Phone`, `PhoneTyping`, `Drink`, `WashHands`, `BrushTeeth`.
- **Object handling:** `OpenDoor`, `Reach`, `PickUp`, `Carry`, `PutDown`, `IdleHolding`.
- **Social and expression:** `Wave`, `Talk`, `Laugh`, `Clap`, `Shrug`, `Point`, `Handshake`, `FistBump`, `Celebrate`, `Stretch`, `Yawn`, `Nod`, `ShakeHead`, `LookAt`, `Dance`, `Kneel`.

The runtime animation controller blends between clips, handles walk/run starts and stops, enters and exits sitting/crouching, coordinates sleeping/waking with the character pivot, and drives facial expressions/blinking. Small procedural secondary movement is used for hair follow-through and facial timing.

## Runtime integration

- World interactions choose character states for sleeping, sitting, television, food, cooking, showering, computer, reading, door handling, and other actions.
- A small two-bone arm IK pass adjusts hands toward keyboard/book/cooking/food/phone/door/washing/toothbrush targets, clamping unreachable targets safely.
- Attached props appear during the relevant animation states rather than floating at world coordinates.
- The Emotes panel exposes social gestures and demonstration actions for keyboard and touch users.
- Space or the touch Jump button triggers a bounded jump arc. The server evaluates a short sine-wave jump arc itself (rather than trusting arbitrary client height values) and broadcasts the resulting animation/position to nearby players.
- The server animation allowlist contains every state the updated client emits.
- The older avatar remains available as a fallback if the GLB cannot load.

## Important limitations

This is a game-ready **procedural keyframed** character and animation set, not a motion-captured performance or a professionally hand-authored cinematic character. The IK targets improve hand placement but do not solve every contact pose. Handshakes/fist bumps are individual gestures, not a paired two-player alignment system. Showering, washing hands, brushing teeth, and other demonstration emotes are animated actions; they are not all linked to dedicated sink/shower world props yet. Performance, appearance, and all transitions need browser testing on target mobile devices.

## Run and verify

From the project root:

```bash
npm install
npm run build
npm run dev
```

Use the checklist in `PHASE6_FINAL_ANIMATION_TESTING.md`. A successful TypeScript syntax-transpile and structural GLB validation were run while preparing this archive; a full application build/live browser test could not be completed in the preparation environment because dependency installation was unavailable.
