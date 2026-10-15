# Final animation system — testing checklist

## Build and asset loading

- [ ] Run `npm install`, then `npm run build` and `npm run dev`.
- [ ] Open character creation and enter the world with a new and an existing character.
- [ ] Confirm the GLB loads without a 404 or GLTF parsing error; check that the fallback avatar is used only if the GLB fails.
- [ ] Switch between all supported hair styles, skin tones, eye presets, shirt colours, and trouser colours.
- [ ] Confirm all four hair variants display one at a time and face visibility settings still work.

## Locomotion

- [ ] Stand still for at least 20 seconds; check breathing, blinking, and occasional idle-look movement.
- [ ] Walk forward/backward and diagonally; confirm feet/arms cycle, the body does not double-move, and movement loops smoothly.
- [ ] Transition idle → walk → idle, and idle → run → idle repeatedly; check `WalkStart/Stop` and `RunStart/Stop` blends.
- [ ] Turn while walking and check that the character faces travel direction smoothly.
- [ ] Jump with Space and with the mobile Jump button; confirm take-off, airtime, landing, and floor return.
- [ ] Check another player sees the same locomotion/jump state in multiplayer.

## Home interactions

- [ ] Interact with a bed; check approach, lie down, sleep loop, waking, standing, and energy update.
- [ ] Interact with a sofa; check sit down, idle seated pose, watch TV, and stand up.
- [ ] Use a desk/computer; verify hands approach the keyboard, typing loops, and the avatar returns to idle.
- [ ] Read a book; check the book prop appears and hands/head are in a plausible reading pose.
- [ ] Get a snack and drink; verify the apple/cup prop appears at the hand and disappears afterward.
- [ ] Cook, shower, and use a door; verify the matching animation is sent and no character remains stuck after it ends.
- [ ] Use Wash Hands and Brush Teeth from Emotes; check hands/prop positioning.
- [ ] Pick up, carry, hold, and put down the box from Emotes; check the box appears/disappears at the expected moment.
- [ ] Test furniture near a wall and with different rotations; make sure approach logic does not freeze when blocked.

## Social and facial motion

- [ ] Test Wave, Talk, Laugh, Clap, Shrug, Point, Celebrate, Stretch, Yawn, Nod, Shake Head, Look Around, Handshake, Fist Bump, Dance, Crouch, and Kneel.
- [ ] Confirm Point extends the index finger; confirm fist/hold gestures curl the fingers.
- [ ] Verify blink, smile, brow, mouth, and sleep-eye changes occur without visible flicker.
- [ ] Move while an emote is running and confirm movement cancels it.
- [ ] Check the emotes panel scrolls on a smaller phone screen and all buttons remain accessible.

## Multiplayer, mobile, and performance

- [ ] Test two accounts in the same city. Check remote avatars show walk/run/sit/sleep/emote/jump states.
- [ ] Confirm unsupported animation names are rejected by the server and arbitrary airborne Y positions are not accepted outside the jump window.
- [ ] Test touch joystick, Run, Jump, touch camera look, and door prompts.
- [ ] Profile on a lower-end phone with multiple nearby avatars; check frame rate and memory.
- [ ] Confirm reconnects don't leave characters stuck in a one-shot animation.

## Known expectations

This archive uses custom procedural keyframed clips and lightweight IK. It is not motion capture. Paired gestures do not yet automatically align two players, and some cleaning actions are animation demos rather than fully integrated plumbing interactions. Record any pose or contact errors that remain after the checklist before deployment.
