// Line icons on a 24x24 grid, drawn in the current text colour.

// They are bundled in the app, so they work fully offline.
const ICONS = {
  answers: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12.5h5" />,
  launchBall: (<><circle cx="5" cy="18" r="2" /><path d="M7 16c3-8 9-9 13-5M20 11l-4-.5M20 11l-1 4" /></>),
  launchBlock: (<><rect x="3" y="15" width="5" height="5" rx="1" /><path d="M9 14c3-8 8-9 11-4M20 10l-4-.5M20 10l-1 4" /></>),
  target: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" /></>),
  platform: <path d="M3 10h18M5 10l-2 3M9 10l-2 3M13 10l-2 3M17 10l-2 3M21 10l-2 3" />,
  slope: (<><path d="M3 19h18L3 8z" /><rect x="7" y="8" width="5" height="4" rx="0.5" transform="rotate(30 9.5 10)" /></>),
  pushed: (<><rect x="9" y="10" width="9" height="8" rx="1" /><path d="M2 14h6M5.5 11.5L8 14l-2.5 2.5M3 20h18" /></>),
  cart: (<><rect x="8" y="9" width="12" height="7" rx="1.5" /><circle cx="11" cy="18.5" r="1.5" /><circle cx="17" cy="18.5" r="1.5" /><path d="M2 12.5h4M4.5 10.5l1.8 2-1.8 2" /></>),
  cartRest: (<><rect x="6" y="9" width="12" height="7" rx="1.5" /><circle cx="9" cy="18.5" r="1.5" /><circle cx="15" cy="18.5" r="1.5" /></>),
  sticky: (<><rect x="8" y="9" width="12" height="7" rx="1.5" strokeDasharray="3 2" /><circle cx="11" cy="18.5" r="1.5" /><circle cx="17" cy="18.5" r="1.5" /><path d="M2 12.5h4M4.5 10.5l1.8 2-1.8 2" /></>),
  stickyRest: (<><rect x="6" y="9" width="12" height="7" rx="1.5" strokeDasharray="3 2" /><circle cx="9" cy="18.5" r="1.5" /><circle cx="15" cy="18.5" r="1.5" /></>),
  puck: (<><circle cx="14" cy="12" r="5" /><path d="M2 12h5M4.5 9.5L7 12l-2.5 2.5" /></>),
  puckRest: <circle cx="12" cy="12" r="5" />,
  hanging: (<><path d="M3 4h5M16 3h5M5 4l7 10M18 3l-6 11" /><rect x="9" y="14" width="6" height="6" rx="1" /></>),
  beamSupports: (<><rect x="3" y="8" width="18" height="3" rx="0.5" /><path d="M5 11l-2.5 6h5zM19 11l-2.5 6h5z" /><path d="M12 2v5M10 5l2 2 2-2" /></>),
  pendulum: (<><path d="M12 3v1M12 4l-5 10" /><circle cx="6" cy="16" r="3" /><path d="M3 4h18" /></>),
  springMass: (<><path d="M4 3h16M12 3v2l-3 1.5 6 2-6 2 6 2-3 1.5" /><rect x="8.5" y="15.5" width="7" height="5" rx="1" /></>),
  select: <path d="M6 3l11 8.5-5 1.2 3 6-2.3 1.1-3-6L6 18z" />,
  pan: <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
  undo: <path d="M9 14L4 9l5-5M4 9h11a5.5 5.5 0 0 1 0 11H9" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9a5.5 5.5 0 0 0 0 11h6" />,
  delete: <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />,
  play: <path d="M7 5l12 7-12 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  reset: <path d="M5 12a7 7 0 1 0 2.2-5.1M4 4v4h4" />,
  rope: (
    <>
      <path d="M6 18L18 6" />
      <circle cx="5" cy="19" r="1.8" />
      <circle cx="19" cy="5" r="1.8" />
    </>
  ),
  rod: <rect x="3" y="10" width="18" height="4" rx="1" transform="rotate(-30 12 12)" />,
  spring: <path d="M2 12h4l2-5 3 10 3-10 3 10 2-5h3" />,
   vector: (
    <>
      <path d="M4 19L19 6" />
      <path d="M19 6h-5.5M19 6v5.5" />
    </>
  ),
  line: <path d="M4 19L20 5" />,
    force: (
    <>
      <circle cx="6" cy="18" r="2" />
      <path d="M7.5 16.5L19 5M19 5h-6M19 5v6" />
    </>
  ),
  bob: (
    <>
      <circle cx="12" cy="14" r="6" />
      <circle cx="12" cy="5.5" r="2" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  dashed: <path d="M4 19L20 5" strokeDasharray="3.5 3.5" />,
  dotted: <path d="M4 19L20 5" strokeDasharray="0.1 4.5" strokeWidth="2.8" />,
  axes: <path d="M12 3v18M3 12h18M12 3l-2 3M12 3l2 3M21 12l-3-2M21 12l-3 2" />,
  beam: (
    <>
      <rect x="3" y="7" width="18" height="4" rx="1" />
      <path d="M12 11l-3.5 7h7z" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21" />
    </>
  ),
  ramp: <path d="M3 19h18L3 8z" />,
  wall: <path d="M7 4v16M7 8l-3.5 3.5M7 13l-3.5 3.5M7 18l-3.5 3.5" />,
  anchor: (
    <>
      <path d="M4 5h16M8 5L6 3M12 5l-2-2M16 5l-2-2M12 5v7" />
      <circle cx="12" cy="14.5" r="2.5" />
    </>
  ),
  pin: (
    <>
      <circle cx="12" cy="8" r="2.5" />
      <path d="M12 10.5L7 19h10z" />
    </>
  ),
  roller: (
    <>
      <path d="M12 5l-5 8h10z" />
      <circle cx="8.5" cy="16.5" r="1.7" />
      <circle cx="15.5" cy="16.5" r="1.7" />
      <path d="M4 20h16" />
    </>
  ),
  join: <path d="M10 14a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7l-1.2 1.2M14 10a4 4 0 0 1 0 5.7l-2.3 2.3a4 4 0 0 1-5.7-5.7l1.2-1.2" />,
  detach: (
    <>
      <path d="M10 14a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7" />
      <path d="M14 10a4 4 0 0 1 0 5.7l-2.3 2.3a4 4 0 0 1-5.7-5.7" />
      <path d="M4 4l16 16" />
    </>
  ),
  fix: (
    <>
      <rect x="6" y="11" width="12" height="9" rx="1.5" />
      <path d="M9 11V8a3 3 0 0 1 6 0v3" />
    </>
  ),
  setAngle: (
    <>
      <path d="M5 19h14M5 19L14 6" />
      <circle cx="19" cy="7" r="1.5" />
    </>
  ),
  setLength: <path d="M4 12h16M4 8v8M20 8v8" />,
  label: (
    <>
      <path d="M4 12V4h8l8 8-8 8z" />
      <circle cx="8.5" cy="8.5" r="1.3" />
    </>
  ),
  equilibrium: <path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6h5zM19 8l-2.5 6h5z" />,
  fbd: (
    <>
      <rect x="9" y="9" width="6" height="6" />
      <path d="M12 9V3M12 15v6M9 12H3M15 12h6" />
    </>
  ),
  results: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  steps: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  grid: <path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" />,
  snap: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </>
  ),
  zoomFit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  zoomReset: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" />
    </>
  ),
    zoomIn: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5M8.5 11h5M11 8.5v5" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5M8.5 11h5" />
    </>
  ),
  save: <path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />,
  saveAs: <path d="M5 4h10l3 3v5M5 4v16h7M8 4v5h6V4M18 15v6M15 18h6" />,
  open: <path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  toolbox: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13v7M13 16.5h7" /></>),
  sliders: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6" />,
  folder: <path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  topic: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  measure: <path d="M4 17L17 4l3 3L7 20zM8 13l2 2M11 10l2 2M14 7l2 2" />,
};

export default function Icon({ name, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.select}
    </svg>
  );
}