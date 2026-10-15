import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

type FurnitureDef = {
  key: string;
  name: string;
  description: string;
  category: string;
  price: number;
  icon: string;
  defaultX: number;
  defaultZ: number;
  actions: string[];
};

type FurnitureItem = {
  id: string;
  furnitureKey: string;
  x: number;
  z: number;
  rotation: number;
  isOn?: boolean;
  lastUsedAt?: string;
};

const ROOM_POSITIONS: Record<string, { label: string; x: number; z: number }> = {
  living: { label: "Living room", x: -5.2, z: 3.5 },
  bedroom: { label: "Bedroom", x: -6.2, z: -5.2 },
  kitchen: { label: "Kitchen", x: 3.3, z: -5.2 },
  bathroom: { label: "Bathroom", x: 7.1, z: -5.7 },
  study: { label: "Study corner", x: 2.4, z: 4.9 },
  dining: { label: "Dining area", x: 4.6, z: 2.5 },
};

const ACTION_LABELS: Record<string, string> = {
  sleep: "Sleep and restore energy",
  relax: "Relax",
  watch_tv: "Watch TV",
  get_snack: "Get a snack",
  cook: "Cook a meal",
  shower: "Take a shower",
  toggle: "Toggle light",
  work_on_computer: "Use computer",
  read: "Read a book",
  sit: "Sit down",
};

export function HomeApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [properties, setProperties] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<FurnitureDef[]>([]);
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [placementArea, setPlacementArea] = useState("living");
  const [msg, setMsg] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadProperties = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/game/properties`, { headers });
      if (response.ok) setProperties(await response.json());
    } catch { /* Show the rest of the phone even if the property list is offline. */ }
  }, [headers]);

  const loadHomeData = useCallback(async () => {
    if (!character?.homeId) return;
    try {
      const response = await fetch(`${API}/api/game/home/${character.homeId}/furniture`, { headers });
      if (!response.ok) return;
      const result = await response.json();
      if (Array.isArray(result.catalog)) setCatalog(result.catalog);
      if (Array.isArray(result.furniture)) setFurniture(result.furniture);
    } catch { /* Cached home view remains available. */ }
  }, [character?.homeId, headers]);

  useEffect(() => { void loadProperties(); }, [loadProperties]);
  useEffect(() => { void loadHomeData(); }, [loadHomeData]);

  if (!character) return null;
  const currentHome = properties.find((p) => p.id === character.homeId);
  const canChangeHome = !character.homeId || Boolean(currentHome?.isStarterHome);
  const insideCurrentHome = Boolean(character.homeId && character.location === `home_${character.homeId}`);

  async function refreshCharacter() {
    const response = await fetch(`${API}/api/game/character`, { headers });
    if (response.ok) setCharacter(await response.json());
  }

  async function post(path: string, body: object = {}, key = path): Promise<boolean> {
    if (busyKey) return false;
    setBusyKey(key);
    try {
      const response = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        setMsg(result.error || "That action failed");
        return false;
      }
      setMsg(result.message || "Done");
      if (Array.isArray(result.furniture)) setFurniture(result.furniture);
      await Promise.all([refreshCharacter(), loadProperties(), loadHomeData()]);
      window.dispatchEvent(new Event("life-sim:home-furniture-updated"));
      return true;
    } catch {
      setMsg("Could not connect to the game server. Please try again.");
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function propertyAction(path: string, body: object = {}) {
    await post(path, body, path);
  }

  async function buyAndPlace(def: FurnitureDef) {
    if (!character.homeId) return;
    const room = ROOM_POSITIONS[placementArea];
    await post(`/api/game/home/${character.homeId}/furniture/place`, {
      furnitureKey: def.key,
      x: room.x ?? def.defaultX,
      z: room.z ?? def.defaultZ,
      rotation: 0,
    }, `place-${def.key}`);
  }

  async function move(item: FurnitureItem) {
    if (!character.homeId) return;
    const room = ROOM_POSITIONS[placementArea];
    await post(`/api/game/home/${character.homeId}/furniture/move`, {
      furnitureId: item.id, x: room.x, z: room.z, rotation: item.rotation,
    }, `move-${item.id}`);
  }

  async function useFurniture(item: FurnitureItem, action: string) {
    if (!character.homeId) return;
    const succeeded = await post(`/api/game/home/${character.homeId}/interact`, { furnitureId: item.id, action }, `use-${item.id}`);
    if (succeeded && action !== "toggle" && insideCurrentHome) {
      window.dispatchEvent(new CustomEvent("life-sim:character-action", {
        detail: { propertyId: character.homeId, furniture: item, action },
      }));
    }
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Home & Furniture</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}

        {character.homeId ? (
          <div className="bank-card" style={{ marginBottom: 12 }}>
            <div className="bank-label">Your home</div>
            <div className="phone-row-title" style={{ marginTop: 5 }}>{currentHome?.name || "Personal home"}</div>
            <div className="phone-row-sub">{insideCurrentHome ? "You are inside your home" : "Enter your home to place, move, or use furniture."}</div>
            <div className="phone-btn-row" style={{ marginTop: 8 }}>
              {!insideCurrentHome ? (
                <button className="phone-btn ok" onClick={() => propertyAction("/api/game/location/enter", { locationKey: `home_${character.homeId}` })} disabled={!!busyKey}>Enter Home</button>
              ) : (
                <button className="phone-btn ok" onClick={() => propertyAction("/api/game/location/exit")} disabled={!!busyKey}>Step Outside</button>
              )}
            </div>
          </div>
        ) : (
          <p className="phone-empty">No home yet — rent or buy a property below.</p>
        )}

        <div className="phone-section">Your furniture · {furniture.length} items</div>
        {!furniture.length ? (
          <p className="phone-empty">Your house is empty. Buy your first piece of furniture to make it feel like home.</p>
        ) : furniture.map((item) => {
          const def = catalog.find((entry) => entry.key === item.furnitureKey);
          return <div key={item.id} className="phone-card">
            <div className="phone-row-title">{def?.icon || "🪑"} {def?.name || item.furnitureKey}</div>
            <div className="phone-row-sub">Position: {item.x.toFixed(1)}, {item.z.toFixed(1)} {item.isOn === undefined ? "" : `· ${item.isOn ? "Light on" : "Light off"}`}</div>
            {def?.actions?.length ? <div className="phone-btn-row" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {def.actions.map((action) => <button key={action} className="phone-mini-btn" onClick={() => useFurniture(item, action)} disabled={!insideCurrentHome || !!busyKey}>
                {ACTION_LABELS[action] || action}
              </button>)}
              <button className="phone-mini-btn" onClick={() => move(item)} disabled={!insideCurrentHome || !!busyKey}>Move to {ROOM_POSITIONS[placementArea].label}</button>
              <button className="phone-mini-btn bad" onClick={() => propertyAction(`/api/game/home/${character.homeId}/furniture/remove`, { furnitureId: item.id })} disabled={!insideCurrentHome || !!busyKey}>Sell</button>
            </div> : null}
          </div>;
        })}

        <div className="phone-section">Place furniture</div>
        <div className="phone-card">
          <div className="phone-row-title">Choose a room</div>
          <select className="phone-input" value={placementArea} onChange={(event) => setPlacementArea(event.target.value)} style={{ marginTop: 8 }}>
            {Object.entries(ROOM_POSITIONS).map(([key, room]) => <option key={key} value={key}>{room.label}</option>)}
          </select>
          <div className="phone-row-sub">Furniture is saved to your property. The server will find a nearby free space if the selected spot is occupied.</div>
        </div>
        {catalog.map((def) => <div key={def.key} className="phone-card">
          <div className="phone-row-title">{def.icon} {def.name}</div>
          <div className="phone-row-sub">{def.description}</div>
          <div className="phone-row-sub" style={{ marginTop: 4 }}>${def.price} · {def.category}</div>
          <button className="phone-mini-btn ok" style={{ marginTop: 8 }} disabled={!insideCurrentHome || !!busyKey} onClick={() => buyAndPlace(def)}>
            {busyKey === `place-${def.key}` ? "Placing…" : `Buy & Place · $${def.price}`}
          </button>
        </div>)}

        <div className="phone-section">Other properties</div>
        {properties.filter((p) => p.id !== character.homeId).map((p) => (
          <div key={p.id} className="phone-card">
            <div className="phone-row-title">{p.name}</div>
            <div className="phone-row-sub">{p.type} · Buy ${p.price}{p.rent > 0 ? ` · Rent $${p.rent}/mo` : ""}</div>
            <div className="phone-row-sub" style={{ color: p.ownerId || p.tenantId ? "#ff6b6b" : "#00b894" }}>
              {p.ownerId || p.tenantId ? "Occupied" : "Available"}
            </div>
            {!p.ownerId && !p.tenantId && canChangeHome && (
              <div className="phone-btn-row" style={{ marginTop: 6 }}>
                {p.rent > 0 && <button className="phone-mini-btn" disabled={!!busyKey} onClick={() => propertyAction("/api/game/properties/rent", { propertyId: p.id })}>Rent</button>}
                <button className="phone-mini-btn ok" disabled={!!busyKey} onClick={() => propertyAction("/api/game/properties/buy", { propertyId: p.id })}>Buy</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
