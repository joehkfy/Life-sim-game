import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function BusinessApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [tab, setTab] = useState<"browse" | "mine" | "jobs">("browse");
  const [list, setList] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("cafe");
  const [selected, setSelected] = useState<any | null>(null);
  const [jobTitle, setJobTitle] = useState("Worker");
  const [jobSalary, setJobSalary] = useState("40");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function refresh() {
    fetch(`${API}/api/game/business`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setList(d)).catch(() => {});
    fetch(`${API}/api/game/business/mine`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setMine(d)).catch(() => {});
    fetch(`${API}/api/game/business/employment`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setJobs(d)).catch(() => {});
    fetch(`${API}/api/game/business/types`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setTypes(d)).catch(() => {});
  }
  useEffect(() => { if (token) refresh(); }, [token]);

  async function act(path: string, body: object) {
    setMsg("");
    const r = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message || "OK");
      refresh();
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={selected ? () => setSelected(null) : onBack}>‹</button>
        <span>{selected ? selected.name : "Business"}</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        {!selected && (
          <>
            <p className="phone-empty" style={{ marginBottom: 8 }}>
              Open a shop, café, or company — you become the CEO. Post jobs so other players can apply and work for you. Revenue lands in the business drawer.
            </p>
            <div className="phone-btn-row" style={{ marginBottom: 8 }}>
              {(["browse", "mine", "jobs"] as const).map((t) => (
                <button key={t} className={`phone-btn ${tab === t ? "ok" : ""}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setTab(t)}>
                  {t === "browse" ? "City" : t === "mine" ? "Mine" : "My jobs"}
                </button>
              ))}
            </div>
            {tab === "browse" && list.map((b) => (
              <button key={b.id} className="phone-row" onClick={() => setSelected(b)}>
                <div className="phone-row-text">
                  <div className="phone-row-title">{b.name}</div>
                  <div className="phone-row-sub">{b.type} · {b.open ? "Open" : "Closed"} · Rev ${b.totalRevenue?.toFixed?.(0) || 0}</div>
                </div>
                <span>›</span>
              </button>
            ))}
            {tab === "mine" && (
              <>
                <div className="phone-section">Open a business</div>
                <input className="phone-input" placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} />
                <div className="phone-chip-row">
                  {types.map((t) => (
                    <button key={t.key} className={`phone-chip ${type === t.key ? "active" : ""}`} onClick={() => setType(t.key)}>
                      {t.name} ${t.openCost}
                    </button>
                  ))}
                </div>
                <button className="phone-btn ok full" onClick={() => act("/api/game/business/open", { name, type })}>Open business</button>
                <div className="phone-section">Your businesses</div>
                {mine.map((b) => (
                  <button key={b.id} className="phone-row" onClick={() => setSelected(b)}>
                    <div className="phone-row-text">
                      <div className="phone-row-title">{b.name}</div>
                      <div className="phone-row-sub">Bal ${b.balance} · Rev ${b.totalRevenue}</div>
                    </div>
                    <span>›</span>
                  </button>
                ))}
              </>
            )}
            {tab === "jobs" && (
              <>
                {jobs.length === 0 && <p className="phone-empty">Not employed at a player business</p>}
                {jobs.map((e) => (
                  <div key={e.id} className="phone-card">
                    <div className="phone-row-title">{e.title} @ {e.business?.name}</div>
                    <div className="phone-row-sub">${e.salary}/shift</div>
                    <button className="phone-mini-btn ok" onClick={() => act("/api/game/business/work", { businessId: e.businessId })}>Work shift</button>
                    <button className="phone-mini-btn bad" style={{ marginLeft: 6 }} onClick={() => act("/api/game/business/quit", { businessId: e.businessId })}>Quit</button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {selected && (
          <>
            <div className="bank-card">
              <div className="bank-label">{selected.type}</div>
              <div style={{ fontWeight: 700 }}>{selected.name}</div>
              <div className="phone-row-sub">{selected.open ? "Open" : "Closed"} · Drawer ${selected.balance || 0}</div>
            </div>
            {(selected.products || []).map((p: any) => (
              <div key={p.id} className="phone-row">
                <div className="phone-row-text">
                  <div className="phone-row-title">{p.name}</div>
                  <div className="phone-row-sub">${p.price} · stock {p.stock}</div>
                </div>
                {selected.ownerId === character?.id && (
                  <button className="phone-mini-btn" onClick={() => act("/api/game/business/restock", { businessId: selected.id, productId: p.id, quantity: 10 })}>Restock +10</button>
                )}
                {selected.ownerId !== character?.id && (
                  <button className="phone-mini-btn ok" onClick={() => act("/api/game/business/buy", { productId: p.id })}>Buy</button>
                )}
              </div>
            ))}
            {(selected.posts || []).filter((p: any) => p.open).map((p: any) => (
              <div key={p.id} className="phone-card">
                <div className="phone-row-title">Hiring: {p.title}</div>
                <div className="phone-row-sub">${p.salary}/shift {p.minSkill ? `· ${p.minSkill}≥${p.minSkillVal}` : ""}</div>
                {selected.ownerId !== character?.id && (
                  <button className="phone-mini-btn ok" onClick={() => act("/api/game/business/apply", { postId: p.id })}>Apply</button>
                )}
              </div>
            ))}
            {selected.ownerId === character?.id && (
              <>
                <div className="bank-card" style={{ marginTop: 8 }}>
                  <div className="bank-label">Your role</div>
                  <div style={{ fontWeight: 700 }}>CEO / Owner</div>
                  <div className="phone-row-sub">You own this company. Hire staff below — they work shifts and you pay their salary from the business drawer or your money.</div>
                </div>
                <div className="phone-section">Manage</div>
                <button className="phone-btn full" onClick={() => act("/api/game/business/open-close", { businessId: selected.id, open: !selected.open })}>
                  {selected.open ? "Close" : "Open"} for business
                </button>
                <div className="phone-section">Hire as CEO</div>
                <div className="phone-chip-row" style={{ marginBottom: 8 }}>
                  {[
                    { title: "Manager", salary: "80" },
                    { title: "Worker", salary: "40" },
                    { title: "Cashier", salary: "35" },
                    { title: "Security", salary: "50" },
                    { title: "Chef", salary: "55" },
                  ].map((role) => (
                    <button
                      key={role.title}
                      type="button"
                      className={`phone-chip ${jobTitle === role.title ? "active" : ""}`}
                      onClick={() => { setJobTitle(role.title); setJobSalary(role.salary); }}
                    >
                      {role.title}
                    </button>
                  ))}
                </div>
                <input className="phone-input" placeholder="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                <input className="phone-input" type="number" placeholder="Salary per shift" value={jobSalary} onChange={(e) => setJobSalary(e.target.value)} />
                <button className="phone-btn ok full" onClick={() => act("/api/game/business/post-job", { businessId: selected.id, title: jobTitle, roleKey: jobTitle.toLowerCase().replace(/\s+/g, "_"), salary: Number(jobSalary) })}>
                  Post hiring job
                </button>
                {(selected.employees || []).filter((e: any) => e.active).length > 0 && (
                  <>
                    <div className="phone-section">Team ({(selected.employees || []).filter((e: any) => e.active).length})</div>
                    {(selected.employees || []).filter((e: any) => e.active).map((e: any) => (
                      <div key={e.id} className="phone-row">
                        <div className="phone-row-text">
                          <div className="phone-row-title">{e.character?.name || e.title || "Employee"}</div>
                          <div className="phone-row-sub">{e.title || e.roleKey} · ${e.salary || "?"}/shift</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <button className="phone-btn full" disabled={!(selected.balance > 0)} onClick={() => act("/api/game/business/withdraw", { businessId: selected.id, amount: selected.balance || 0 })}>
                  Withdraw drawer
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
