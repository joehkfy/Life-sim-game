import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function ConstructionApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [projects, setProjects] = useState<any[]>([]);
  const [myWork, setMyWork] = useState<any[]>([]);
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  function refresh() {
    fetch(`${API}/api/game/construction/projects`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProjects(d))
      .catch(() => {});
    fetch(`${API}/api/game/construction/my-work`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setMyWork(d))
      .catch(() => {});
  }

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  async function accept(roleId: string) {
    setMsg("");
    const r = await fetch(`${API}/api/game/construction/accept`, {
      method: "POST",
      headers,
      body: JSON.stringify({ roleId }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
      if (selected) {
        const pr = await fetch(`${API}/api/game/construction/projects/${selected.id}`, { headers });
        if (pr.ok) setSelected(await pr.json());
      }
    }
  }

  async function work(roleId: string) {
    setMsg("");
    const r = await fetch(`${API}/api/game/construction/work`, {
      method: "POST",
      headers,
      body: JSON.stringify({ roleId }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
      if (selected) {
        const pr = await fetch(`${API}/api/game/construction/projects/${selected.id}`, { headers });
        if (pr.ok) setSelected(await pr.json());
      }
    }
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={selected ? () => setSelected(null) : onBack}>
          ‹
        </button>
        <span>{selected ? selected.name : "Build"}</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}

        {!selected && (
          <>
            <div className="phone-btn-row" style={{ marginBottom: 12 }}>
              <button
                className={`phone-btn ${tab === "open" ? "ok" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setTab("open")}
              >
                Open sites
              </button>
              <button
                className={`phone-btn ${tab === "mine" ? "ok" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setTab("mine")}
              >
                My work
              </button>
            </div>

            <p className="phone-empty" style={{ textAlign: "left", padding: "0 0 10px" }}>
              Owners start builds on their plots (Maps). Bricklayers, carpenters, electricians,
              plumbers, and painters take roles, go to the site, and work until the building is
              finished — then it appears on the map.
            </p>

            {tab === "open" &&
              projects.map((p) => (
                <button key={p.id} className="phone-row" onClick={() => setSelected(p)}>
                  <div className="phone-row-text">
                    <div className="phone-row-title">{p.name}</div>
                    <div className="phone-row-sub">
                      {p.buildingType} · {p.status} · {Math.floor(p.progress)}%
                    </div>
                  </div>
                  <span>›</span>
                </button>
              ))}
            {tab === "open" && projects.length === 0 && (
              <p className="phone-empty">No open construction sites</p>
            )}

            {tab === "mine" &&
              myWork.map((r) => (
                <div key={r.id} className="phone-card">
                  <div className="phone-row-title">
                    {r.roleName} · {r.project?.name}
                  </div>
                  <div className="phone-row-sub">
                    {r.status} · {Math.floor(r.progress)}/{r.requiredXp} · Pay ${r.pay}
                  </div>
                  {r.status === "filled" && r.workerId === character?.id && (
                    <button className="phone-mini-btn ok" style={{ marginTop: 6 }} onClick={() => work(r.id)}>
                      Work shift on site
                    </button>
                  )}
                </div>
              ))}
            {tab === "mine" && myWork.length === 0 && (
              <p className="phone-empty">No construction work yet</p>
            )}
          </>
        )}

        {selected && (
          <>
            <div className="bank-card">
              <div className="bank-label">{selected.buildingType}</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
              <div className="phone-row-sub">
                Status: {selected.status} · Progress {Math.floor(selected.progress)}%
              </div>
              <div className="phone-row-sub">
                Site: ({selected.posX}, {selected.posZ}) — use Maps → Go here
              </div>
            </div>

            <div className="phone-section">Trades needed</div>
            {(selected.roles || []).map((role: any) => (
              <div key={role.id} className="phone-card">
                <div className="phone-row-title">
                  {role.roleName}{" "}
                  <span style={{ fontWeight: 400, opacity: 0.7 }}>${role.pay}</span>
                </div>
                <div className="phone-row-sub">
                  {role.status === "open" && "Open — needs this job"}
                  {role.status === "filled" && `Hired · ${Math.floor(role.progress)}/${role.requiredXp}`}
                  {role.status === "done" && "Complete ✓"}
                </div>
                {role.status === "open" && (
                  <button className="phone-mini-btn ok" style={{ marginTop: 6 }} onClick={() => accept(role.id)}>
                    Take job (must be {role.roleName})
                  </button>
                )}
                {role.status === "filled" && role.workerId === character?.id && (
                  <button className="phone-mini-btn ok" style={{ marginTop: 6 }} onClick={() => work(role.id)}>
                    Work on site
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
