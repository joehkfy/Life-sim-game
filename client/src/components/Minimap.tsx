import { useMemo } from "react";
import { useGameStore } from "../stores/gameStore";
import { BUILDINGS } from "@life-sim/shared";

const RANGE = 90; // world units shown on minimap radius

export function Minimap() {
  const character = useGameStore((s) => s.character);
  const others = useGameStore((s) => s.otherPlayers);

  const marks = useMemo(() => {
    if (!character) return [];
    const cx = character.position?.x ?? 0;
    const cz = character.position?.z ?? 0;
    const list: { key: string; label: string; color: string; x: number; z: number; size: number }[] = [];

    for (const [key, b] of Object.entries(BUILDINGS)) {
      if (!b.radius || b.radius <= 0) continue;
      list.push({ key, label: b.name, color: "#74b9ff", x: b.x, z: b.z, size: 5 });
    }
    for (const p of others.values()) {
      if (p.location && p.location !== "city") continue;
      list.push({
        key: p.id,
        label: p.name,
        color: "#55efc4",
        x: p.position?.x ?? 0,
        z: p.position?.z ?? 0,
        size: 4,
      });
    }
    // player at center
    list.push({ key: "you", label: "You", color: "#ffeaa7", x: cx, z: cz, size: 6 });
    return list.map((m) => ({
      ...m,
      nx: ((m.x - cx) / RANGE) * 50 + 50,
      nz: ((m.z - cz) / RANGE) * 50 + 50,
    }));
  }, [character, others]);

  if (!character || (character.location && character.location !== "city")) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: 88,
        width: 118,
        height: 118,
        borderRadius: 16,
        background: "rgba(8,12,20,0.78)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(10px)",
        zIndex: 18,
        overflow: "hidden",
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        pointerEvents: "none",
      }}
      title="Minimap"
    >
      <div
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: 12,
          background: "radial-gradient(circle at center, rgba(45,70,55,0.55), rgba(20,28,36,0.9))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />
      {/* Cross streets */}
      <div style={{ position: "absolute", left: "50%", top: 10, bottom: 10, width: 1, background: "rgba(255,255,255,0.12)", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: 10, right: 10, height: 1, background: "rgba(255,255,255,0.12)", transform: "translateY(-50%)" }} />
      {marks.map((m) => {
        if (m.nx < 4 || m.nx > 96 || m.nz < 4 || m.nz > 96) return null;
        return (
          <div
            key={m.key}
            style={{
              position: "absolute",
              left: `${m.nx}%`,
              top: `${m.nz}%`,
              width: m.size,
              height: m.size,
              marginLeft: -m.size / 2,
              marginTop: -m.size / 2,
              borderRadius: m.key === "you" ? 2 : "50%",
              background: m.color,
              boxShadow: m.key === "you" ? "0 0 6px #ffeaa7" : "none",
            }}
            title={m.label}
          />
        );
      })}
      <div style={{ position: "absolute", left: 8, top: 6, fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>MAP</div>
    </div>
  );
}
