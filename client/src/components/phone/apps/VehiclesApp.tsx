import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function VehiclesApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function refresh() {
    fetch(`${API}/api/game/vehicles/catalog`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setCatalog(d)).catch(() => {});
    fetch(`${API}/api/game/vehicles/mine`, { headers }).then((r) => r.json()).then((d) => Array.isArray(d) && setMine(d)).catch(() => {});
  }
  useEffect(() => { if (token) refresh(); }, [token]);

  async function buy(type: string) {
    const r = await fetch(`${API}/api/game/vehicles/buy`, { method: "POST", headers, body: JSON.stringify({ type }) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
      if (d.vehicle?.speed) {
        try { localStorage.setItem("life-sim-vehicle-speed", String(d.vehicle.speed)); } catch {}
      }
    }
  }

  async function drive(id: string) {
    const r = await fetch(`${API}/api/game/vehicles/drive`, { method: "POST", headers, body: JSON.stringify({ vehicleId: id }) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message + ` · speed boost ${d.speed}`);
      try { localStorage.setItem("life-sim-vehicle-speed", String(d.speed)); } catch {}
    }
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Vehicles</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        <div className="phone-section">Dealership</div>
        {catalog.map((v) => (
          <div key={v.type} className="phone-card">
            <div className="phone-row-title">{v.name}</div>
            <div className="phone-row-sub">${v.price} · speed {v.speed}</div>
            <button className="phone-mini-btn ok" onClick={() => buy(v.type)}>Buy</button>
          </div>
        ))}
        <div className="phone-section">Your garage</div>
        {mine.length === 0 && <p className="phone-empty">No vehicles yet</p>}
        {mine.map((v) => (
          <div key={v.id} className="phone-card">
            <div className="phone-row-title">{v.name}</div>
            <div className="phone-row-sub">{v.type} · speed {v.speed}</div>
            <button className="phone-mini-btn ok" onClick={() => drive(v.id)}>Drive</button>
          </div>
        ))}
      </div>
    </div>
  );
}
