import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";
import { BUILDINGS } from "@life-sim/shared";

const API = import.meta.env.VITE_SERVER_URL || "";
const WORLD_MIN = -45;
const WORLD_MAX = 45;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;

const BUILDING_ICONS: Record<string, string> = {
  shop: "🏪",
  restaurant: "🍽️",
  school: "🏫",
  university: "🎓",
  hospital: "🏥",
  police: "🚓",
  gym: "💪",
  apartments: "🏢",
  park: "🌳",
  house: "🏠",
  cafe: "☕",
  office: "🏢",
  studio: "🎨",
  club: "🎉",
};

type View = "world" | "city";

function worldToPct(x: number, z: number) {
  return {
    left: ((x - WORLD_MIN) / WORLD_SIZE) * 100,
    top: ((z - WORLD_MIN) / WORLD_SIZE) * 100,
  };
}

function dist(ax: number, az: number, bx: number, bz: number) {
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
}

function bearingLabel(fromX: number, fromZ: number, toX: number, toZ: number) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const angle = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round(((angle + 360) % 360) / 45) % 8;
  return dirs[i];
}

export function MapApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);

  const [world, setWorld] = useState<any>(null);
  const [mapTab, setMapTab] = useState<"local" | "world">("local");
  useEffect(() => {
    fetch(`${API}/api/game/world/summary`)
      .then((r) => r.json())
      .then(setWorld)
      .catch(() => {});
  }, []);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const otherPlayers = useGameStore((s) => s.otherPlayers);

  const [view, setView] = useState<View>("city");
  const [countries, setCountries] = useState<any[]>([]);
  const [playerBuildings, setPlayerBuildings] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [buildingTypes, setBuildingTypes] = useState<any[]>([]);
  const [cityKey, setCityKey] = useState("starter");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<any | null>(null);
  const [navTarget, setNavTarget] = useState<{ name: string; x: number; z: number; key?: string } | null>(null);
  const [showPlayers, setShowPlayers] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [msg, setMsg] = useState("");
  const [buildName, setBuildName] = useState("");
  const [buildType, setBuildType] = useState("house");
  const dragging = useRef(false);
  const lastPtr = useRef({ x: 0, y: 0 });

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/game/world/countries`, { headers })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCountries(d);
      })
      .catch(() => {});
    fetch(`${API}/api/game/world/building-types`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setBuildingTypes(d))
      .catch(() => {});
  }, [token]);

  const loadCityData = useCallback(
    (key: string) => {
      if (!token) return;
      fetch(`${API}/api/game/world/cities/${key}/buildings`, { headers })
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setPlayerBuildings(d))
        .catch(() => setPlayerBuildings([]));
      fetch(`${API}/api/game/world/cities/${key}/plots`, { headers })
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setPlots(d))
        .catch(() => setPlots([]));
    },
    [token]
  );

  useEffect(() => {
    loadCityData(cityKey);
  }, [cityKey, loadCityData]);

  const official = useMemo(
    () =>
      Object.values(BUILDINGS).map((b) => ({
        ...b,
        ...worldToPct(b.x, b.z),
        icon: BUILDING_ICONS[b.key] || "📍",
        kind: "official" as const,
      })),
    []
  );

  const custom = useMemo(
    () =>
      playerBuildings.map((b) => ({
        key: `pb_${b.id}`,
        name: b.name,
        x: b.posX,
        z: b.posZ,
        ...worldToPct(b.posX, b.posZ),
        icon: BUILDING_ICONS[b.buildingType] || "🏗️",
        kind: "player" as const,
        buildingType: b.buildingType,
        ownerId: b.ownerId,
        id: b.id,
      })),
    [playerBuildings]
  );

  const plotMarkers = useMemo(
    () =>
      plots
        .filter((p) => !p.building)
        .map((p) => ({
          ...p,
          ...worldToPct(p.posX, p.posZ),
        })),
    [plots]
  );

  const you = character
    ? worldToPct(character.position.x, character.position.z)
    : { left: 50, top: 50 };

  const players = useMemo(
    () =>
      Array.from(otherPlayers.values()).map((p) => ({
        id: p.id,
        name: p.name,
        ...worldToPct(p.position.x, p.position.z),
      })),
    [otherPlayers]
  );

  const navInfo = useMemo(() => {
    if (!navTarget || !character) return null;
    const d = dist(character.position.x, character.position.z, navTarget.x, navTarget.z);
    return {
      distance: d,
      dir: bearingLabel(character.position.x, character.position.z, navTarget.x, navTarget.z),
      arrived: d < 6,
    };
  }, [navTarget, character?.position.x, character?.position.z]);

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    lastPtr.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPtr.current.x;
    const dy = e.clientY - lastPtr.current.y;
    lastPtr.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function onPointerUp() {
    dragging.current = false;
  }

  function centerOnPlayer() {
    if (!character) return;
    const pct = worldToPct(character.position.x, character.position.z);
    setPan({ x: (50 - pct.left) * zoom, y: (50 - pct.top) * zoom });
  }


  async function travelTo(targetCityKey: string) {
    setMsg("");
    const r = await fetch(`${API}/api/game/world/travel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ cityKey: targetCityKey }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Travel failed");
    else {
      setMsg(d.message);
      setCityKey(targetCityKey);
      setView("city");
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
      loadCityData(targetCityKey);
    }
  }

  async function buyPlot(plotId: string) {
    setMsg("");
    const r = await fetch(`${API}/api/game/world/plots/buy`, {
      method: "POST",
      headers,
      body: JSON.stringify({ plotId }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      loadCityData(cityKey);
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  async function buildOnPlot() {
    if (!selectedPlot || !buildName.trim()) {
      setMsg("Pick a plot and name your building");
      return;
    }
    setMsg("");
    const r = await fetch(`${API}/api/game/world/build`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        plotId: selectedPlot.id,
        buildingType: buildType,
        name: buildName.trim(),
      }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      setSelectedPlot(null);
      setBuildName("");
      loadCityData(cityKey);
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  if (!character) return null;

  const selectedOfficial = selected && !selected.startsWith("pb_") ? (BUILDINGS as any)[selected] : null;
  const selectedPlayer = selected?.startsWith("pb_")
    ? custom.find((c) => c.key === selected)
    : null;

  // ——— WORLD VIEW ———
  if (view === "world") {
    return (
      <div className="phone-app">
        <div className="phone-app-header">
          <button className="phone-back" onClick={onBack}>‹</button>
          <span>World</span>
          <button className="phone-header-action" onClick={() => setView("city")}>City</button>
        </div>
        <div className="phone-app-body">
          <div className="world-map">
            {/* Simple stylized world background */}
            <div className="world-ocean" />
            {countries.map((c) => (
              <button
                key={c.code}
                className="world-country"
                style={{ left: `${c.mapX}%`, top: `${c.mapY}%` }}
                onClick={() => {
                  const first = c.cities?.[0];
                  if (first) {
                    setCityKey(first.key);
                    setView("city");
                    setPan({ x: 0, y: 0 });
                  }
                }}
                title={c.name}
              >
                <span className="world-flag">{c.flag}</span>
                <span className="world-name">{c.name}</span>
              </button>
            ))}
          </div>
          <p className="phone-empty" style={{ paddingTop: 8 }}>
            {countries.length} countries on the map. Tap a pin or expand a country for states & cities.
            Only your current city is drawn in 3D.
          </p>
          <div className="phone-section">
            Countries ({countries.length})
            {world?.stateCount != null ? ` · ${world.stateCount} states` : ""}
            {world?.cityCount != null ? ` · ${world.cityCount} cities` : ""}
          </div>
          {countries.map((c) => (
            <div key={c.code} className="phone-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{c.flag}</span>
                <div className="phone-row-text">
                  <div className="phone-row-title">{c.name}</div>
                  <div className="phone-row-sub">
                    {c.currencySymbol || ""} {c.currencyCode || ""}
                    {" · "}
                    {c._count?.states ?? c.states?.length ?? "?"} states
                    {" · "}
                    {c._count?.cities ?? c.cities?.length ?? "?"} cities
                  </div>
                </div>
              </div>
              {(c.states || []).length > 0 && (
                <div className="phone-row-sub" style={{ marginTop: 6 }}>
                  States: {(c.states || []).slice(0, 8).map((s: any) => s.name).join(", ")}
                  {(c.states || []).length > 8 ? "…" : ""}
                </div>
              )}
              <div className="phone-chip-row" style={{ marginTop: 8 }}>
                {(c.cities || []).slice(0, 6).map((ci: any) => (
                  <button
                    key={ci.key}
                    className="phone-chip"
                    onClick={() => travelTo(ci.key)}
                  >
                    {ci.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ——— CITY VIEW ———
  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Maps</span>
        <button className="phone-header-action" onClick={() => setView("world")}>🌍</button>
      </div>

      <div className="phone-app-body map-body">
        {msg && <div className="phone-toast">{msg}</div>}

        {navTarget && navInfo && (
          <div className={`map-nav-banner ${navInfo.arrived ? "arrived" : ""}`}>
            {navInfo.arrived ? (
              <>
                <span>Arrived at {navTarget.name}</span>
                <button onClick={() => setNavTarget(null)}>Clear</button>
              </>
            ) : (
              <>
                <span>
                  → {navInfo.dir} · {navInfo.distance.toFixed(0)}m · {navTarget.name}
                </span>
                <button onClick={() => setNavTarget(null)}>✕</button>
              </>
            )}
          </div>
        )}

        <div className="map-viewport">
          <div
            className="map-canvas"
            style={{ width: 280, height: 280, cursor: "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={() => {
              setSelected(null);
              setSelectedPlot(null);
            }}
          >
            <div
              className="map-world"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <svg className="map-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="44" y="0" width="12" height="100" fill="rgba(50,50,58,0.95)" />
                <rect x="0" y="44" width="100" height="12" fill="rgba(50,50,58,0.95)" />
                <circle cx="50" cy="50" r="14" fill="rgba(45,120,80,0.55)" />
              </svg>

              {/* Empty plots */}
              {plotMarkers.map((p) => (
                <button
                  key={p.id}
                  className={`map-plot ${selectedPlot?.id === p.id ? "selected" : ""}`}
                  style={{ left: `${p.left}%`, top: `${p.top}%` }}
                  title={p.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlot(p);
                    setSelected(null);
                  }}
                >
                  ⬜
                </button>
              ))}

              {/* Official buildings */}
              {official.map((b) => (
                <button
                  key={b.key}
                  className={`map-marker ${selected === b.key ? "selected" : ""}`}
                  style={{ left: `${b.left}%`, top: `${b.top}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(b.key);
                    setSelectedPlot(null);
                  }}
                >
                  {b.icon}
                </button>
              ))}

              {/* Player buildings */}
              {custom.map((b) => (
                <button
                  key={b.key}
                  className={`map-marker player-built ${selected === b.key ? "selected" : ""}`}
                  style={{ left: `${b.left}%`, top: `${b.top}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(b.key);
                    setSelectedPlot(null);
                  }}
                  title={b.name}
                >
                  {b.icon}
                </button>
              ))}

              {showPlayers &&
                players.map((p) => (
                  <div
                    key={p.id}
                    className="map-player-dot other"
                    style={{ left: `${p.left}%`, top: `${p.top}%` }}
                    title={p.name}
                  />
                ))}

              <div
                className="map-player-dot you"
                style={{ left: `${you.left}%`, top: `${you.top}%` }}
              />

              {navTarget && (
                <svg className="map-nav-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line
                    x1={you.left}
                    y1={you.top}
                    x2={worldToPct(navTarget.x, navTarget.z).left}
                    y2={worldToPct(navTarget.x, navTarget.z).top}
                    stroke="#a29bfe"
                    strokeWidth="0.6"
                    strokeDasharray="2 1.5"
                  />
                </svg>
              )}
            </div>
          </div>

          <div className="map-controls">
            <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>+</button>
            <button onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}>−</button>
            <button onClick={centerOnPlayer}>◎</button>
            <button onClick={() => setShowPlayers((v) => !v)}>{showPlayers ? "👥" : "👤"}</button>
          </div>
        </div>

        {/* Info panel */}
        <div className="map-info">
          {selectedPlot ? (
            <>
              <div className="map-info-title">🏗️ {selectedPlot.name}</div>
              <div className="map-info-sub">
                Empty plot · ${selectedPlot.price}
                {selectedPlot.ownerId ? " · Owned" : " · For sale"}
              </div>
              {!selectedPlot.ownerId && (
                <button className="phone-btn full" style={{ marginTop: 8 }} onClick={() => buyPlot(selectedPlot.id)}>
                  Buy plot ${selectedPlot.price}
                </button>
              )}
              {selectedPlot.ownerId === character.id && (
                <div style={{ marginTop: 8 }}>
                  <input
                    className="phone-input"
                    placeholder="Building name"
                    value={buildName}
                    onChange={(e) => setBuildName(e.target.value)}
                  />
                  <div className="phone-chip-row">
                    {buildingTypes.map((t) => (
                      <button
                        key={t.key}
                        className={`phone-chip ${buildType === t.key ? "active" : ""}`}
                        onClick={() => setBuildType(t.key)}
                      >
                        {t.icon} {t.name} ${t.cost}
                      </button>
                    ))}
                  </div>
                  <button className="phone-btn ok full" onClick={buildOnPlot}>
                    Build
                  </button>
                </div>
              )}
              <button
                className="phone-btn full"
                style={{ marginTop: 6 }}
                onClick={() =>
                  setNavTarget({
                    name: selectedPlot.name,
                    x: selectedPlot.posX,
                    z: selectedPlot.posZ,
                  })
                }
              >
                Go here
              </button>
            </>
          ) : selectedOfficial ? (
            <>
              <div className="map-info-title">
                {BUILDING_ICONS[selected!] || "📍"} {selectedOfficial.name}
              </div>
              <div className="map-info-sub">City building · walk near and Enter</div>
              <button
                className="phone-btn full"
                style={{ marginTop: 8 }}
                onClick={() =>
                  setNavTarget({
                    name: selectedOfficial.name,
                    x: selectedOfficial.x,
                    z: selectedOfficial.z,
                    key: selected!,
                  })
                }
              >
                Go here
              </button>
            </>
          ) : selectedPlayer ? (
            <>
              <div className="map-info-title">
                {selectedPlayer.icon} {selectedPlayer.name}
              </div>
              <div className="map-info-sub">
                Player-built {selectedPlayer.buildingType}
                {selectedPlayer.ownerId === character.id ? " · Yours" : ""}
              </div>
              <button
                className="phone-btn full"
                style={{ marginTop: 8 }}
                onClick={() =>
                  setNavTarget({
                    name: selectedPlayer.name,
                    x: selectedPlayer.x,
                    z: selectedPlayer.z,
                  })
                }
              >
                Go here
              </button>
            </>
          ) : (
            <>
              <div className="map-info-title">City map · {cityKey}</div>
              <div className="map-info-sub">
                ⬜ empty plots · 🏗️ player buildings · drag/zoom · 🌍 world
              </div>
              <div className="map-info-coords">
                You: ({character.position.x.toFixed(0)}, {character.position.z.toFixed(0)})
              </div>
            </>
          )}
        </div>

        <div className="phone-section">Player buildings ({custom.length})</div>
        {custom.length === 0 && (
          <p className="phone-empty">No player buildings yet — buy a plot, start construction, hire real bricklayers & trades.</p>
        )}
        {custom.map((b) => (
          <button
            key={b.key}
            className="phone-row"
            onClick={() => {
              setSelected(b.key);
              setNavTarget({ name: b.name, x: b.x, z: b.z });
            }}
          >
            <span>{b.icon}</span>
            <div className="phone-row-text">
              <div className="phone-row-title">{b.name}</div>
              <div className="phone-row-sub">{b.buildingType}</div>
            </div>
            <span>Go</span>
          </button>
        ))}
      </div>
    </div>
  );
}
