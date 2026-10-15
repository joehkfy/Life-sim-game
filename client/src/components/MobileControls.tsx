import { useRef, useEffect, useState } from "react";

interface MobileControlsProps {
  onMove: (x: number, z: number) => void;
  onRun: (running: boolean) => void;
  onJump: (jumping: boolean) => void;
  onInteract: () => void;
  visible: boolean;
}

export function MobileControls({ onMove, onRun, onJump, onInteract, visible }: MobileControlsProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const touchId = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      onMove(0, 0);
      onRun(false);
      onJump(false);
      setKnob({ x: 0, y: 0 });
      setActive(false);
    }
  }, [visible]);

  if (!visible) return null;

  function handleStart(e: React.TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0];
    touchId.current = t.identifier;
    setActive(true);
    updateKnob(t.clientX, t.clientY);
  }

  function handleMove(e: React.TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchId.current) {
        updateKnob(t.clientX, t.clientY);
        break;
      }
    }
  }

  function handleEnd(e: React.TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        touchId.current = null;
        setActive(false);
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
        break;
      }
    }
  }

  function updateKnob(clientX: number, clientY: number) {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = rect.width / 2 - 16;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    // Normalize -1..1 ; forward is -z in our game
    onMove(dx / max, dy / max);
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 25,
      }}
    >
      {/* Joystick */}
      <div
        ref={baseRef}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        style={{
          position: "absolute",
          left: 24,
          bottom: 100,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "2px solid rgba(255,255,255,0.25)",
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 48,
            height: 48,
            marginLeft: -24 + knob.x,
            marginTop: -24 + knob.y,
            borderRadius: "50%",
            background: active ? "rgba(108,92,231,0.9)" : "rgba(255,255,255,0.35)",
            transition: active ? "none" : "all 0.15s",
          }}
        />
      </div>

      {/* Run button */}
      <button
        onTouchStart={(e) => {
          e.preventDefault();
          onRun(true);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onRun(false);
        }}
        onMouseDown={() => onRun(true)}
        onMouseUp={() => onRun(false)}
        onMouseLeave={() => onRun(false)}
        style={{
          position: "absolute",
          right: 24,
          bottom: 180,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(253,203,110,0.85)",
          border: "none",
          color: "#111",
          fontWeight: 700,
          fontSize: 12,
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        RUN
      </button>

      {/* Jump button */}
      <button
        onTouchStart={(e) => { e.preventDefault(); onJump(true); }}
        onTouchEnd={(e) => { e.preventDefault(); onJump(false); }}
        onTouchCancel={(e) => { e.preventDefault(); onJump(false); }}
        onMouseDown={() => onJump(true)}
        onMouseUp={() => onJump(false)}
        onMouseLeave={() => onJump(false)}
        style={{
          position: "absolute",
          right: 24,
          bottom: 260,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(116,185,255,0.92)",
          border: "none",
          color: "#102235",
          fontWeight: 800,
          fontSize: 12,
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        JUMP
      </button>

      {/* Interact button */}
      <button
        onClick={onInteract}
        style={{
          position: "absolute",
          right: 24,
          bottom: 100,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(0,184,148,0.9)",
          border: "none",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          pointerEvents: "auto",
        }}
      >
        USE
      </button>
    </div>
  );
}

/** Detect touch device */
export function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);
  return touch;
}
