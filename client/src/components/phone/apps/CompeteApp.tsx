import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

function closesIn(t?: string) {
  if (!t) return "";
  const s = Math.max(0, Math.floor((new Date(t).getTime() - Date.now()) / 1000));
  return `Closes in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CompeteApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [tab, setTab] = useState<"events" | "boards">("events");
  const [comps, setComps] = useState<any[]>([]);
  const [boards, setBoards] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function refresh() {
    fetch(`${API}/api/game/competitions`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setComps(d)).catch(() => {});
    fetch(`${API}/api/game/leaderboards`, { headers }).then((r) => r.json()).then(setBoards).catch(() => {});
  }
  useEffect(() => { if (token) refresh(); }, [token]);

  async function enter(id: string) {
    const r = await fetch(`${API}/api/game/competitions/enter`, { method: "POST", headers, body: JSON.stringify({ competitionId: id }) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Compete</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        <div className="phone-btn-row" style={{ marginBottom: 8 }}>
          <button className={`phone-btn ${tab === "events" ? "ok" : ""}`} style={{ flex: 1 }} onClick={() => setTab("events")}>Events</button>
          <button className={`phone-btn ${tab === "boards" ? "ok" : ""}`} style={{ flex: 1 }} onClick={() => setTab("boards")}>Ranks</button>
        </div>
        {tab === "events" && comps.map((c) => (
          <div key={c.id} className="phone-card">
            <div className="phone-row-title">{c.name}</div>
            <div className="phone-row-sub">{c.type} · {c.skill} · fee ${c.entryFee} · pot ${c.prizePool}</div>
            <div className="phone-row-sub">{c.entries?.length || 0} entered · {c.status}{c.lastWinner ? ` · last winner ${c.lastWinner} ($${c.lastPrize})` : ""}</div>
            {c.status === "open" && (
              <>
                <button className="phone-mini-btn ok" onClick={() => enter(c.id)}>Enter</button>
                <span className="phone-row-sub" style={{ marginLeft: 8 }}>{closesIn(c.closesAt)}</span>
              </>
            )}
            {(c.entries || []).slice(0, 5).map((e: any) => (
              <div key={e.id} className="phone-row-sub">#{e.rank || "—"} {e.characterName} · {e.score?.toFixed?.(1)}</div>
            ))}
          </div>
        ))}
        {tab === "boards" && boards && (
          <>
            <div className="phone-section">Richest</div>
            {(boards.richest || []).map((r: any, i: number) => (
              <div key={r.id} className="phone-row">
                <div className="phone-row-title">#{i + 1} {r.name}</div>
                <div className="phone-row-sub">${r.netWorth?.toFixed?.(0)}</div>
              </div>
            ))}
            <div className="phone-section">Top businesses</div>
            {(boards.businesses || []).map((b: any, i: number) => (
              <div key={b.id} className="phone-row">
                <div className="phone-row-title">#{i + 1} {b.name}</div>
                <div className="phone-row-sub">{b.type} · ${b.totalRevenue}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
