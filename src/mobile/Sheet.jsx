import { useEffect, useRef, useState } from "react";
import Icon from "../core/icons.jsx";

// A panel that slides in over the drawing: up from the bottom (phone portrait), in from the side
// (landscape and the menu). Tap the dim area, press the cross, or swipe down to close it.
export default function Sheet({ open, title, onClose, side = "bottom", children, tall = false }) {
  const [dy, setDy] = useState(0);
  const drag = useRef(null);

  useEffect(() => {
    if (!open) setDy(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const down = (e) => {
    if (side !== "bottom") return;
    drag.current = { y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y));
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dy > 90) onClose();
    setDy(0);
  };

  if (!open) return null;
  return (
    <div className={`m-sheet-wrap ${side}`} role="presentation">
      <div className="m-backdrop" onClick={onClose} />
      <section
        className={`m-sheet ${side}${tall ? " tall" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
      >
        <header onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {side === "bottom" && <i className="m-grab" aria-hidden="true" />}
          <h2>{title}</h2>
          <button className="m-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="m-sheet-body">{children}</div>
      </section>
    </div>
  );
}
