import { useEffect, useRef, useState } from "react";
import { MIN_SCALE, MAX_SCALE } from "../core/projects.js";
import { itemType } from "../core/itemTypes.js";
import { computeAngles } from "../core/angles.js";
import { dist, angleBetween, pointAt, constrainAngle } from "../core/geometry.js";

// The drawing surface: grid, axes, items, angles, pan, zoom, snapping and the mouse/touch interactions.
// view = { x, y, scale }: x and y shift the origin from the centre, scale is pixels per metre.
//
// Interaction kinds live here, so tools only describe themselves:
//   tool.behavior.kind === "twoPoint"  click start, click end (or type length and angle)
//   tool.behavior.kind === "place"     click to put an object where you click
//   tool "select"                      click to select, drag handles or the item to edit
const STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const pickStep = (scale) => STEPS.find((s) => s * scale >= 14) || 5000; // metres per minor grid line
const label = (n) => String(Number(n.toFixed(3)));
const fmtAngle = (a) => String(Math.round(a * 10) / 10);
const MONO = '"Cascadia Mono", Consolas, monospace';
const TYPING_KEYS = /^[0-9.]$/;
const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
const ARC_R = 30; // radius of the angle arcs in pixels

export default function CanvasView({
  view, grid, axes, snap, tool, scene, selectedId, readOnly, env, pins, overlay,
  onView, onSize, onCursor, onSelect, onAddItem, onBeginEdit, onLiveEdit, onFinish,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const pointers = useRef(new Map()); // active touches or mouse buttons, for pinch zoom
  const pinch = useRef(null);
  const latest = useRef({});
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [marker, setMarker] = useState(null); // { x, y, kind } on screen
  const [pointer, setPointer] = useState(null); // snapped cursor in metres
  const [draft, setDraft] = useState(null); // { a } first point of a two-point drawing
  const [typing, setTyping] = useState(null); // { length, angle } typed values

  latest.current = { view, size, onView };
  const kindOf = tool.behavior ? tool.behavior.kind : null;
  const twoPoint = kindOf === "twoPoint";
  const angles = computeAngles(scene);

  useEffect(() => {
    const wrap = wrapRef.current;
    const measure = () => {
      const s = { w: wrap.clientWidth, h: wrap.clientHeight };
      setSize(s);
      if (onSize) onSize(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Wheel and touchpad-pinch zoom about the cursor. Added by hand so the page itself never zooms.
  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const { view: v, size: sz, onView: setView } = latest.current;
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const scale = clampScale(v.scale * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.003)));
      const f = scale / v.scale;
      const ox = sz.w / 2 + v.x;
      const oy = sz.h / 2 + v.y;
      setView({ x: sx - (sx - ox) * f - sz.w / 2, y: sy - (sy - oy) * f - sz.h / 2, scale });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Changing tool cancels a drawing in progress
  useEffect(() => {
    setDraft(null);
    setTyping(null);
  }, [tool.id]);

  // Esc cancels. Typing a number while drawing opens the length and angle boxes.
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "Escape") {
        setDraft(null);
        setTyping(null);
      } else if (draft && !typing && twoPoint && TYPING_KEYS.test(e.key)) {
        e.preventDefault();
        setTyping({ length: e.key, angle: "" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, typing, twoPoint]);

  const toScreen = (p) => ({
    x: size.w / 2 + view.x + p.x * view.scale,
    y: size.h / 2 + view.y - p.y * view.scale,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let preview = null;
    if (pointer && twoPoint && draft) preview = tool.behavior.create(draft.a, pointer, { env });
    else if (pointer && kindOf === "place") preview = tool.behavior.create(pointer, { env });
    draw(ctx, size, view, { grid, axes }, marker, scene, angles, selectedId, preview, kindOf === "place", { env, pins, overlay });
  }, [size, view, grid, axes, marker, scene, selectedId, draft, pointer, tool, env, pins, overlay]);

  const local = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  };

  const worldOf = (e) => {
    const { sx, sy } = local(e);
    return {
      x: (sx - (size.w / 2 + view.x)) / view.scale,
      y: (size.h / 2 + view.y - sy) / view.scale,
    };
  };

  // Snap to a point of any item first, then to the grid
  const snapPoint = (raw, skipId) => {
    const tol = 12 / view.scale;
    let best = null;
    let bestD = tol;
    for (const it of scene.items) {
      if (it.id === skipId) continue;
      for (const p of itemType(it.type).snapPoints(it)) {
        const d = dist(p, raw);
        if (d < bestD) {
          best = p;
          bestD = d;
        }
      }
    }
    if (best) return { p: { x: best.x, y: best.y }, kind: "point" };
    if (snap) {
      const step = pickStep(view.scale);
      return { p: { x: Math.round(raw.x / step) * step, y: Math.round(raw.y / step) * step }, kind: "grid" };
    }
    return { p: raw, kind: null };
  };

  // Which angle arc (or its number) is under the screen point
  const angleAt = (sx, sy) => {
    for (const a of angles) {
      const c = toScreen(a.vertex);
      const dx = sx - c.x;
      const dy = sy - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 12 || d > 56) continue;
      const ang = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
      const rel = (ang - a.start + 360) % 360;
      if (rel > 2 && rel < a.sweep - 2) return a;
    }
    return null;
  };

  const startPinch = () => {
    const [p1, p2] = [...pointers.current.values()];
    const r = canvasRef.current.getBoundingClientRect();
    pinch.current = {
      d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
      mid0: { x: (p1.x + p2.x) / 2 - r.left, y: (p1.y + p2.y) / 2 - r.top },
      view0: view,
    };
    dragRef.current = null;
  };

  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (e.button === 2) {
      setDraft(null);
      setTyping(null);
      return;
    }
    if (tool.id === "pan" || e.button === 1) {
      dragRef.current = { kind: "pan", x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const raw = worldOf(e);

    if (twoPoint) {
      const { p } = snapPoint(raw);
      if (!draft) {
        setDraft({ a: p });
        return;
      }
      const b = e.shiftKey ? constrainAngle(draft.a, p) : p;
      if (dist(draft.a, b) > 0.0005) onAddItem(tool.behavior.create(draft.a, b, { env }));
      setDraft(null);
      setTyping(null);
      return;
    }

    if (kindOf === "place") {
      onAddItem(tool.behavior.create(snapPoint(raw).p, { env }));
      return;
    }

    if (tool.id === "select") {
      const sel = typeof selectedId === "number" ? scene.items.find((i) => i.id === selectedId) : null;
      if (sel && !readOnly) {
        const h = itemType(sel.type).handles(sel).find((hd) => dist(hd.p, raw) <= 10 / view.scale);
        if (h) {
          // A click (no drag) on a handle that sits on another object picks that object instead
          const under = [...scene.items].reverse().find((i) => i.id !== sel.id && itemType(i.type).hitTest(i, raw, 8 / view.scale));
          dragRef.current = { kind: "handle", id: sel.id, handle: h.id, began: false, under: under ? under.id : null };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
      const { sx, sy } = local(e);
      const ang = angleAt(sx, sy);
      if (ang) {
        onSelect(ang.key);
        return;
      }
      const tol = 8 / view.scale;
      // Everything under the pointer, topmost first. A line that ends right here goes last, so the
      // object it is tied to can be picked. Alt + click picks the next thing underneath.
      const endTol = 10 / view.scale;
      const hits = [...scene.items]
        .reverse()
        .filter((i) => itemType(i.type).hitTest(i, raw, tol))
        .sort((x, y) => {
          const endsHere = (i) => (i.type === "line" && (dist(i.a, raw) <= endTol || dist(i.b, raw) <= endTol) ? 1 : 0);
          return endsHere(x) - endsHere(y);
        });
      const at = hits.findIndex((i) => i.id === selectedId);
      // Alt + click picks the next thing underneath, when objects overlap
      const hit = hits.length ? hits[e.altKey && at >= 0 ? (at + 1) % hits.length : 0] : null;
      if (hit) {
        onSelect(hit.id);
        if (!readOnly) {
          dragRef.current = { kind: "move", id: hit.id, last: raw, began: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else {
        onSelect(null);
      }
    }
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers: zoom and move the view together
    if (pinch.current && pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      const r = canvasRef.current.getBoundingClientRect();
      const midNow = { x: (p1.x + p2.x) / 2 - r.left, y: (p1.y + p2.y) / 2 - r.top };
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const { d0, mid0, view0 } = pinch.current;
      const scale = clampScale((view0.scale * d) / d0);
      const f = scale / view0.scale;
      const ox0 = size.w / 2 + view0.x;
      const oy0 = size.h / 2 + view0.y;
      onView({
        x: midNow.x - (mid0.x - ox0) * f - size.w / 2,
        y: midNow.y - (mid0.y - oy0) * f - size.h / 2,
        scale,
      });
      return;
    }

    const d = dragRef.current;
    if (d && d.kind === "pan") {
      onView({ ...view, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
    }
    const raw = worldOf(e);
    const { p, kind } = snapPoint(raw, d && d.id);
    const pw = draft && e.shiftKey ? constrainAngle(draft.a, p) : p;
    setPointer(pw);
    setMarker(kind ? { ...toScreen(pw), kind } : null);
    onCursor({ x: pw.x, y: pw.y });

    if (d && d.kind === "handle") {
      if (!d.began) {
        onBeginEdit();
        d.began = true;
      }
      onLiveEdit(d.id, (it) => itemType(it.type).moveHandle(it, d.handle, pw));
    } else if (d && d.kind === "move") {
      if (!d.began) {
        onBeginEdit();
        d.began = true;
      }
      const dx = raw.x - d.last.x;
      const dy = raw.y - d.last.y;
      d.last = raw;
      onLiveEdit(d.id, (it) => itemType(it.type).moveBy(it, dx, dy));
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    if (d && d.kind === "handle" && !d.began && d.under != null) onSelect(d.under);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    dragRef.current = null;
  };

  const onPointerLeave = () => {
    setMarker(null);
    onCursor(null);
  };

  const commitTyped = () => {
    if (!draft) return;
    const L = parseFloat(typing.length);
    const A = parseFloat(typing.angle);
    const length = Number.isFinite(L) && L > 0 ? L : pointer ? dist(draft.a, pointer) : 1;
    const angle = Number.isFinite(A) ? A : pointer ? angleBetween(draft.a, pointer) : 0;
    onAddItem(tool.behavior.create(draft.a, pointAt(draft.a, length, angle), { env }));
    setDraft(null);
    setTyping(null);
    onFinish(); // Enter ends the command and brings back the normal cursor
  };

  const typedKey = (e) => {
    if (e.key === "Enter") commitTyped();
    else if (e.key === "Escape") setTyping(null);
  };

  const at = pointer ? toScreen(pointer) : { x: 120, y: 120 };

  return (
    <div
      className={"canvas-wrap" + (tool.id === "pan" ? " pan" : "") + (twoPoint || kindOf === "place" ? " draw" : "")}
      ref={wrapRef}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      {draft && typing && (
        <div
          className="dyn"
          style={{ left: Math.min(at.x + 16, size.w - 200), top: Math.min(at.y + 16, size.h - 96) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label>
            Length
            <input
              autoFocus
              value={typing.length}
              onChange={(e) => setTyping({ ...typing, length: e.target.value })}
              onKeyDown={typedKey}
            />
            m
          </label>
          <label>
            Angle
            <input
              value={typing.angle}
              placeholder="auto"
              onChange={(e) => setTyping({ ...typing, angle: e.target.value })}
              onKeyDown={typedKey}
            />
            °
          </label>
        </div>
      )}
    </div>
  );
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function chip(ctx, text, x, y) {
  ctx.font = `600 12px ${MONO}`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(12,17,29,.9)";
  ctx.beginPath();
  ctx.roundRect(x, y - 11, tw + 14, 22, 6);
  ctx.fill();
  ctx.strokeStyle = "#f5b83d";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f5b83d";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 7, y);
  ctx.textBaseline = "alphabetic";
}

// The room: ground, ceiling and a wall on each side, drawn like the hatched surfaces in a textbook.
// Everything outside the room is shaded, so it reads as a closed box and never as empty space.
// If a side is out of view (zoomed in or panned away) a note at the edge says where it is.
function drawEnv(ctx, w, h, toScreen, env) {
  const FAR = 1e5;
  const pinned = Boolean(env.room && env.room.fit); // the room stays at the screen edges and does not zoom
  const INS = 18;
  const L = env.left.on ? (pinned ? INS : toScreen({ x: env.left.x, y: 0 }).x) : -FAR;
  const R = env.right.on ? (pinned ? w - INS : toScreen({ x: env.right.x, y: 0 }).x) : FAR;
  const T = env.ceiling.on ? (pinned ? INS : toScreen({ x: 0, y: env.ceiling.y }).y) : -FAR;
  const B = env.ground.on ? (pinned ? h - INS : toScreen({ x: 0, y: env.ground.y }).y) : FAR;
  const num = (n) => String(Math.round(n * 100) / 100);

  ctx.save();

  // shade everything outside the room
  const il = Math.max(L, 0);
  const ir = Math.min(R, w);
  const it = Math.max(T, 0);
  const ib = Math.min(B, h);
  ctx.fillStyle = "rgba(4,7,14,.72)";
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  if (ir > il && ib > it) ctx.rect(il, it, ir - il, ib - it);
  ctx.fill("evenodd");

  // short slanted ticks along a line, leaning to the outside (nx, ny)
  const hatch = (x1, y1, x2, y2, nx, ny) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(154,168,199,.45)";
    for (let t = 0; t <= len; t += 14) {
      const px = x1 + ux * t;
      const py = y1 + uy * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + nx * 9 - ux * 8, py + ny * 9 - uy * 8);
      ctx.stroke();
    }
  };
  const side = (x1, y1, x2, y2, nx, ny, name, tx, ty, align) => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#b8c4e0";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    hatch(x1, y1, x2, y2, nx, ny);
    ctx.fillStyle = "#6f7b96";
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = align;
    ctx.fillText(name, tx, ty);
  };

  // ground and ceiling stop at the walls, walls stop at the ground and ceiling, so the corners close
  const xa = Math.max(L, -20);
  const xb = Math.min(R, w + 20);
  const ya = Math.max(T, -20);
  const yb = Math.min(B, h + 20);
  if (env.ground.on && B > -30 && B < h + 30 && xb > xa) side(xa, B, xb, B, 0, 1, "ground", Math.min(xb, w) - 10, B - 6, "right");
  if (env.ceiling.on && T > -30 && T < h + 30 && xb > xa) side(xa, T, xb, T, 0, -1, "ceiling", Math.min(xb, w) - 10, T + 14, "right");
  if (env.left.on && L > -30 && L < w + 30 && yb > ya) side(L, ya, L, yb, -1, 0, "wall", L - 12, 28, "right");
  if (env.right.on && R > -30 && R < w + 30 && yb > ya) side(R, ya, R, yb, 1, 0, "wall", R + 12, 28, "left");

  // a side that is out of view: a note at the edge of the screen says where it is
  const notes = { left: [], right: [], top: [], bottom: [] };
  const wallNote = (x, name) => {
    const px = toScreen({ x, y: 0 }).x;
    if (px <= -30) notes.left.push(`\u25C0 ${name} at x = ${num(x)} m`);
    else if (px >= w + 30) notes.right.push(`${name} at x = ${num(x)} m \u25B6`);
  };
  const levelNote = (y, name) => {
    const py = toScreen({ x: 0, y }).y;
    if (py <= -30) notes.top.push(`\u25B2 ${name} at y = ${num(y)} m`);
    else if (py >= h + 30) notes.bottom.push(`\u25BC ${name} at y = ${num(y)} m`);
  };
  if (!pinned) {
    if (env.left.on) wallNote(env.left.x, "left wall");
    if (env.right.on) wallNote(env.right.x, "right wall");
    if (env.ground.on) levelNote(env.ground.y, "ground");
    if (env.ceiling.on) levelNote(env.ceiling.y, "ceiling");
  }
  ctx.fillStyle = "#8f9bb8";
  ctx.font = `600 11px ${MONO}`;
  const list = (items, x, y0, step, align) =>
    items.forEach((t, i) => {
      ctx.textAlign = align;
      ctx.fillText(t, x, y0 + i * step);
    });
  list(notes.left, 10, h / 2, 16, "left");
  list(notes.right, w - 10, h / 2, 16, "right");
  list(notes.top, w / 2, 36, 16, "center");
  list(notes.bottom, w / 2, h - 10, -16, "center");

  ctx.restore();
}

// Dotted paths of moving objects
function drawTrails(ctx, toScreen, trails) {
  ctx.save();
  ctx.strokeStyle = "rgba(245,184,61,.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 6]);
  ctx.lineCap = "round";
  for (const pts of Object.values(trails)) {
    if (pts.length < 2) continue;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = toScreen(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

// Predicted paths (dashed) and the points they end at
function drawOverlay(ctx, toScreen, overlay) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  for (const path of overlay.paths || []) {
    ctx.strokeStyle = path.color || "#4cc9f0";
    ctx.beginPath();
    path.pts.forEach((p, i) => {
      const q = toScreen(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const m of overlay.marks || []) {
    const q = toScreen(m.p);
    ctx.strokeStyle = "#4cc9f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#4cc9f0";
    ctx.font = `600 12px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(m.text, q.x, q.y + 22);
  }
  ctx.restore();
}

// Values pinned with "View". Several on one object stack so they do not overlap.
function drawPins(ctx, toScreen, pins) {
  const used = new Map();
  for (const pin of pins) {
    const c = toScreen(pin.point);
    const k = `${Math.round(c.x / 10)}:${Math.round(c.y / 10)}`;
    const n = used.get(k) || 0;
    used.set(k, n + 1);
    chip(ctx, pin.text, c.x + 14, c.y - 14 - n * 26);
  }
}

// An angle at a corner: an arc (or a square for 90°) and its value
function drawAngle(ctx, toScreen, a, selected) {
  const c = toScreen(a.vertex);
  const a0 = (-a.start * Math.PI) / 180;
  const a1 = (-(a.start + a.sweep) * Math.PI) / 180;
  const right = Math.abs(a.sweep - 90) < 0.05;
  ctx.save();
  ctx.strokeStyle = selected ? "#f5b83d" : "rgba(245,184,61,.8)";
  ctx.lineWidth = selected ? 2.5 : 1.5;
  if (right) {
    const k = 14;
    const u = { x: Math.cos(a0), y: Math.sin(a0) };
    const v = { x: Math.cos(a1), y: Math.sin(a1) };
    ctx.beginPath();
    ctx.moveTo(c.x + u.x * k, c.y + u.y * k);
    ctx.lineTo(c.x + (u.x + v.x) * k, c.y + (u.y + v.y) * k);
    ctx.lineTo(c.x + v.x * k, c.y + v.y * k);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(c.x, c.y, ARC_R, a0, a1, true);
    ctx.stroke();
  }
  const mid = (-(a.start + a.sweep / 2) * Math.PI) / 180;
  const lr = right ? 34 : ARC_R + 16;
  const tx = c.x + Math.cos(mid) * lr;
  const ty = c.y + Math.sin(mid) * lr;
  ctx.font = `600 12px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#0e1424";
  ctx.strokeText(`${fmtAngle(a.sweep)}°`, tx, ty);
  ctx.fillStyle = selected ? "#f5b83d" : "#f0c667";
  ctx.fillText(`${fmtAngle(a.sweep)}°`, tx, ty);
  ctx.restore();
}

function draw(ctx, { w, h }, view, show, marker, scene, angles, selectedId, preview, ghost, extras) {
  const s = view.scale;
  const ox = w / 2 + view.x;
  const oy = h / 2 + view.y;
  const toScreen = (p) => ({ x: ox + p.x * s, y: oy - p.y * s });

  ctx.fillStyle = "#0e1424";
  ctx.fillRect(0, 0, w, h);

  const step = pickStep(s);
  const px = step * s;
  const i0 = Math.floor(-ox / px);
  const i1 = Math.ceil((w - ox) / px);
  const j0 = Math.floor(-(h - oy) / px);
  const j1 = Math.ceil(oy / px);

  if (show.grid) {
    ctx.lineWidth = 1;
    for (let i = i0; i <= i1; i++) {
      const x = Math.round(ox + i * px) + 0.5;
      ctx.strokeStyle = i % 5 === 0 ? "rgba(140,160,210,.16)" : "rgba(140,160,210,.06)";
      line(ctx, x, 0, x, h);
    }
    for (let j = j0; j <= j1; j++) {
      const y = Math.round(oy - j * px) + 0.5;
      ctx.strokeStyle = j % 5 === 0 ? "rgba(140,160,210,.16)" : "rgba(140,160,210,.06)";
      line(ctx, 0, y, w, y);
    }
    // Ruler numbers along the top and left edges, in metres
    ctx.fillStyle = "#5d6a88";
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = "center";
    for (let i = i0; i <= i1; i++) if (i % 5 === 0 && i !== 0) ctx.fillText(label(i * step), ox + i * px, 14);
    ctx.textAlign = "left";
    for (let j = j0; j <= j1; j++) if (j % 5 === 0 && j !== 0) ctx.fillText(label(j * step), 6, oy - j * px - 4);
  }

  // Axes through the origin: x in red, y in green (can be switched off)
  if (show.axes) {
    ctx.lineWidth = 1.5;
    if (oy >= 0 && oy <= h) {
      ctx.strokeStyle = "rgba(255,107,87,.55)";
      line(ctx, 0, oy, w, oy);
    }
    if (ox >= 0 && ox <= w) {
      ctx.strokeStyle = "rgba(90,209,160,.55)";
      line(ctx, ox, 0, ox, h);
    }
    if (ox >= 0 && ox <= w && oy >= 0 && oy <= h) {
      ctx.fillStyle = "#e6ebf5";
      ctx.beginPath();
      ctx.arc(ox, oy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground and limits of the simulated world
  if (extras.env) drawEnv(ctx, w, h, toScreen, extras.env);

  // Items
  const g = { ctx, toScreen, scale: s };
  for (const it of scene.items) itemType(it.type).draw(g, it, it.id === selectedId);

  // Paths left behind by moving objects (projectiles, falling things)
  if (scene.trails) drawTrails(ctx, toScreen, scene.trails);

  // Angles where lines meet
  for (const a of angles) drawAngle(ctx, toScreen, a, a.key === selectedId);

  // Predicted paths and landing marks from the Answers
  if (extras.overlay) drawOverlay(ctx, toScreen, extras.overlay);

  // Values pinned from the Results list
  if (extras.pins) drawPins(ctx, toScreen, extras.pins);

  // Handles of the selected item
  const sel = typeof selectedId === "number" ? scene.items.find((i) => i.id === selectedId) : null;
  if (sel) {
    for (const hd of itemType(sel.type).handles(sel)) {
      const p = toScreen(hd.p);
      ctx.fillStyle = "#0e1424";
      ctx.strokeStyle = "#f5b83d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(p.x - 5, p.y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Drawing in progress (line) or the object about to be placed (ghost)
  if (preview) {
    const list = Array.isArray(preview) ? preview : [preview];
    ctx.save();
    ctx.globalAlpha = ghost ? 0.5 : 0.75;
    for (const p of list) itemType(p.type).draw(g, p, false);
    ctx.restore();
    const first = list[0];
    if (!ghost && first.a && first.b) {
      const b = toScreen(first.b);
      chip(ctx, `${dist(first.a, first.b).toFixed(3)} m   ${angleBetween(first.a, first.b).toFixed(1)}°`, b.x + 14, b.y - 16);
    } else if (!ghost && first.speed0 != null) {
      const c = toScreen(first);
      chip(ctx, `${first.speed0.toFixed(2)} m/s   ${first.angle0.toFixed(1)}°`, c.x + 14, c.y + 28);
    }
  }

  // Snap marker: square = grid point, ring = a point on another item
  if (marker) {
    ctx.strokeStyle = "#f5b83d";
    ctx.lineWidth = 1.5;
    if (marker.kind === "point") {
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(marker.x - 5, marker.y - 5, 10, 10);
    }
  }

  if (show.axes) drawAxisIcon(ctx, 36, h - 36);
}

// Small X/Y icon in the bottom-left corner, like the UCS icon in AutoCAD
function drawAxisIcon(ctx, x, y) {
  const arrow = (x2, y2, color) => {
    const a = Math.atan2(y2 - y, x2 - x);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    line(ctx, x, y, x2, y2);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 7 * Math.cos(a - 0.45), y2 - 7 * Math.sin(a - 0.45));
    ctx.lineTo(x2 - 7 * Math.cos(a + 0.45), y2 - 7 * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  };
  arrow(x + 30, y, "rgba(255,107,87,.9)");
  arrow(x, y - 30, "rgba(90,209,160,.9)");
  ctx.fillStyle = "#8793ae";
  ctx.font = `600 11px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillText("X", x + 35, y + 4);
  ctx.fillText("Y", x - 4, y - 36);
}