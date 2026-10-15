import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function JobsApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [jobs, setJobs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/game/jobs`, { headers }).then((r) => r.json()).then(setJobs).catch(() => {});
  }, [token]);

  async function act(path: string, body: object = {}) {
    const r = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message || "OK");
      if (path.includes("/jobs/work")) {
        window.dispatchEvent(new Event("life-sim:worked-shift"));
      }
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  if (!character) return null;
  const current = jobs.find((j) => j.id === character.jobId);

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Jobs</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        {current ? (
          <div className="bank-card" style={{ marginBottom: 12 }}>
            <div className="bank-label">Current job</div>
            <div className="bank-value" style={{ fontSize: 18 }}>{current.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Level {character.jobLevel} · XP {character.jobXp}</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6, lineHeight: 1.35 }}>
              Needs energy ≥ 20 and hunger not too high. Pay goes to your bank.
            </div>
            <div className="phone-btn-row" style={{ marginTop: 10 }}>
              <button className="phone-btn ok" onClick={() => act("/api/game/jobs/work")}>Work shift (pay → bank)</button>
              <button className="phone-btn bad" onClick={() => act("/api/game/jobs/quit")}>Quit</button>
            </div>
          </div>
        ) : (
          <p className="phone-empty">No job yet — pick one below, then work a shift to earn money.</p>
        )}
        {(() => {
          const cats = Array.from(new Set(jobs.map((j: any) => j.category).filter(Boolean)));
          return (
            <div className="phone-chip-row" style={{ marginBottom: 8 }}>
              <button className={`phone-chip ${filterCat === "all" ? "active" : ""}`} onClick={() => setFilterCat("all")}>All ({jobs.length})</button>
              {cats.slice(0, 12).map((c: string) => (
                <button key={c} className={`phone-chip ${filterCat === c ? "active" : ""}`} onClick={() => setFilterCat(c)}>{c}</button>
              ))}
            </div>
          );
        })()}
        {(filterCat === "all" ? jobs : jobs.filter((j: any) => j.category === filterCat)).map((job) => (
          <div key={job.id} className="phone-card">
            <div className="phone-row-title">{job.name}</div>
            <div className="phone-row-sub">{job.description}</div>
            <div className="phone-row-sub">${job.basePay}/shift · {job.schedule?.start}:00–{job.schedule?.end}:00</div>
            {!character.jobId && (
              <button className="phone-mini-btn" style={{ marginTop: 6 }} onClick={() => act("/api/game/jobs/apply", { jobId: job.id })}>
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
