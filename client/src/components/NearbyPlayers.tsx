import { useMemo, useState } from "react";
import { useGameStore } from "../stores/gameStore";

export function NearbyPlayers() {
  const character = useGameStore((s) => s.character);
  const others = useGameStore((s) => s.otherPlayers);
  const [open, setOpen] = useState(false);

  const nearby = useMemo(() => {
    if (!character) return [];
    const cx = character.position?.x ?? 0;
    const cz = character.position?.z ?? 0;
    return Array.from(others.values())
      .map((p) => {
        const dx = (p.position?.x ?? 0) - cx;
        const dz = (p.position?.z ?? 0) - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return { ...p, dist };
      })
      .filter((p) => !p.location || p.location === "city")
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);
  }, [character, others]);

  if (!character) return null;

  return (
    <div style={{ position: "absolute", right: 12, top: 72, zIndex: 18, pointerEvents: "auto" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "rgba(12,16,24,0.82)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: "8px 12px",
          color: "#e8eef8",
          fontSize: 12,
          fontWeight: 600,
          backdropFilter: "blur(12px)",
          cursor: "pointer",
        }}
      >
        Nearby ({nearby.length})
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            width: 200,
            maxWidth: "calc(100vw - 24px)",
            background: "rgba(12,16,24,0.9)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: 10,
            color: "#e8eef8",
            backdropFilter: "blur(14px)",
          }}
        >
          {nearby.length === 0 && (
            <div style={{ fontSize: 12, color: "#9aa3b2" }}>No players nearby. Friends: Phone → Contacts</div>
          )}
          {nearby.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "6px 4px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: "#9aa3b2" }}>{p.dist < 5 ? "Here" : `${p.dist.toFixed(0)}m`}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#9aa3b2", marginTop: 8 }}>Add friends in Phone → Contacts</div>
        </div>
      )}
    </div>
  );
}
