HUMAN CHARACTER + TALLER CITY FIX
=================================
WHAT CHANGED
1) Character: removed fantasy KayKit Rogue.
   Primary model is now life-sim-donghua-base.glb
   (human proportions, Idle/Walk/Run/Jump/Sit/Wave/Dance/Cook/Type etc.)
2) City: GTA-like taller skyline
   - Dense areas: 8–28 floors (was 4–10)
   - Mixed: 6–18 / 8–24 floors
   - Landmarks: hospital 10, apartments 14, university 8, etc.
   - Floor height increased slightly for bulk

PUSH
  cd /workspaces/Life-sim-game
  unzip -o life-sim-human-and-tall-city.zip
  git add -A
  git commit -m "Fix: human character (not fantasy rogue) + taller GTA-scale buildings"
  git push origin main
