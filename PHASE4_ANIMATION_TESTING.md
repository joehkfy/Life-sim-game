# Phase 4 — Character Animation Test Checklist

This phase replaces the rigid capsule-only avatar with a procedural, articulated, Donghua-inspired character rig and connects everyday home actions to animated poses.

## What to test

1. **Idle:** Stand still for 10–15 seconds. Look for subtle breathing, head movement, and occasional blinking.
2. **Walk:** Move using keyboard controls and the mobile joystick. Arms and legs should swing in opposite directions and the torso should rise/fall slightly.
3. **Run:** Hold the run control. The stride and arm swing should become faster and broader than walking.
4. **Sleep:** Place a bed, enter the home, click it, choose Sleep, and wait. The character should approach the bed, lie down, breathe lightly with eyes closed, then sit/stand back up after the interaction animation finishes.
5. **Relax:** Place a sofa and use Relax. The character should approach it and move into a seated pose.
6. **Computer:** Place a desk, use the computer, and check the sitting pose and typing hand movement. A chair is included in the desk furniture model.
7. **Read:** Use a bookshelf. The character should hold a visible book and move their head subtly while reading.
8. **Cook / Shower / Snack:** Check the distinct arm movement for each action.
9. **Watch TV:** The character should turn toward the TV and use a standing watching pose.
10. **Multiplayer:** Open the same city with another account. Walk, run, and use an interaction; the other player should receive the current animation state.
11. **Mobile:** Repeat movement and interactions using touch controls and the phone app.

## Notes and current limits

- These are lightweight procedural animations driven by the character rig; they are not motion-capture clips.
- Interactions animate and approach the clicked object, but the current prototype does not use full inverse kinematics. Hand contact can therefore be approximate depending on furniture placement and rotation.
- Interaction movement uses the existing collision system. A difficult approach can finish from the nearest reachable point rather than leaving the character permanently stuck.
- The sleep action is a timed interaction. A future refinement should add a dedicated Wake/Cancel action and tie the sleeping animation duration directly to the needs simulation.
- The full application build should be run after dependencies are installed: `npm install`, then `npm run build` from the project root.
