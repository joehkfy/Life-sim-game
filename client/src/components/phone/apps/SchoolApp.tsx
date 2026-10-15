import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function SchoolApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [courses, setCourses] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function refresh() {
    fetch(`${API}/api/game/school/courses`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setCourses(d)).catch(() => {});
    fetch(`${API}/api/game/school/progress`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setProgress(d)).catch(() => {});
  }
  useEffect(() => { if (token) refresh(); }, [token]);

  async function attend(courseKey: string) {
    const r = await fetch(`${API}/api/game/school/attend`, { method: "POST", headers, body: JSON.stringify({ courseKey }) });
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
        <span>School</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        <p className="phone-empty" style={{ textAlign: "left" }}>Attend classes to raise skills and unlock better jobs & businesses.</p>
        {courses.map((c) => {
          const p = progress.find((x) => x.courseKey === c.key);
          return (
            <div key={c.key} className="phone-card">
              <div className="phone-row-title">{c.name}</div>
              <div className="phone-row-sub">{c.description}</div>
              <div className="phone-row-sub">
                {c.skill} +{c.skillGain} · ${c.cost}/class · {p ? `${p.sessions}/${c.duration}` : `0/${c.duration}`}
                {p?.completed ? " · Done ✓" : ""}
              </div>
              {!p?.completed && (
                <button className="phone-mini-btn ok" style={{ marginTop: 6 }} onClick={() => attend(c.key)}>Attend</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
