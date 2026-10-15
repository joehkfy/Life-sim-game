import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function ShopApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [shops, setShops] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/game/shops`, { headers }).then((r) => r.json()).then(setShops).catch(() => {});
    fetch(`${API}/api/game/items`, { headers }).then((r) => r.json()).then(setItems).catch(() => {});
  }, [token]);

  async function buy(itemKey: string, shopKey: string) {
    const r = await fetch(`${API}/api/game/shops/buy`, {
      method: "POST",
      headers,
      body: JSON.stringify({ itemKey, quantity: 1, shopKey }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message || "Bought");
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  const shop = shops.find((s) => s.key === selected);

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={selected ? () => setSelected(null) : onBack}>‹</button>
        <span>{shop ? shop.name : "Shopping"}</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        {!selected ? (
          shops.map((s) => (
            <button key={s.key} className="phone-row" onClick={() => setSelected(s.key)}>
              <div className="phone-row-text">
                <div className="phone-row-title">{s.name}</div>
                <div className="phone-row-sub">{s.description}</div>
              </div>
              <span>›</span>
            </button>
          ))
        ) : (
          (shop?.items || []).map((listing: any) => {
            const def = items.find((i) => i.key === listing.itemKey);
            if (!def) return null;
            return (
              <div key={listing.itemKey} className="phone-row">
                <span style={{ fontSize: 22 }}>{def.icon}</span>
                <div className="phone-row-text">
                  <div className="phone-row-title">{def.name}</div>
                  <div className="phone-row-sub">${listing.priceOverride ?? def.price}</div>
                </div>
                <button className="phone-mini-btn ok" onClick={() => buy(listing.itemKey, selected)}>
                  Buy
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
