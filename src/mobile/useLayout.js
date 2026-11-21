// Which screen to show: the phone layout or the desktop layout.
// "auto" picks by the size of the screen and whether it is touched with a finger.
// The person can force one from the menu (Phone / Desktop).
import { useEffect, useState } from "react";

const KEY = "incog-layout";

// A pure function so it can be tested: width/height in pixels, coarse = the main pointer is a finger
export function detectLayout({ width, height, coarse, override = "auto" }) {
  const landscape = width > height;
  if (override === "phone") return { mode: "phone", landscape };
  if (override === "desktop") return { mode: "desktop", landscape };
  const small = Math.min(width, height) <= 600; // a phone in either direction
  const narrow = width <= 760; // a narrow window
  return { mode: narrow || (coarse && small) ? "phone" : "desktop", landscape };
}

export const readOverride = () => {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "phone" || v === "desktop" ? v : "auto";
  } catch {
    return "auto";
  }
};

export function useLayout() {
  const read = (override) => {
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    return detectLayout({ width: window.innerWidth, height: window.innerHeight, coarse, override });
  };
  const [override, setOverrideState] = useState(readOverride);
  const [layout, setLayout] = useState(() => read(readOverride()));

  useEffect(() => {
    const update = () => setLayout(read(override));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [override]);

  const setOverride = (v) => {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      // not saved, but it still applies now
    }
    setOverrideState(v);
  };
  return { ...layout, override, setOverride };
}
