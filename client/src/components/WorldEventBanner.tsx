import { useMemo } from "react";
import { useGameStore } from "../stores/gameStore";

/** Lightweight city “events” driven by time + weather — no server required. */
export function WorldEventBanner() {
  const worldTime = useGameStore((s) => s.worldTime);
  const weather = useGameStore((s) => s.weather);
  const character = useGameStore((s) => s.character);

  const event = useMemo(() => {
    if (!character || (character.location && character.location !== "city")) return null;
    const hour = worldTime;

    if (weather === "stormy") {
      return { title: "Storm warning", detail: "Traffic is slower. Stay near cover or go indoors.", color: "#74b9ff" };
    }
    if (weather === "rainy") {
      return { title: "Rainy day", detail: "NPCs prefer shops and restaurants. Good day to stock up.", color: "#81ecec" };
    }
    if (hour >= 7 && hour < 9) {
      return { title: "Morning rush", detail: "People head to work and school. Apply for a job if you need one.", color: "#fdcb6e" };
    }
    if (hour >= 12 && hour < 14) {
      return { title: "Lunch hour", detail: "Restaurant and shop are busy. Grab food if you’re hungry.", color: "#e17055" };
    }
    if (hour >= 18 && hour < 21) {
      return { title: "Evening out", detail: "City lights are up. Visit the park or work a late shift.", color: "#a29bfe" };
    }
    if (hour >= 22 || hour < 5) {
      return { title: "Late night", detail: "Streets are quieter. Rest at home to recover energy.", color: "#636e72" };
    }
    return null;
  }, [worldTime, weather, character]);

  if (!event) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 16,
        maxWidth: "min(420px, calc(100vw - 24px))",
        background: "rgba(12,16,24,0.82)",
        border: `1px solid ${event.color}55`,
        borderRadius: 12,
        padding: "8px 14px",
        color: "#f2f4f8",
        backdropFilter: "blur(12px)",
        textAlign: "center",
        pointerEvents: "none",
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: event.color }}>{event.title}</div>
      <div style={{ fontSize: 11, color: "#c5cdd8", marginTop: 2 }}>{event.detail}</div>
    </div>
  );
}
