PLAYER CHARACTER UPGRADE — Young Warrior (Girush, CC0)
=====================================================

Asset inspection (before integration)
- Source: basemesh_a1_human_yw_by_girush.7z
- Format: Blender .blend only (no native GLB/FBX)
- Rig: custom Armature, 65 bones (Sacrum, Spine*, Humerus.*, Femur.*, Foot.*, hands…)
- NOT Mixamo / not same skeleton as previous Donghua GLB
- Animations in blend: stand_free, run, run_armed (plus empty NONE)
- Textures: body, face, eyes, body_paint, displacemap

Conversion
- Blender 4.2 headless export → client/public/models/characters/life-sim-young-warrior.glb (~600KB)
- Scaled from cm → meters (~2m tall)
- Materials renamed Mat_Skin / Mat_Hair / Mat_Iris for customisation hooks

How loading works
1. Avatar.tsx → Suspense + error boundary
2. RiggedAvatar loads MODEL_URL = life-sim-young-warrior.glb via useGLTF
3. On any load/runtime failure → ProceduralAvatar (existing) still works
4. Legacy life-sim-donghua-base.glb remains on disk for optional use / rich clips

Animation mapping
- idle / most interactions → stand_free (or stand_free_Armature)
- walk → run clip at 0.72 timescale
- run → run clip
- Donghua transition clips (WalkStart, SitDown…) used only if present on the active GLB

Bones / IK
- findBone() tries Young Warrior names then Donghua / Mixamo aliases
- Foot / arm procedural compensation still runs when bones resolve

Appearance (CharacterCreate preserved)
- skinTone tints Mat_Skin / body meshes
- hairColor / hairStyle (style 3 hides hair mesh)
- facePreset tints eyes
- clothingTop/Bottom → shirt/pants overlay meshes on spine/hip when body is single-texture

Modified files
- client/src/scenes/RiggedAvatar.tsx
- client/public/models/characters/life-sim-young-warrior.glb (new)
- Player.tsx / OtherPlayer.tsx / Avatar.tsx / CharacterCreate.tsx — unchanged (still use Avatar + appearance)

Limits (honest)
- Pack does not include sit/sleep/wave dedicated clips — those fall back to stand_free
- Clothing is overlay cylinders on single-body texture (not full wardrobe meshes)
- Full retarget of Donghua clip library onto this skeleton was not done (different bone names)
