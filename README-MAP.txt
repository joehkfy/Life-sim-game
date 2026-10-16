MAP UPGRADE — Kenney City Kit (CC0)
===================================

Source assets (free, public domain):
  https://kenney.nl/assets/city-kit-roads
  https://kenney.nl/assets/city-kit-commercial
  https://kenney.nl/assets/city-kit-suburban
  Mirror: https://github.com/shorepine/kenney

What changed
- Real Kenney commercial + suburban GLB buildings in public/models/world/buildings/
- Extra road pieces (crossroad-line, crossing, bend, street lights)
- City layout is now a FIXED GRID (spacing 14): buildings only in block centres
- Local streets drawn at ±14, ±28, ±42 (same grid cars use)
- Traffic lanes on main avenues + grid roads at ±14

Push
  unzip -o life-sim-map-kenney-upgrade.zip
  git add -A
  git commit -m "Map: Kenney city grid, real building models, roads aligned with traffic"
  git push origin main
