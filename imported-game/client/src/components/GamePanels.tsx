import { useState, useEffect } from "react";
import { useGameStore } from "../stores/gameStore";
import { SocialBankPanels } from "./SocialBankPanels";
import type { ItemDef, InventoryItem } from "@life-sim/shared";
import { BUILDINGS } from "@life-sim/shared";

const API = import.meta.env.VITE_SERVER_URL || "";

type Panel = "none" | "inventory" | "jobs" | "shop" | "character";

interface Job {
  id: string;
  name: string;
  description: string;
  basePay: number;
  requirements: Record<string, number>;
  schedule: { start: number; end: number };
  location: string;
  maxLevel: number;
}

interface Shop {
  key: string;
  name: string;
  description: string;
  items: { itemKey: string; priceOverride?: number }[];
}

export function GamePanels() {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [panel, setPanel] = useState<Panel>("none");
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<"friends" | "messages" | "bank" | "housing">("friends");
  const [items, setItems] = useState<ItemDef[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [nearbyBuilding, setNearbyBuilding] = useState<string | null>(null);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/game/items`, { headers }).then((r) => r.json()).then(setItems).catch(() => {});
    fetch(`${API}/api/game/jobs`, { headers }).then((r) => r.json()).then(setJobs).catch(() => {});
    fetch(`${API}/api/game/shops`, { headers }).then((r) => r.json()).then(setShops).catch(() => {});
  }, [token]);

  // Check nearby buildings periodically from character position (client-side hint)
  useEffect(() => {
    if (!character || character.location !== "city") {
      setNearbyBuilding(null);
      return;
    }
    const check = () => {
      const pos = character.position;
      for (const [key, b] of Object.entries(BUILDINGS)) {
        const dx = pos.x - b.x;
        const dz = pos.z - b.z;
        if (Math.sqrt(dx * dx + dz * dz) < b.radius) {
          setNearbyBuilding(key);
          return;
        }
      }
      setNearbyBuilding(null);
    };
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, [character?.position?.x, character?.position?.z, character?.location]);

  async function refreshCharacter() {
    const r = await fetch(`${API}/api/game/character`, { headers });
    if (r.ok) setCharacter(await r.json());
  }

  async function apiPost(path: string, body: object) {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setMsg(data.message || "OK");
      await refreshCharacter();
      return data;
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  function itemDef(key: string) {
    return items.find((i) => i.key === key);
  }

  async function enterNearby() {
    if (!nearbyBuilding) return;
    await apiPost("/api/game/location/enter", { locationKey: nearbyBuilding });
  }

  async function exitBuilding() {
    await apiPost("/api/game/location/exit", {});
  }

  if (!character) return null;

  const inv: InventoryItem[] = character.inventory || [];
  const inInterior = character.location && character.location !== "city";

  return (
    <>
      {/* Nearby building prompt */}
      {nearbyBuilding && !inInterior && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "12px 18px",
            zIndex: 15,
            pointerEvents: "auto",
            textAlign: "center",
            backdropFilter: "blur(12px)",
            color: "var(--text)",
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            {(BUILDINGS as any)[nearbyBuilding]?.name || nearbyBuilding}
          </div>
          <button
            onClick={enterNearby}
            disabled={loading}
            style={{
              padding: "8px 20px",
              background: "var(--success)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Enter
          </button>
        </div>
      )}

      {inInterior && (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 15,
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={exitBuilding}
            disabled={loading}
            style={{
              padding: "10px 18px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
              fontWeight: 600,
              backdropFilter: "blur(12px)",
            }}
          >
            Exit to City
          </button>
        </div>
      )}

      {/* Bottom action bar */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          zIndex: 20,
          pointerEvents: "auto",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "96vw",
        }}
      >
        {(
          [
            ["inventory", "🎒"],
            ["jobs", "💼"],
            ["shop", "🏪"],
            ["character", "👤"],
          ] as [Panel, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPanel(panel === key ? "none" : key)}
            style={{
              padding: "10px 12px",
              background: panel === key ? "var(--accent)" : "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 16,
              backdropFilter: "blur(12px)",
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            setSocialTab("friends");
            setSocialOpen(true);
          }}
          style={barBtn}
        >
          👥
        </button>
        <button
          onClick={() => {
            setSocialTab("bank");
            setSocialOpen(true);
          }}
          style={barBtn}
        >
          🏦
        </button>
        <button
          onClick={() => {
            setSocialTab("housing");
            setSocialOpen(true);
          }}
          style={barBtn}
        >
          🏠
        </button>
      </div>

      <SocialBankPanels
        open={socialOpen}
        onClose={() => setSocialOpen(false)}
        initialTab={socialTab}
      />

      {/* Panel modal */}
      {panel !== "none" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
          onClick={() => setPanel("none")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 20,
              width: "min(420px, 92vw)",
              maxHeight: "75vh",
              overflowY: "auto",
              color: "var(--text)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>
                {panel === "inventory" && "Inventory"}
                {panel === "jobs" && "Jobs"}
                {panel === "shop" && "Shops"}
                {panel === "character" && "Character"}
              </h2>
              <button
                onClick={() => setPanel("none")}
                style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {msg && (
              <div
                style={{
                  background: "rgba(108,92,231,0.2)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {msg}
              </div>
            )}

            {panel === "inventory" && (
              <div>
                {inv.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>Empty — buy food at a shop!</p>
                )}
                {inv.map((slot) => {
                  const def = itemDef(slot.itemKey);
                  return (
                    <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 22 }}>{def?.icon || "📦"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{def?.name || slot.itemKey} ×{slot.quantity}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{def?.description}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(def?.category === "food" || def?.category === "misc") && (
                          <button disabled={loading} onClick={() => apiPost("/api/game/inventory/use", { itemKey: slot.itemKey })} style={smallBtn}>
                            Use
                          </button>
                        )}
                        {def?.slot && (
                          <button disabled={loading} onClick={() => apiPost("/api/game/inventory/equip", { itemKey: slot.itemKey })} style={smallBtn}>
                            Equip
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {panel === "jobs" && (
              <div>
                {character.jobId ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      Current: {jobs.find((j) => j.id === character.jobId)?.name || "…"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                      Level {character.jobLevel} · XP {character.jobXp}
                    </div>
                    <button disabled={loading} onClick={() => apiPost("/api/game/jobs/work", {})} style={{ ...smallBtn, background: "var(--success)", width: "100%", marginBottom: 8, padding: 10 }}>
                      Work a Shift
                    </button>
                    <button disabled={loading} onClick={() => apiPost("/api/game/jobs/quit", {})} style={{ ...smallBtn, background: "var(--danger)", width: "100%", padding: 10 }}>
                      Quit Job
                    </button>
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)", marginBottom: 12 }}>Unemployed — apply below.</p>
                )}
                {jobs.map((job) => (
                  <div key={job.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600 }}>{job.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{job.description}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Pay: ${job.basePay}/shift</div>
                    {!character.jobId && (
                      <button disabled={loading} onClick={() => apiPost("/api/game/jobs/apply", { jobId: job.id })} style={{ ...smallBtn, marginTop: 6 }}>
                        Apply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {panel === "shop" && (
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  {shops.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSelectedShop(s.key)}
                      style={{ ...smallBtn, background: selectedShop === s.key ? "var(--accent)" : "rgba(255,255,255,0.06)" }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                {!selectedShop && <p style={{ color: "var(--muted)" }}>Select a shop</p>}
                {selectedShop &&
                  (shops.find((s) => s.key === selectedShop)?.items || []).map((listing) => {
                    const def = itemDef(listing.itemKey);
                    if (!def) return null;
                    const price = listing.priceOverride ?? def.price;
                    return (
                      <div key={listing.itemKey} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 22 }}>{def.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{def.name}</div>
                          <div style={{ fontSize: 13, color: "#55efc4" }}>${price}</div>
                        </div>
                        <button
                          disabled={loading}
                          onClick={() =>
                            apiPost("/api/game/shops/buy", {
                              itemKey: listing.itemKey,
                              quantity: 1,
                              shopKey: selectedShop,
                            })
                          }
                          style={smallBtn}
                        >
                          Buy
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {panel === "character" && (
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                <div>
                  <strong>{character.name}</strong> · Age {character.age} · {character.personality}
                </div>
                <div style={{ marginTop: 8, color: "var(--muted)" }}>Skills</div>
                <div>🧠 Intelligence: {character.skills.intelligence.toFixed(0)}</div>
                <div>💪 Strength: {character.skills.strength.toFixed(0)}</div>
                <div>😊 Charisma: {character.skills.charisma.toFixed(0)}</div>
                <div>🎨 Creativity: {character.skills.creativity.toFixed(0)}</div>
                <div>🍳 Cooking: {character.skills.cooking.toFixed(0)}</div>
                <div>🏃 Fitness: {character.skills.fitness.toFixed(0)}</div>
                <div style={{ marginTop: 8 }}>Cash: ${character.stats.money.toFixed(0)} · Bank: ${(character.stats.bankBalance ?? 0).toFixed(0)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const barBtn: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--text)",
  fontWeight: 600,
  fontSize: 16,
  backdropFilter: "blur(12px)",
};

const smallBtn: React.CSSProperties = {
  padding: "6px 12px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};
