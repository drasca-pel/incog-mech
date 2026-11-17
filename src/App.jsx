import { useEffect, useRef, useState } from "react";
import "./shell.css";
import { TOOLS, findTools } from "./tools/index.js";
import { itemType } from "./core/itemTypes.js";
import { addItem, updateItem, removeItem } from "./core/scene.js";
import { findSelectable } from "./core/selection.js";
import { settle } from "./core/joins.js";
import { patchEnv } from "./core/env.js";
import { collectResults, resolvePinned } from "./core/results.js";
import { createSim } from "./sim/index.js";
import { newProject, zoomView, DEFAULT_VIEW } from "./core/projects.js";
import TitleBar from "./ui/TitleBar.jsx";
import Ribbon from "./ui/Ribbon.jsx";
import LeftBar from "./ui/LeftBar.jsx";
import CanvasView from "./ui/CanvasView.jsx";
import Properties from "./ui/Properties.jsx";
import CommandBar from "./ui/CommandBar.jsx";
import StatusBar from "./ui/StatusBar.jsx";
import StartPage from "./ui/StartPage.jsx";
import EnvPanel from "./ui/EnvPanel.jsx";

// The shell: it arranges the screen and passes events around.
// It knows nothing about specific tools. They come from tools/index.js.
export default function App() {
  const counter = useRef(1);
  const selRef = useRef(null); // selected item id, readable from the keyboard handler
  const sceneRef = useRef(null); // current scene, readable from event handlers
  const gravityRef = useRef(9.81);
  const envRef = useRef(null);
  const simRef = useRef(null); // the running simulation
  const statusRef = useRef("idle");
  const [state, setState] = useState(() => {
    const p = newProject(1);
    return { projects: [p], activeId: p.id };
  });
  const [selectedId, setSelectedId] = useState(null);
  const [simStatus, setSimStatus] = useState("idle"); // idle | playing | paused
  const [simScene, setSimScene] = useState(null); // the drawing as the simulation has moved it
  const [simTime, setSimTime] = useState(0);
  const [activeTool, setActiveTool] = useState("select");
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(true);
  const [snap, setSnap] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [propsOpen, setPropsOpen] = useState(true);
  const [rightTab, setRightTab] = useState("props"); // props | results
  const [envOpen, setEnvOpen] = useState(false);
  const [message, setMessage] = useState("Ready. Pick a tool from the ribbon, or type a command.");

  const active = state.projects.find((p) => p.id === state.activeId) || null;
  const tool = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
  const simActive = simStatus !== "idle" && simScene;
  const shownScene = active ? (simActive ? simScene : active.scene) : null;
  const selectedItem = shownScene ? findSelectable(shownScene, selectedId) : null;
  selRef.current = selectedItem ? selectedItem.id : null;
  sceneRef.current = active ? active.scene : null;
  gravityRef.current = active ? active.gravity : 9.81;
  envRef.current = active ? active.env : null;
  statusRef.current = simStatus;

  // Results list and the values pinned on the drawing
  const rows = shownScene ? collectResults(shownScene) : [];
  const pins = shownScene && active
    ? active.viewed
        .map((k) => resolvePinned(shownScene, rows, k))
        .filter(Boolean)
        .map(({ row, point }) => ({ point, text: `${row.name} · ${row.label} = ${Math.round(row.value * 1000) / 1000} ${row.unit}` }))
    : [];
  const toggleView = (key) =>
    updateActive((p) => ({ ...p, viewed: p.viewed.includes(key) ? p.viewed.filter((k) => k !== key) : [...p.viewed, key] }));

  // ----- projects -----
  const addProject = () => {
    resetSim();
    counter.current += 1;
    const p = newProject(counter.current);
    setState((s) => ({ projects: [...s.projects, p], activeId: p.id }));
    setSelectedId(null);
  };

  const closeProject = (id) => {
    resetSim();
    setState((s) => {
      const i = s.projects.findIndex((p) => p.id === id);
      const projects = s.projects.filter((p) => p.id !== id);
      const activeId = s.activeId === id ? (projects[Math.max(0, i - 1)]?.id ?? null) : s.activeId;
      return { projects, activeId };
    });
    setSelectedId(null);
  };

  const renameProject = (id, name) => {
    const n = name.trim();
    if (!n) return;
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, name: n } : p)) }));
  };

  const updateActive = (fn) =>
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === s.activeId ? fn(p) : p)) }));

  // ----- editing the drawing, with undo and redo -----
  // edit() is one undo step. beginEdit() + liveEdit() is for drags and typing:
  // one undo step for the whole drag.
  // Changing anything while a simulation is showing resets it first, so the change always applies.
  const ensureIdle = () => {
    if (statusRef.current === "idle") return;
    resetSim();
    setMessage("Simulation reset so your change applies. Press Play to run it again.");
  };
  const withHistory = (p) => ({ ...p, past: [...p.past, p.scene].slice(-100), future: [] });
  const beginEdit = () => {
    ensureIdle();
    updateActive(withHistory);
  };
  // changedId: the item just edited. Its line ends are re-tied, and lines tied to it follow it.
  const liveEdit = (fn, changedId) => {
    ensureIdle();
    updateActive((p) => ({ ...p, scene: settle(fn(p.scene), changedId) }));
  };
  const edit = (fn, changedId) => {
    ensureIdle();
    updateActive((p) => ({ ...withHistory(p), scene: settle(fn(p.scene), changedId) }));
  };

  const undo = () => {
    ensureIdle();
    updateActive((p) =>
      p.past.length
        ? { ...p, scene: p.past[p.past.length - 1], past: p.past.slice(0, -1), future: [p.scene, ...p.future] }
        : p
    );
  };
  const redo = () => {
    ensureIdle();
    updateActive((p) =>
      p.future.length
        ? { ...p, scene: p.future[0], past: [...p.past, p.scene], future: p.future.slice(1) }
        : p
    );
  };

  const addItemToScene = (item) => {
    const id = sceneRef.current.nextId;
    edit((s) => addItem(s, item).scene, id);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    const id = selRef.current;
    if (typeof id !== "number") return; // angles are not deleted, they follow the lines
    edit((s) => removeItem(s, id), null);
    setSelectedId(null);
  };

  const editProperty = (propId, value) => {
    const id = selRef.current;
    if (id == null) return;
    const now = findSelectable(sceneRef.current, id);
    const changed = now && now.type === "angle" ? Math.max(now.first.id, now.second.id) : id;
    liveEdit((s) => {
      const sel = findSelectable(s, id);
      if (!sel) return s;
      const def = itemType(sel.type);
      const out = def.apply ? def.apply(s, sel, propId, value) : null; // angles and align change other things
      if (out) return out;
      return updateItem(s, sel.id, (it) => {
        const prop = def.properties(it).find((x) => x.id === propId);
        return prop ? prop.set(it, value) : it;
      });
    }, changed);
  };

  const changeEnv = (part, patch) => {
    ensureIdle();
    updateActive((p) => ({ ...p, env: patchEnv(p.env, part, patch) }));
  };

  // ----- simulation -----
  const resetSim = () => {
    simRef.current = null;
    setSimStatus("idle");
    setSimScene(null);
    setSimTime(0);
  };

  const playSim = () => {
    if (statusRef.current === "idle") {
      const sim = createSim(sceneRef.current, gravityRef.current, envRef.current);
      simRef.current = sim;
      setSimScene(sim.snapshot());
      setSimTime(0);
      setMessage(sim.warnings.length ? `Playing. Note: ${sim.warnings.join(" ")}` : "Playing. Select an object to read its live values.");
    }
    setSimStatus("playing");
  };

  const pauseSim = () => {
    if (statusRef.current === "playing") setSimStatus("paused");
  };

  useEffect(() => {
    if (simStatus !== "playing") return undefined;
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.advance((now - last) / 1000);
      last = now;
      setSimScene(sim.snapshot());
      setSimTime(sim.time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [simStatus]);

  // ----- tools and actions -----
  const runAction = (id) => {
    if (id === "grid") setGrid((g) => !g);
    else if (id === "axes") setAxes((a) => !a);
    else if (id === "snap") setSnap((v) => !v);
    else if (id === "zoomIn") updateActive((p) => ({ ...p, view: zoomView(p.view, 1.25) }));
    else if (id === "zoomOut") updateActive((p) => ({ ...p, view: zoomView(p.view, 0.8) }));
    else if (id === "zoomFit") updateActive((p) => ({ ...p, view: { ...DEFAULT_VIEW } }));
    else if (id === "zoomReset") updateActive((p) => ({ ...p, view: { ...p.view, scale: DEFAULT_VIEW.scale } }));
    else if (id === "results") {
      setRightTab("results");
      setPropsOpen(true);
    } else if (id === "play") playSim();
    else if (id === "pause") pauseSim();
    else if (id === "reset") resetSim();
    else if (id === "undo") undo();
    else if (id === "redo") redo();
    else if (id === "delete") deleteSelected();
  };

  const activate = (t) => {
    if (!t.ready) {
      setMessage(`${t.name} is not built yet.`);
      return;
    }
    if (t.kind === "tool") {
      setActiveTool(t.id);
      setMessage(t.prompt || `${t.name} active.`);
    } else {
      runAction(t.id);
    }
  };

  const runCommand = (text) => {
    const q = text.trim().toLowerCase();
    if (!q) return;
    if (q === "new") {
      addProject();
      setMessage("New project created.");
      return;
    }
    const found = findTools(q)[0];
    if (!found) setMessage(`Unknown command: ${text}`);
    else activate(found);
  };

  // ----- keyboard -----
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      // Ctrl and + / - / 0 zoom the drawing, not the whole window
      if (mod && ["+", "=", "-", "_", "0"].includes(e.key)) {
        e.preventDefault();
        runAction(e.key === "0" ? "zoomReset" : e.key === "-" || e.key === "_" ? "zoomOut" : "zoomIn");
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        setGrid((g) => !g);
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        setAxes((a) => !a);
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        setSnap((v) => !v);
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        runAction(e.shiftKey ? "redo" : "undo");
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        runAction("redo");
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        runAction("delete");
        return;
      }
      if (e.key === "+" || e.key === "=") {
        runAction("zoomIn");
        return;
      }
      if (e.key === "-" || e.key === "_") {
        runAction("zoomOut");
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("cmd-input")?.focus();
        return;
      }
      if (e.key === "Escape" || e.key === "Enter") {
        // Enter or Esc ends the current command and brings back the normal cursor
        setActiveTool("select");
        setMessage("Select: click an object to see its properties.");
        return;
      }
      const t = TOOLS.find(
        (x) => x.ready && x.kind === "tool" && x.shortcut && x.shortcut.length === 1 && x.shortcut.toLowerCase() === e.key.toLowerCase()
      );
      if (t) activate(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TitleBar
        projects={state.projects}
        activeId={state.activeId}
        onSelect={(id) => {
          resetSim();
          setState((s) => ({ ...s, activeId: id }));
          setSelectedId(null);
        }}
        onAdd={addProject}
        onClose={closeProject}
        onRename={renameProject}
      />

      <Ribbon tools={TOOLS} activeTool={activeTool} toggles={{ grid, axes, snap }} onActivate={activate} />

      <div className="workspace" style={{ "--props-w": propsOpen ? "280px" : "34px" }}>
        <LeftBar tools={TOOLS} activeTool={activeTool} onActivate={activate} />
        {active ? (
          <CanvasView
            key={active.id}
            view={active.view}
            grid={grid}
            axes={axes}
            snap={snap}
            tool={tool}
            env={active.env}
            pins={pins}
            scene={shownScene}
            selectedId={selectedItem ? selectedItem.id : null}
            onView={(view) => updateActive((p) => ({ ...p, view }))}
            onCursor={setCursor}
            onSelect={setSelectedId}
            onAddItem={addItemToScene}
            onBeginEdit={beginEdit}
            onLiveEdit={(id, fn) => liveEdit((s) => updateItem(s, id, fn), id)}
            onFinish={() => {
              setActiveTool("select");
              setMessage("Select: click an object to see its properties.");
            }}
          />
        ) : (
          <StartPage onNew={addProject} />
        )}
        <Properties
          key={selectedItem ? selectedItem.id : "none"}
          open={propsOpen}
          onToggle={() => setPropsOpen((o) => !o)}
          item={selectedItem}
          onBeginEdit={beginEdit}
          onEdit={editProperty}
          tab={rightTab}
          onTab={setRightTab}
          rows={rows}
          viewed={active ? active.viewed : []}
          onToggleView={toggleView}
        />
      </div>

      <CommandBar message={message} onRun={runCommand} />

      <StatusBar
        grid={grid}
        axes={axes}
        snap={snap}
        onToggle={(id) => runAction(id)}
        cursor={cursor}
        zoom={active ? Math.round((active.view.scale / DEFAULT_VIEW.scale) * 100) : 100}
        onZoom={(f) => updateActive((p) => ({ ...p, view: zoomView(p.view, f) }))}
        onZoomReset={() => runAction("zoomReset")}
        gravity={active ? active.gravity : 9.81}
        onGravity={(g) => updateActive((p) => ({ ...p, gravity: g }))}
        simStatus={simStatus}
        simTime={simTime}
        onSim={(a) => runAction(a)}
        envOpen={envOpen}
        onEnvToggle={() => setEnvOpen((o) => !o)}
      />

      {envOpen && active && <EnvPanel env={active.env} onChange={changeEnv} onClose={() => setEnvOpen(false)} />}
    </div>
  );
}