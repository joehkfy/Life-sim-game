Animation + emote restore
=========================

WHY Donghua is primary again
- life-sim-donghua-base.glb includes real clips: Idle, Walk, Run, Wave, Dance,
  Laugh, Clap, Sit, Sleep, Jump, Phone, Cook, Type, etc.
- Young Warrior only had stand_free / run — not enough for emotes.

Files changed
- client/src/scenes/RiggedAvatar.tsx  (MODEL_URL → donghua, full ACTION_CLIPS)
- client/src/scenes/World.tsx         (emote menu: phone, sit, …)
- client/src/scenes/Player.tsx        (emote durations for phone + sit)

Models (already in public/)
- /models/characters/life-sim-donghua-base.glb   ← main
- /models/characters/life-sim-young-warrior.glb  ← optional alt (limited anims)

Test
1. Enter game → walk/run should use Walk/Run clips
2. Open 🎭 Emotes → Wave, Dance, Laugh, Phone, Sit
3. Other players should see your animation via existing movement sync
