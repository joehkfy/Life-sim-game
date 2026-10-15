import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

const MODE_ICON: Record<string, string> = {
  plane: "✈️",
  train: "🚆",
  bus: "🚌",
};

export function TravelApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [options, setOptions] = useState<any[]>([]);
  const [airports, setAirports] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "plane" | "train" | "bus">("all");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"routes" | "airports">("routes");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  function load() {
    fetch(`${API}/api/game/travel/options`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setOptions(d))
      .catch(() => {});
    fetch(`${API}/api/game/travel/airports`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setAirports(d))
      .catch(() => {});
  }

  useEffect(() => {
    if (token) load();
  }, [token, character?.stats?.money]);

  async function book(routeId: string) {
    setMsg("");
    const r = await fetch(`${API}/api/game/world/travel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ routeId }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
      load();
    }
  }

  const filtered =
    filter === "all" ? options : options.filter((o) => o.mode === filter);

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Travel</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}

        <div className="phone-btn-row" style={{ marginBottom: 8 }}>
          <button className={`phone-btn ${tab === "routes" ? "ok" : ""}`} style={{ flex: 1 }} onClick={() => setTab("routes")}>
            Routes
          </button>
          <button className={`phone-btn ${tab === "airports" ? "ok" : ""}`} style={{ flex: 1 }} onClick={() => setTab("airports")}>
            Airports
          </button>
        </div>

        {tab === "routes" && (
          <>
            <p className="phone-empty" style={{ textAlign: "left", padding: "0 0 8px" }}>
              From your city. ✈️ Plane = go to airport first. 🚆 Train = station. 🚌 Bus = city board.
            </p>
            <div className="phone-chip-row">
              {(["all", "plane", "train", "bus"] as const).map((m) => (
                <button
                  key={m}
                  className={`phone-chip ${filter === m ? "active" : ""}`}
                  onClick={() => setFilter(m)}
                >
                  {m === "all" ? "All" : MODE_ICON[m] + " " + m}
                </button>
              ))}
            </div>
            {filtered.length === 0 && <p className="phone-empty">No routes from here</p>}
            {filtered.map((r) => (
              <div key={r.id} className="phone-card">
                <div className="phone-row-title">
                  {MODE_ICON[r.mode] || "🚗"} {r.toFlag} {r.toCityName}
                </div>
                <div className="phone-row-sub">
                  {r.toCountry} · {r.mode} · ~{r.durationMins} min · ${r.price}
                </div>
                {r.fromHubCode && (
                  <div className="phone-row-sub">Via {r.fromHubCode} → {r.toHubCode}</div>
                )}
                <button className="phone-mini-btn ok" style={{ marginTop: 6 }} onClick={() => book(r.id)}>
                  Book ${r.price}
                </button>
              </div>
            ))}
          </>
        )}

        {tab === "airports" && (
          <>
            <p className="phone-empty" style={{ textAlign: "left", padding: "0 0 8px" }}>
              Walk to the airport in the 3D city (corner of the map) to board flights.
            </p>
            {airports.map((a) => (
              <div key={a.code} className="phone-card">
                <div className="phone-row-title">✈️ {a.code} · {a.name}</div>
                <div className="phone-row-sub">
                  City: {a.cityKey} · {a.size}
                  {a.international ? " · International" : ""}
                </div>
                <div className="phone-row-sub">Map pos ({a.posX}, {a.posZ})</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
