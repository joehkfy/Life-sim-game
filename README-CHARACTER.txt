CHARACTER UPGRADE — KayKit Rogue (CC0)
======================================
Source: https://kaylousberg.itch.io/kaykit  (Adventurers pack)
License: CC0 — free personal + commercial use

Primary model:
  client/public/models/characters/life-sim-kaykit-rogue.glb
Optional alt:
  client/public/models/characters/life-sim-kaykit-mage.glb

Animations included in the GLB (mapped in RiggedAvatar.tsx):
  Idle, Walking_A/B/C, Running_A/B, Jump_*, Sit_Chair_*, Sit_Floor_*,
  Cheer, Interact, Lie_Idle, and combat clips

Code changed:
  client/src/scenes/RiggedAvatar.tsx  (MODEL_URL + ACTION_CLIPS + bone aliases)

Fallback: life-sim-donghua-base.glb still works if KayKit fails to load.
