import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function InventoryApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/game/items`, { headers }).then((r) => r.json()).then(setItems).catch(() => {});
  }, [token]);

  async function act(path: string, itemKey: string) {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ itemKey }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message || "OK");
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  if (!character) return null;
  const inv = character.inventory || [];

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Bag</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        {inv.length === 0 && <p className="phone-empty">Empty — buy items in Shop</p>}
        {inv.map((slot: any) => {
          const def = items.find((i) => i.key === slot.itemKey);
          return (
            <div key={slot.id} className="phone-row">
              <span style={{ fontSize: 22 }}>{def?.icon || "📦"}</span>
              <div className="phone-row-text">
                <div className="phone-row-title">{def?.name || slot.itemKey} ×{slot.quantity}</div>
                <div className="phone-row-sub">{def?.description}</div>
              </div>
              {(def?.category === "food" || def?.category === "misc") && (
                <button className="phone-mini-btn ok" onClick={() => act("/api/game/inventory/use", slot.itemKey)}>Use</button>
              )}
              {def?.slot && (
                <button className="phone-mini-btn" onClick={() => act("/api/game/inventory/equip", slot.itemKey)}>Equip</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
