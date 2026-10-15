import { useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { MapApp } from "./apps/MapApp";
import { MessagesApp } from "./apps/MessagesApp";
import { ContactsApp } from "./apps/ContactsApp";
import { BankApp } from "./apps/BankApp";
import { JobsApp } from "./apps/JobsApp";
import { ShopApp } from "./apps/ShopApp";
import { InventoryApp } from "./apps/InventoryApp";
import { HomeApp } from "./apps/HomeApp";
import { SettingsApp } from "./apps/SettingsApp";
import { ConstructionApp } from "./apps/ConstructionApp";
import { NotificationsApp } from "./apps/NotificationsApp";
import { MarketApp } from "./apps/MarketApp";
import { TravelApp } from "./apps/TravelApp";
import { BusinessApp } from "./apps/BusinessApp";
import { VehiclesApp } from "./apps/VehiclesApp";
import { SchoolApp } from "./apps/SchoolApp";
import { CompeteApp } from "./apps/CompeteApp";
import { ProfileApp } from "./apps/ProfileApp";

export type PhoneAppId =
  | "home"
  | "map"
  | "messages"
  | "contacts"
  | "bank"
  | "jobs"
  | "shop"
  | "inventory"
  | "housing"
  | "profile"
  | "settings"
  | "construction"
  | "notifications"
  | "market"
  | "travel"
  | "business"
  | "vehicles"
  | "school"
  | "compete";

const APPS: { id: PhoneAppId; icon: string; label: string; color: string }[] = [
  { id: "map", icon: "🗺️", label: "Maps", color: "#00b894" },
  { id: "messages", icon: "💬", label: "Messages", color: "#0984e3" },
  { id: "contacts", icon: "👥", label: "Contacts", color: "#6c5ce7" },
  { id: "bank", icon: "🏦", label: "Bank", color: "#fdcb6e" },
  { id: "jobs", icon: "💼", label: "Jobs", color: "#e17055" },
  { id: "shop", icon: "🛒", label: "Shop", color: "#fd79a8" },
  { id: "inventory", icon: "🎒", label: "Bag", color: "#00cec9" },
  { id: "housing", icon: "🏠", label: "Home", color: "#55efc4" },
  { id: "construction", icon: "🧱", label: "Build", color: "#e17055" },
  { id: "notifications", icon: "🔔", label: "Alerts", color: "#ff7675" },
  { id: "market", icon: "📦", label: "Market", color: "#00b894" },
  { id: "travel", icon: "✈️", label: "Travel", color: "#74b9ff" },
  { id: "business", icon: "🏢", label: "Biz", color: "#e17055" },
  { id: "vehicles", icon: "🚗", label: "Cars", color: "#636e72" },
  { id: "school", icon: "🎓", label: "School", color: "#0984e3" },
  { id: "compete", icon: "🏆", label: "Compete", color: "#fdcb6e" },
  { id: "profile", icon: "👤", label: "Me", color: "#a29bfe" },
  { id: "settings", icon: "⚙️", label: "Settings", color: "#636e72" },
];

interface PhoneProps {
  open: boolean;
  onClose: () => void;
  initialApp?: PhoneAppId;
}

export function Phone({ open, onClose, initialApp = "home" }: PhoneProps) {
  const [app, setApp] = useState<PhoneAppId>(initialApp);
  const character = useGameStore((s) => s.character);
  const worldTime = useGameStore((s) => s.worldTime);

  useEffect(() => {
    if (open) setApp(initialApp);
  }, [open, initialApp]);

  if (!open || !character) return null;

  const hours = Math.floor(worldTime) % 24;
  const mins = Math.floor((worldTime % 1) * 60);
  const timeStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

  function renderApp() {
    const goHome = () => setApp("home");
    switch (app) {
      case "map":
        return <MapApp onBack={goHome} />;
      case "messages":
        return <MessagesApp onBack={goHome} />;
      case "contacts":
        return <ContactsApp onBack={goHome} onOpenMessages={() => setApp("messages")} />;
      case "bank":
        return <BankApp onBack={goHome} />;
      case "jobs":
        return <JobsApp onBack={goHome} />;
      case "shop":
        return <ShopApp onBack={goHome} />;
      case "inventory":
        return <InventoryApp onBack={goHome} />;
      case "housing":
        return <HomeApp onBack={goHome} />;
      case "profile":
        return <ProfileApp onBack={goHome} />;
      case "settings":
        return <SettingsApp onBack={goHome} onClosePhone={onClose} />;
      case "construction":
        return <ConstructionApp onBack={goHome} />;
      case "notifications":
        return <NotificationsApp onBack={goHome} />;
      case "market":
        return <MarketApp onBack={goHome} />;
      case "travel":
        return <TravelApp onBack={goHome} />;
      case "business":
        return <BusinessApp onBack={goHome} />;
      case "vehicles":
        return <VehiclesApp onBack={goHome} />;
      case "school":
        return <SchoolApp onBack={goHome} />;
      case "compete":
        return <CompeteApp onBack={goHome} />;
      default:
        return null;
    }
  }

  return (
    <div className="phone-overlay" onClick={onClose}>
      <div className="phone-device" onClick={(e) => e.stopPropagation()}>
        {/* Notch / status bar */}
        <div className="phone-status">
          <span>{timeStr}</span>
          <div className="phone-notch" />
          <span>
            ${character.stats.money.toFixed(0)} · 🏦{(character.stats.bankBalance ?? 0).toFixed(0)}
          </span>
        </div>

        <div className="phone-screen">
          {app === "home" ? (
            <div className="phone-home">
              <div className="phone-home-header">
                <div className="phone-avatar">
                  {character.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="phone-home-name">{character.name}</div>
                  <div className="phone-home-sub">Life Sim OS</div>
                </div>
              </div>

              <div className="phone-app-grid">
                {APPS.map((a) => (
                  <button
                    key={a.id}
                    className="phone-app-icon"
                    onClick={() => setApp(a.id)}
                  >
                    <div className="phone-app-bubble" style={{ background: a.color }}>
                      {a.icon}
                    </div>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>

              <div className="phone-dock">
                <button className="phone-app-icon" onClick={() => setApp("map")}>
                  <div className="phone-app-bubble" style={{ background: "#00b894" }}>🗺️</div>
                </button>
                <button className="phone-app-icon" onClick={() => setApp("messages")}>
                  <div className="phone-app-bubble" style={{ background: "#0984e3" }}>💬</div>
                </button>
                <button className="phone-app-icon" onClick={() => setApp("contacts")}>
                  <div className="phone-app-bubble" style={{ background: "#6c5ce7" }}>👥</div>
                </button>
                <button className="phone-app-icon" onClick={() => setApp("bank")}>
                  <div className="phone-app-bubble" style={{ background: "#fdcb6e" }}>🏦</div>
                </button>
              </div>
            </div>
          ) : (
            renderApp()
          )}
        </div>

        {/* Home indicator */}
        <button className="phone-home-bar" onClick={() => (app === "home" ? onClose() : setApp("home"))} />
      </div>
    </div>
  );
}
