# Phase 6A — Skeletal Donghua Character Foundation

This phase introduces an original, lightweight GLB humanoid with a real glTF skin and named skeletal animation clips. It is designed as a practical first character pipeline for Life Sim, not as a finished motion-captured hero model.

## What's included

- `client/public/models/characters/life-sim-donghua-base.glb`: custom-generated character asset, 19 joints, 17 skinned mesh groups, 13 materials, and 20 animation clips.
- `tools/generate_lifesim_donghua_avatar.py`: reproducible source generator for the original asset.
- `tools/requirements-model-generator.txt`: Python dependencies needed only if regenerating the GLB asset. Install with `python -m pip install -r tools/requirements-model-generator.txt`, then run `python tools/generate_lifesim_donghua_avatar.py`.
- `client/src/scenes/RiggedAvatar.tsx`: GLB loader, per-player material customization, animation selection, cross-fades, locomotion start/stop transitions, foot counter-rotation, idle looks, sit/stand transitions, and timed bed pose alignment.
- `client/src/scenes/Avatar.tsx`: uses the skinned GLB by default and retains the prior procedural character as a loading/error fallback.

## Animation clips in the GLB

`Idle`, `Walk`, `Run`, `SitDown`, `SitIdle`, `StandUp`, `Relax`, `WatchTV`, `WatchTVStanding`, `Type`, `Read`, `Eat`, `Cook`, `Shower`, `Phone`, `Wave`, `Jump`, `LieDown`, `Sleep`, and `WakeUp`.

The player controller still owns world movement and collision. Locomotion clips are in-place so the avatar does not fight the existing controller. The animation component blends states and uses the `LieDown`/`Sleep`/`WakeUp` sequence for the bed interaction.

## Replace/refine the model later

The GLB path is `/models/characters/life-sim-donghua-base.glb`. If a higher quality Blender/Mixamo/other glTF model replaces it, keep the asset at this path or update `MODEL_URL` in `RiggedAvatar.tsx`. For the current animation mapping, preserve these clip names or update `ACTION_CLIPS` and the transition logic accordingly. Keep the character facing local +Z, with feet near y=0 and a height close to 1.9 metres.

The asset generator intentionally keeps model topology lightweight and the face/hair stylized for mobile. It is a game-ready rigging foundation, but it is not motion captured, does not yet use facial blendshapes, and does not solve hand-to-object contact with inverse kinematics. Those are follow-up improvements, not claims of this phase.

## Test checklist

1. Run `npm install` and `npm run build` at the project root.
2. Start the game and verify the GLB loads (browser network panel should show a successful request for `life-sim-donghua-base.glb`).
3. Verify player appearance changes skin tone, hair colour/style, eye preset, shirt and trousers colour.
4. Walk and run, then stop. Check that leg/arm cycles blend without moving the root twice.
5. Place a sofa and TV. Test Relax, Watch TV, and stand-up recovery.
6. Test Use Computer, Read, Cook, Shower, Snack, and Sleep. Verify other players see the animation states in multiplayer.
7. Check a second player and a mobile-sized viewport for frame rate and model scale.

## Verification note

The GLB binary structure, accessor boundaries, skin attributes, joint indices, and clip references were validated by the included generation script during creation. Full TypeScript build and live browser rendering still need to be run in the project environment with dependencies installed.
