import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useState } from "react";
import { City } from "./City";
import { Environment } from "./Environment";
import { PlayerBuildings } from "./PlayerBuildings";
import { Interior } from "./Interior";
import { Player } from "./Player";
import { OtherPlayer } from "./OtherPlayer";
import { LivingCityScene, LivingCityOverlay } from "./LivingCity";
import { DriveCars } from "./DriveCars";
import { useGameStore } from "../stores/gameStore";
import { useInputStore } from "../stores/inputStore";
import { HUD } from "../components/HUD";
import { StarterGoals } from "../components/StarterGoals";
import { Minimap } from "../components/Minimap";
import { NearbyPlayers } from "../components/NearbyPlayers";
import { WorldEventBanner } from "../components/WorldEventBanner";
import { Phone, type PhoneAppId } from "../components/phone/Phone";
import { MobileControls, useIsTouch } from "../components/MobileControls";
import { BUILDINGS } from "@life-sim/shared";

const keyMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump", keys: ["Space"] },
];

function Scene() {
  const character = useGameStore((s) => s.character);
  const otherPlayers = useGameStore((s) => s.otherPlayers);
  if (!character) return null;
  const inInterior = character.location && character.location !== "city";

  return (
    <>
      {!inInterior && (
        <>
          <Environment />
          <City />
          <PlayerBuildings />
          <LivingCityScene />
          <DriveCars />
        </>
      )}
      {inInterior && <Interior locationKey={character.location} />}
      <Player
        key={character.location || "city"}
        appearance={character.appearance}
        initialPosition={
          inInterior
            ? [0, 0, 3]
            : [character.position.x, character.position.y, character.position.z]
        }
        initialRotation={inInterior ? 0 : character.rotation ?? 0}
      />
      {!inInterior &&
        Array.from(otherPlayers.values()).map((p) => (
          <OtherPlayer key={p.id} player={p} />
        ))}
    </>
  );
}

function BuildingPrompt() {
  const character = useGameStore((s) => s.character);
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [busy, setBusy] = useState(false);

  if (!character || character.location !== "city") return null;

  let nearby: { key: string; name: string } | null = null;
  let best = Infinity;
  for (const [key, b] of Object.entries(BUILDINGS)) {
    if (!b.radius || b.radius <= 0) continue; // e.g. park — open area, not enterable
    if (key === "park") continue;
    const dx = character.position.x - b.x;
    const dz = character.position.z - b.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < b.radius && d < best) {
      best = d;
      nearby = { key, name: b.name };
    }
  }
  if (!nearby) return null;

  async function enter() {
    if (!nearby || !token || !character) return;
    setBusy(true);
    try {
      window.dispatchEvent(new CustomEvent("life-sim:play-emote", { detail: { animation: "open_door" } }));
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      const API = import.meta.env.VITE_SERVER_URL || "";
      const r = await fetch(`${API}/api/game/location/enter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationKey: nearby.key }),
      });
      const d = await r.json();
      if (r.ok) {
        setCharacter({ ...character, location: d.location || nearby.key });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "38%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 18px",
        zIndex: 15,
        pointerEvents: "auto",
        textAlign: "center",
        color: "var(--text)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{nearby.name}</div>
      <button
        onClick={enter}
        disabled={busy}
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
  );
}

interface HomeListing {
  id: string;
  name: string;
  posX: number;
  posZ: number;
  ownerId: string | null;
  tenantId: string | null;
  ownerName: string | null;
  isStarterHome: boolean;
}

function PersonalHomePrompt() {
  const character = useGameStore((s) => s.character);
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [homes, setHomes] = useState<HomeListing[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !character?.cityKey) return;
    let active = true;
    const load = async () => {
      try {
        const r = await fetch(`${import.meta.env.VITE_SERVER_URL || ""}/api/game/world/cities/${character.cityKey}/homes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (active && Array.isArray(data)) setHomes(data);
      } catch {
        // The player can still use the home app if the map feed is unavailable.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [token, character?.cityKey]);

  if (!character || character.location !== "city") return null;
  let nearby: HomeListing | null = null;
  let best = Infinity;
  for (const home of homes) {
    if (home.ownerId !== character.id && home.tenantId !== character.id) continue;
    const distance = Math.hypot(character.position.x - home.posX, character.position.z - home.posZ);
    if (distance < 6.5 && distance < best) {
      best = distance;
      nearby = home;
    }
  }
  if (!nearby) return null;

  async function enterHome() {
    if (!nearby || !token || !character) return;
    setBusy(true);
    try {
      window.dispatchEvent(new CustomEvent("life-sim:home-door", { detail: { id: nearby.id } }));
      await new Promise((resolve) => window.setTimeout(resolve, 640));
      const r = await fetch(`${import.meta.env.VITE_SERVER_URL || ""}/api/game/location/enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationKey: `home_${nearby.id}` }),
      });
      const result = await r.json();
      if (r.ok) setCharacter({ ...character, location: result.location || `home_${nearby.id}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%, -50%)", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", zIndex: 15, pointerEvents: "auto", textAlign: "center", color: "var(--text)", backdropFilter: "blur(12px)" }}>
      <div style={{ fontWeight: 700, marginBottom: 5 }}>🏠 Your Home</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 9 }}>{nearby.name}</div>
      <button onClick={enterHome} disabled={busy} style={{ padding: "8px 20px", background: "var(--success)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700 }}>
        {busy ? "Opening…" : "Enter Home"}
      </button>
    </div>
  );
}

/** In-building services: hospital / gym / school / restaurant / shop */
function InteriorActionPrompt() {
  const character = useGameStore((s) => s.character);
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!character || !character.location || character.location === "city") return null;
  if (String(character.location).startsWith("home_")) return null;

  const loc = character.location;
  type Act = { id: string; label: string; kind: "api" | "phone"; action?: string; app?: string };
  const acts: Act[] = [];
  if (loc === "hospital") acts.push({ id: "heal", label: "Get checkup (−$25, +health)", kind: "api", action: "heal" });
  if (loc === "gym") acts.push({ id: "workout", label: "Work out (−energy, +fitness)", kind: "api", action: "workout" });
  if (loc === "school" || loc === "university") acts.push({ id: "study", label: "Study (−energy, +intelligence)", kind: "api", action: "study" });
  if (loc === "restaurant") acts.push({ id: "eat", label: "Order a meal (−$18)", kind: "api", action: "eat" });
  if (loc === "shop" || loc.includes("shop")) acts.push({ id: "shop", label: "Open shop on phone", kind: "phone", app: "shop" });
  if (acts.length === 0) return null;

  async function run(a: Act) {
    if (!token || !character || busy) return;
    if (a.kind === "phone") {
      window.dispatchEvent(new CustomEvent("life-sim:open-phone", { detail: { app: a.app || "shop" } }));
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const API = import.meta.env.VITE_SERVER_URL || "";
      const r = await fetch(`${API}/api/game/location/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: a.action }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || "Failed");
        return;
      }
      setMsg(d.message || "Done");
      const cr = await fetch(`${API}/api/game/character`, { headers: { Authorization: `Bearer ${token}` } });
      if (cr.ok) setCharacter(await cr.json());
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 130,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 16,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        maxWidth: "min(360px, calc(100vw - 24px))",
      }}
    >
      {acts.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={busy}
          onClick={() => void run(a)}
          style={{
            padding: "10px 16px",
            background: "rgba(12,16,24,0.88)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 12,
            color: "#f2f4f8",
            fontWeight: 600,
            fontSize: 13,
            backdropFilter: "blur(12px)",
            cursor: busy ? "wait" : "pointer",
            width: "100%",
          }}
        >
          {busy ? "…" : a.label}
        </button>
      ))}
      {msg && <div style={{ fontSize: 12, color: "#a8e6cf", textShadow: "0 1px 4px #000" }}>{msg}</div>}
    </div>
  );
}

function ExitPrompt() {
  const character = useGameStore((s) => s.character);
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [busy, setBusy] = useState(false);
  if (!character || !character.location || character.location === "city") return null;

  async function exit() {
    if (!token || !character || busy) return;
    setBusy(true);
    try {
      window.dispatchEvent(new Event("life-sim:interior-door"));
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      const API = import.meta.env.VITE_SERVER_URL || "";
      const r = await fetch(`${API}/api/game/location/exit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "{}",
      });
      if (r.ok) {
        const d = await r.json();
        setCharacter({
          ...character,
          location: d.location || "city",
          position: d.position || character.position,
          rotation: d.rotation ?? character.rotation,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 15, pointerEvents: "auto", textAlign: "center" }}>
      <div style={{ color: "var(--text)", fontSize: 12, marginBottom: 6, textShadow: "0 1px 4px #000" }}>Front door</div>
      <button
        onClick={exit}
        disabled={busy}
        style={{
          padding: "10px 18px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          color: "var(--text)",
          fontWeight: 600,
          backdropFilter: "blur(12px)",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Opening door…" : "Open Door · Exit to City"}
      </button>
    </div>
  );
}

interface FurnitureTarget {
  propertyId: string;
  furniture: { id: string; furnitureKey: string; x: number; z: number; rotation?: number; isOn?: boolean };
}

const FURNITURE_ACTIONS: Record<string, Array<{ action: string; label: string }>> = {
  bed_basic: [{ action: "sleep", label: "Sleep" }],
  sofa_basic: [{ action: "relax", label: "Relax" }],
  tv_basic: [{ action: "watch_tv", label: "Watch TV" }],
  fridge_basic: [{ action: "get_snack", label: "Get a snack" }],
  stove_basic: [{ action: "cook", label: "Cook a meal" }],
  shower_basic: [{ action: "shower", label: "Take a shower" }],
  lamp_basic: [{ action: "toggle", label: "Switch light" }],
  desk_basic: [{ action: "work_on_computer", label: "Use computer" }],
  dining_table: [{ action: "sit", label: "Sit down" }],
  bookshelf_basic: [{ action: "read", label: "Read a book" }],
};

const FURNITURE_NAMES: Record<string, string> = {
  bed_basic: "Bed", sofa_basic: "Sofa", tv_basic: "Television", fridge_basic: "Refrigerator",
  stove_basic: "Kitchen stove", shower_basic: "Shower", lamp_basic: "Floor lamp",
  desk_basic: "Study desk", dining_table: "Dining table", bookshelf_basic: "Bookshelf",
};

function HomeInteractionPrompt() {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [target, setTarget] = useState<FurnitureTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onTarget = (event: Event) => {
      const detail = (event as CustomEvent<FurnitureTarget>).detail;
      if (detail?.propertyId && detail?.furniture?.id) {
        setTarget(detail);
        setMessage("");
      }
    };
    window.addEventListener("life-sim:interact-furniture", onTarget);
    return () => window.removeEventListener("life-sim:interact-furniture", onTarget);
  }, []);

  if (!target || !character || character.location !== `home_${target.propertyId}`) return null;
  const options = FURNITURE_ACTIONS[target.furniture.furnitureKey] || [];

  async function run(action: string) {
    if (!token || !target || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL || ""}/api/game/home/${target.propertyId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ furnitureId: target.furniture.id, action }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "That action failed.");
        return;
      }
      setMessage(result.message || "Done");
      window.dispatchEvent(new CustomEvent("life-sim:character-action", {
        detail: { propertyId: target.propertyId, furniture: target.furniture, action },
      }));
      const characterResponse = await fetch(`${import.meta.env.VITE_SERVER_URL || ""}/api/game/character`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (characterResponse.ok) setCharacter(await characterResponse.json());
      window.dispatchEvent(new Event("life-sim:home-furniture-updated"));
    } catch {
      setMessage("Could not connect to the game server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "absolute", left: "50%", bottom: 100, transform: "translateX(-50%)", width: "min(360px, calc(100% - 28px))", padding: 14, borderRadius: 14, background: "rgba(18, 26, 32, 0.92)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", zIndex: 18, backdropFilter: "blur(14px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>{FURNITURE_NAMES[target.furniture.furnitureKey] || "Home object"}</strong>
        <button onClick={() => setTarget(null)} aria-label="Close interaction" style={{ color: "#fff", background: "transparent", border: 0, fontSize: 20 }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {options.map((option) => <button key={option.action} onClick={() => void run(option.action)} disabled={busy} style={{ border: 0, borderRadius: 9, padding: "9px 12px", background: "#00a884", color: "white", fontWeight: 700 }}>
          {busy ? "Working…" : option.label}
        </button>)}
      </div>
      {message && <div style={{ fontSize: 12, color: "#d6e8e1", marginTop: 9 }}>{message}</div>}
      <div style={{ fontSize: 11, color: "#adb8bd", marginTop: 8 }}>Tip: you can also manage furniture from the Home app on your phone.</div>
    </div>
  );
}

/** Emotes map 1:1 to Donghua GLB clips (see RiggedAvatar ACTION_CLIPS). */
const EMOTE_OPTIONS: Array<{ animation: string; label: string; icon: string }> = [
  { animation: "wave", label: "Wave", icon: "👋" },
  { animation: "talk", label: "Talk", icon: "💬" },
  { animation: "laugh", label: "Laugh", icon: "😂" },
  { animation: "clap", label: "Clap", icon: "👏" },
  { animation: "shrug", label: "Shrug", icon: "🤷" },
  { animation: "point", label: "Point", icon: "👉" },
  { animation: "celebrate", label: "Celebrate", icon: "🙌" },
  { animation: "stretch", label: "Stretch", icon: "🧘" },
  { animation: "yawn", label: "Yawn", icon: "🥱" },
  { animation: "drink", label: "Drink", icon: "🥤" },
  { animation: "phone", label: "Phone", icon: "📱" },
  { animation: "phone_typing", label: "Text", icon: "⌨️" },
  { animation: "nod", label: "Nod", icon: "🙂" },
  { animation: "shake_head", label: "No", icon: "🙅" },
  { animation: "look_at", label: "Look around", icon: "👀" },
  { animation: "handshake", label: "Handshake", icon: "🤝" },
  { animation: "fist_bump", label: "Fist bump", icon: "👊" },
  { animation: "dance", label: "Dance", icon: "💃" },
  { animation: "sit", label: "Sit", icon: "🪑" },
  { animation: "crouch", label: "Crouch", icon: "🧎" },
  { animation: "kneel", label: "Kneel", icon: "🙇" },
  { animation: "pick_up", label: "Pick up", icon: "📦" },
  { animation: "carry", label: "Carry", icon: "🧰" },
  { animation: "put_down", label: "Put down", icon: "⬇️" },
  { animation: "idle_holding", label: "Hold item", icon: "📦" },
  { animation: "wash_hands", label: "Wash hands", icon: "🧼" },
  { animation: "brush_teeth", label: "Brush teeth", icon: "🪥" },
];

function EmotePanel({ isTouch }: { isTouch: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "absolute", top: 76, right: 12, zIndex: 20, color: "#fff", fontFamily: "inherit" }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Open character emotes"
        title="Character emotes"
        onClick={() => setOpen((value) => !value)}
        style={{ border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "9px 12px", background: "rgba(19,28,35,.92)", color: "white", boxShadow: "0 4px 18px rgba(0,0,0,.25)", fontWeight: 700 }}
      >🎭 {open ? "Close" : "Emotes"}</button>
      {open && (
        <div style={{ marginTop: 8, width: isTouch ? 208 : 268, maxHeight: "64vh", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 9, borderRadius: 14, background: "rgba(19,28,35,.96)", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 8px 28px rgba(0,0,0,.28)" }}>
          {EMOTE_OPTIONS.map((emote) => (
            <button
              type="button"
              key={emote.animation}
              onClick={() => {
                window.dispatchEvent(new CustomEvent("life-sim:play-emote", { detail: { animation: emote.animation } }));
                setOpen(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 7px", border: "1px solid rgba(255,255,255,.10)", borderRadius: 9, background: "rgba(255,255,255,.08)", color: "#fff", textAlign: "left", fontSize: 12 }}
            ><span style={{ fontSize: 17 }}>{emote.icon}</span><span>{emote.label}</span></button>
          ))}
          <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "#b8c3c9", padding: "3px 2px 0" }}>Space / JUMP: jump · Moving cancels an emote. Some gestures are demonstrations, not paired two-player interactions.</div>
        </div>
      )}
    </div>
  );
}

export function World() {
  const isTouch = useIsTouch();
  const setMobileMove = useInputStore((s) => s.setMobileMove);
  const setMobileRun = useInputStore((s) => s.setMobileRun);
  const setMobileJump = useInputStore((s) => s.setMobileJump);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneApp, setPhoneApp] = useState<PhoneAppId>("home");

  useEffect(() => {
    const onOpen = (e: Event) => {
      const app = (e as CustomEvent<{ app?: PhoneAppId }>).detail?.app || "shop";
      setPhoneApp(app);
      setPhoneOpen(true);
    };
    window.addEventListener("life-sim:open-phone", onOpen);
    return () => window.removeEventListener("life-sim:open-phone", onOpen);
  }, []);

  const onInteract = useCallback(() => {
    // Mobile USE: steal/enter car, exit car, future world interacts
    window.dispatchEvent(new CustomEvent("life-sim:interact"));
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <KeyboardControls map={keyMap}>
        <Canvas
          shadows
          camera={{ position: [0, 8, 15], fov: 60, near: 0.1, far: 360 }}
          gl={{ antialias: true, powerPreference: "high-performance", toneMapping: 3 }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </KeyboardControls>
      <HUD />
      <StarterGoals />
      <Minimap />
      <NearbyPlayers />
      <WorldEventBanner />
      <LivingCityOverlay />
      <BuildingPrompt />
      <PersonalHomePrompt />
      <ExitPrompt />
      <InteriorActionPrompt />
      <HomeInteractionPrompt />
      <EmotePanel isTouch={isTouch} />

      {/* Phone FAB */}
      <button
        className="phone-fab"
        title="Open phone"
        onClick={() => {
          setPhoneApp("home");
          setPhoneOpen(true);
        }}
      >
        📱
      </button>

      <Phone open={phoneOpen} onClose={() => setPhoneOpen(false)} initialApp={phoneApp} />

      <MobileControls
        visible={isTouch}
        onMove={setMobileMove}
        onRun={setMobileRun}
        onJump={setMobileJump}
        onInteract={onInteract}
      />
    </div>
  );
}
