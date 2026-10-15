# Phase 5 — Natural Pose and Interaction Refinement

This phase refines the procedural Donghua-inspired avatar from Phase 4. It remains a lightweight procedural rig; it is not motion capture and does not use full inverse kinematics.

## Improvements in this phase

- The avatar rig rotates around a hip-height pivot, so the sleeping pose lies along the bed instead of tipping around the feet.
- The sleeping pose is lowered to mattress height and uses a gentle breathing motion. Waking blends the body back upright over a longer transition.
- Seated poses no longer add an extra sideways/forward offset inside the avatar rig. Player positioning is handled at the interaction target instead.
- The standing-up transition blends hips, knees, arms, torso, and head back from seated poses instead of instantly dropping all joints into idle.
- Eyes blink at irregular intervals; sleeping closes the eyes. Brows and mouth add subtle expression changes during actions.
- Furniture approach offsets now account for the home's 0.5 scale, placing the avatar closer to the actual object instead of stopping noticeably far away.
- The controller may pass through the specific target furniture collider while approaching its intended interaction point, while other furniture and walls remain collision obstacles.
- Watching TV uses the nearest sofa when a sofa is available, seats the avatar on it, and turns the character toward the selected television. If no sofa exists, it falls back to a standing watch pose.
- The `watch_tv_sit` animation state is included in the server's movement animation allowlist so other players can see the same seated pose.
- Camera focus gently lowers while the avatar sleeps or wakes instead of abruptly changing target height.

## Manual play-test

1. Start the app and enter a home with a placed bed. Click the bed and choose **Sleep**. Check that the avatar lies horizontally at approximately mattress height, with the head near the pillows and eyes closed.
2. Let the timer complete. Confirm the character smoothly returns upright and the camera focus settles back to the normal height.
3. Use **Relax** on a sofa. Confirm the avatar approaches the cushion, sits, remains in place, and returns to standing smoothly when the action finishes.
4. Place both a sofa and a TV. Choose **Watch TV** on the television. Confirm the character takes a seat on the nearest sofa and looks toward the screen. Test with a sofa rotated at an angle too.
5. Use **Use computer** at a desk. Check that the avatar reaches the chair area and returns to standing smoothly after typing.
6. Test snack, cooking, showering, reading, and dining-chair interactions. Confirm the character approaches closer than in Phase 4 and faces each object.
7. Open a second player session. Check that walking, sleeping, sitting/TV watching, and recovery states appear for the other player. Server source and included `dist` output both allow `watch_tv_sit`.
8. Repeat inside a small home with furniture close to walls. Confirm an impossible path does not freeze the player permanently; the existing blocked-approach fallback should still recover.

## Verification

The modified TypeScript/TSX files passed TypeScript transpilation syntax checks. Full type-checking and browser gameplay tests were not possible in this environment because npm dependencies could not be downloaded. In a normal project environment, run `npm install` and `npm run build`, then perform the manual play-test above. No database schema changes are required for Phase 5.
