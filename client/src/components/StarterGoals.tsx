import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../stores/gameStore";

type GoalId = "explore" | "job" | "work" | "eat" | "home";

type GoalState = {
  explore: boolean;
  job: boolean;
  work: boolean;
  eat: boolean;
  home: boolean;
  dismissed: boolean;
  startX?: number;
  startZ?: number;
};

const GOALS: { id: GoalId; title: string; detail: string }[] = [
  { id: "explore", title: "Explore the city", detail: "Walk around the streets and park" },
  { id: "job", title: "Get a job", detail: "Open Phone → Jobs → Apply" },
  { id: "work", title: "Work one shift", detail: "Phone → Jobs → Work shift" },
  { id: "eat", title: "Eat something", detail: "Phone → Shop or Inventory → use food" },
  { id: "home", title: "Visit your home", detail: "Walk east to the home district and enter" },
];

function storageKey(characterId: string) {
  return `life-sim-goals-v1:${characterId}`;
}

function loadState(characterId: string): GoalState {
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (raw) return { explore: false, job: false, work: false, eat: false, home: false, dismissed: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { explore: false, job: false, work: false, eat: false, home: false, dismissed: false };
}

function saveState(characterId: string, state: GoalState) {
  try {
    localStorage.setItem(storageKey(characterId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function StarterGoals() {
  const character = useGameStore((s) => s.character);
  const [state, setState] = useState<GoalState | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!character?.id) {
      setState(null);
      return;
    }
    const loaded = loadState(character.id);
    if (loaded.startX == null) {
      loaded.startX = character.position?.x ?? 0;
      loaded.startZ = character.position?.z ?? 0;
      saveState(character.id, loaded);
    }
    setState(loaded);
  }, [character?.id]);

  // Auto-complete goals from live character data
  useEffect(() => {
    if (!character?.id || !state || state.dismissed) return;
    let next = { ...state };
    let changed = false;

    if (!next.job && character.jobId) {
      next.job = true;
      changed = true;
    }
    if (!next.home && character.location && character.location !== "city") {
      // Entered any interior counts; home_* is ideal
      if (String(character.location).startsWith("home_") || character.location === "apartments") {
        next.home = true;
        changed = true;
      }
    }
    // Explore: moved ~25 units from start
    if (!next.explore && next.startX != null && next.startZ != null && character.location === "city") {
      const dx = (character.position?.x ?? 0) - next.startX;
      const dz = (character.position?.z ?? 0) - next.startZ;
      if (dx * dx + dz * dz >= 25 * 25) {
        next.explore = true;
        changed = true;
      }
    }
    // Hunger dropped a lot from max → likely ate (hunger is 0 full, 100 starving typically)
    // Check inventory use via event
    if (changed) {
      saveState(character.id, next);
      setState(next);
    }
  }, [character, state]);

  useEffect(() => {
    if (!character?.id) return;
    const onWorked = () => {
      setState((prev) => {
        if (!prev || prev.work) return prev;
        const next = { ...prev, work: true };
        saveState(character.id, next);
        return next;
      });
    };
    const onAte = () => {
      setState((prev) => {
        if (!prev || prev.eat) return prev;
        const next = { ...prev, eat: true };
        saveState(character.id, next);
        return next;
      });
    };
    window.addEventListener("life-sim:worked-shift", onWorked);
    window.addEventListener("life-sim:used-food", onAte);
    return () => {
      window.removeEventListener("life-sim:worked-shift", onWorked);
      window.removeEventListener("life-sim:used-food", onAte);
    };
  }, [character?.id]);

  const doneCount = useMemo(() => {
    if (!state) return 0;
    return GOALS.filter((g) => state[g.id]).length;
  }, [state]);

  if (!character || !state || state.dismissed) return null;
  const allDone = doneCount >= GOALS.length;

  function dismiss() {
    if (!character?.id || !state) return;
    const next = { ...state, dismissed: true };
    saveState(character.id, next);
    setState(next);
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 88,
        zIndex: 20,
        width: collapsed ? 160 : 260,
        maxWidth: "calc(100vw - 24px)",
        background: "rgba(12,16,24,0.82)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 14,
        padding: collapsed ? "10px 12px" : "12px 14px",
        color: "#f2f4f8",
        backdropFilter: "blur(14px)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: collapsed ? 0 : 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {allDone ? "Starter goals complete" : `Getting started (${doneCount}/${GOALS.length})`}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{ background: "transparent", border: "none", color: "#9aa3b2", cursor: "pointer", fontSize: 12 }}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {GOALS.map((g) => {
              const done = state[g.id];
              return (
                <div key={g.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: done ? 0.55 : 1 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: done ? "none" : "1px solid rgba(255,255,255,0.25)",
                      background: done ? "#3dd68c" : "transparent",
                      color: "#0b1a12",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {done ? "✓" : ""}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, textDecoration: done ? "line-through" : "none" }}>{g.title}</div>
                    {!done && <div style={{ fontSize: 11, color: "#9aa3b2", marginTop: 1 }}>{g.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {(allDone || doneCount >= 2) && (
            <button
              type="button"
              onClick={dismiss}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#d7dde8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {allDone ? "Dismiss guide" : "Dismiss for now"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
