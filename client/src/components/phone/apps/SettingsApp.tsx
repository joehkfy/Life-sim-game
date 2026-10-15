import { useGameStore } from "../../../stores/gameStore";
import { disconnectSocket } from "../../../systems/network";

export function SettingsApp({
  onBack,
  onClosePhone,
}: {
  onBack: () => void;
  onClosePhone: () => void;
}) {
  const logout = useGameStore((s) => s.logout);

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Settings</span>
        <span />
      </div>
      <div className="phone-app-body">
        <p className="phone-empty" style={{ textAlign: "left" }}>
          Graphics quality, notifications, and more will appear here.
        </p>
        <button
          className="phone-btn bad full"
          onClick={() => {
            disconnectSocket();
            logout();
            onClosePhone();
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
