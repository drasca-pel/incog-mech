import { useEffect, useRef, useState } from "react";
import "./shell.css";
import { TOOLS, findTools, toolsForTopic } from "./tools/index.js";
import { applyTopic, topicById } from "./core/topics.js";
import { analyze } from "./analysis/index.js";
import { itemType } from "./core/itemTypes.js";
import { addItem, updateItem, removeItem } from "./core/scene.js";
import { findSelectable } from "./core/selection.js";
import { settle } from "./core/joins.js";
import { patchEnv } from "./core/env.js";
import { collectResults, resolvePinned } from "./core/results.js";
import { createSim } from "./sim/index.js";
import { newProject, zoomView, fitRoom, DEFAULT_VIEW } from "./core/projects.js";
import { liveEnv } from "./core/env.js";
import {
  hasDesktop, loadWorkspace, saveWorkspace, saveWorkspaceNow, workspaceToJson, workspaceFileJson, workspaceFromFileText,
} from "./core/storage.js";
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
  const [ready, setReady] = useState(false); // true once the saved workspace has been read
  const stateRef = useRef(null); // latest projects, readable when the window closes
  const sizeRef = useRef(null); // size of the drawing area in pixels, for Zoom fit
  const simEnvRef = useRef(null); // the room as it was when Play was pressed
  const runRef = useRef(null); // latest runAction, readable from the keyboard handler
  const [selectedId, setSelectedId] = useState(null);
  const [simStatus, setSimStatus] = useState("idle"); // idle | playing | paused
  const [simScene, setSimScene] = useState(null); // the drawing as the simulation has moved it
  const [simTime, setSimTime] = useState(0);
  const [activeTool, setActiveTool] = useState("select");
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(true);
  const [snap, setSnap] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [propsOpen, setPropsOpen] = useState(false); // closed at first so the drawing has the whole screen
  const [rightTab, setRightTab] = useState("props"); // props | results
  const [envOpen, setEnvOpen] = useState(false);
  const [message, setMessage] = useState("Ready. Pick a tool from the ribbon, or type a command.");

  stateRef.current = state;
  const active = state.projects.find((p) => p.id === state.activeId) || null;
  const topic = active ? active.topic || "sandbox" : "sandbox";
  const tools = toolsForTopic(topic);
  const tool = tools.find((t) => t.id === activeTool) || TOOLS.find((t) => t.id === "select");
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
  // Answers worked out from the drawing (and the live values while it plays)
  const effEnv = active ? (simStatus !== "idle" && simEnvRef.current ? simEnvRef.current : liveEnv(active.env, active.view, sizeRef.current)) : null;
  const answers = active && effEnv ? analyze(active.scene, active.gravity, effEnv, topic, simActive ? simScene : null) : null;
  const headline = answers
    ? answers.groups.slice(0, 2).map((g) => ({ id: g.id, title: g.title, chips: g.rows.filter((r) => r.head && typeof r.value === "number").slice(0, 3) }))
    : [];
  const toggleView = (key) =>
    updateActive((p) => ({ ...p, viewed: p.viewed.includes(key) ? p.viewed.filter((k) => k !== key) : [...p.viewed, key] }));

  const selectItem = (id) => {
    setSelectedId(id);
    if (id != null && !propsOpen) {
      setRightTab("props");
      setPropsOpen(true);
    }
  };

  const switchTopic = (id) => {
    resetSim();
    updateActive((p) => applyTopic(p, id, sizeRef.current));
    setActiveTool("select");
    setMessage(`${topicById(id).name}: ${topicById(id).blurb}`);
  };

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

  // A tool can make one item, or a set of them (a pendulum is an anchor, a bob and a rope)
  const addItemToScene = (made) => {
    const list = Array.isArray(made) ? made : [made];
    const first = sceneRef.current.nextId;
    edit((s) => {
      let sc = s;
      for (const it of list) {
        const id = sc.nextId;
        sc = settle(addItem(sc, it).scene, id);
      }
      return sc;
    }, first);
    setSelectedId(first);
    if (list.length > 1) setMessage("Placed. Everything in the set can be moved or changed on its own.");
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
      const cur = stateRef.current.projects.find((p) => p.id === stateRef.current.activeId);
      const roomNow = liveEnv(envRef.current, cur ? cur.view : DEFAULT_VIEW, sizeRef.current);
      simEnvRef.current = roomNow;
      const sim = createSim(sceneRef.current, gravityRef.current, roomNow);
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

  // ----- saving and opening -----
  // Autosave keeps every tab safe on its own. Save and Open are for a project file you choose.
  const saveProject = async (askWhere) => {
    if (!stateRef.current.projects.length) return;
    if (!hasDesktop()) {
      // Browser mode persists the complete workspace automatically.
      await saveWorkspace(workspaceToJson(stateRef.current.projects, stateRef.current.activeId, {}));
      setMessage("All projects and topic workspaces saved in this browser.");
      return;
    }
    const current = stateRef.current;
    const existingPath = current.projects.find((p) => p.filePath)?.filePath;
    const json = workspaceFileJson(current.projects, current.activeId);
    try {
      const res = existingPath && !askWhere
        ? await window.api.saveProject(existingPath, json)
       : await window.api.saveProjectAs(
    `INCOG-${active?.name || "Workspace"}`,
    json
  );
      if (res.canceled) return;
      if (!res.ok) throw new Error(res.error);
      setState((s) => ({ ...s, projects: s.projects.map((p) => ({ ...p, filePath: res.path })) }));
      setMessage(`Complete workspace saved to ${res.path}`);
    } catch (err) {
      setMessage(`Could not save workspace: ${err.message}`);
    }
  };

  const openProject = async () => {
    if (!hasDesktop()) {
      setMessage("Opening files works in the desktop app. In this browser your work is kept automatically.");
      return;
    }
    try {
      const res = await window.api.openProject();
      if (res.canceled) return;
      if (!res.ok) throw new Error(res.error);
      const restored = workspaceFromFileText(res.content);
      const projects = restored.projects.map((p) => ({ ...p, filePath: res.path }));
      counter.current = projects.reduce(
  (max, p) => {
    const match = /^Project (\d+)$/.exec(p.name);
    return Math.max(max, match ? Number(match[1]) : 0);
  },
  counter.current
);
      resetSim();
      setState({ projects, activeId: restored.activeId });
      setSelectedId(null);
      setMessage(`Opened ${projects.length} project(s), including all saved topic workspaces.`);
    } catch (err) {
      setMessage(`Could not open: ${err.message}`);
    }
  };

  // ----- tools and actions -----
  const runAction = (id) => {
    if (id === "grid") setGrid((g) => !g);
    else if (id === "axes") setAxes((a) => !a);
    else if (id === "snap") setSnap((v) => !v);
    else if (id === "zoomIn") updateActive((p) => ({ ...p, view: zoomView(p.view, 1.25) }));
    else if (id === "zoomOut") updateActive((p) => ({ ...p, view: zoomView(p.view, 0.8) }));
    else if (id === "zoomFit") updateActive((p) => ({ ...p, view: fitRoom(p.env, sizeRef.current) }));
    else if (id === "zoomReset") updateActive((p) => ({ ...p, view: { ...p.view, scale: DEFAULT_VIEW.scale } }));
    else if (id === "answers") {
      setRightTab("answers");
      setPropsOpen(true);
    } else if (id === "results") {
      setRightTab("results");
      setPropsOpen(true);
    } else if (id === "play") playSim();
    else if (id === "pause") pauseSim();
    else if (id === "reset") resetSim();
    else if (id === "undo") undo();
    else if (id === "redo") redo();
    else if (id === "delete") deleteSelected();
    else if (id === "save") saveProject(false);
    else if (id === "saveAs") saveProject(true);
    else if (id === "open") openProject();
  };
  runRef.current = runAction;

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
    const found = findTools(q, tools)[0];
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
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        runRef.current(e.shiftKey ? "saveAs" : "save");
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        runRef.current("open");
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

  // ----- autosave: read the saved workspace at start, then keep it up to date -----
  useEffect(() => {
    let cancelled = false;
    loadWorkspace().then((saved) => {
      if (cancelled) return;
      if (saved) {
        counter.current = saved.projects.reduce(
          (m, p) => Math.max(m, Number((/^Project (\d+)$/.exec(p.name) || [])[1]) || 0),
          saved.projects.length
        );
        setState(saved);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => saveWorkspace(workspaceToJson(state.projects, state.activeId, {})), 500);
    return () => clearTimeout(t);
  }, [ready, state]);

  useEffect(() => {
    const flush = () => {
      if (stateRef.current && ready) saveWorkspaceNow(workspaceToJson(stateRef.current.projects, stateRef.current.activeId, {}));
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [ready]);

  // Messages from the updater ("Update found", "Update ready")
  useEffect(() => (window.api && window.api.onUpdate ? window.api.onUpdate(setMessage) : undefined), []);

  if (!ready) return <div className="app" />;

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
        topic={topic}
        onTopic={active ? switchTopic : undefined}
      />

      <Ribbon tools={tools.filter((t) => t.ready)} activeTool={activeTool} toggles={{ grid, axes, snap }} onActivate={activate} topicName={topic !== "sandbox" ? topicById(topic).name : null} />

      <div className="workspace" >
        <LeftBar tools={tools.filter((t) => t.ready)} activeTool={activeTool} onActivate={activate} />
        {active ? (
          <CanvasView
            key={active.id}
            view={active.view}
            grid={grid}
            axes={axes}
            snap={snap}
            tool={tool}
            env={simStatus !== "idle" && simEnvRef.current ? simEnvRef.current : active.env}
            pins={pins}
            scene={shownScene}
            selectedId={selectedItem ? selectedItem.id : null}
            onView={(view) => updateActive((p) => ({ ...p, view }))}
            onSize={(s) => {
              sizeRef.current = s;
            }}
            onCursor={setCursor}
            onSelect={selectItem}
            overlay={answers}
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
        {headline.some((h) => h.chips.length) && (
          <div className="answer-strip" onClick={() => { setRightTab("answers"); setPropsOpen(true); }} title="Open the Answers">
            {headline.filter((h) => h.chips.length).map((h) => (
              <div key={h.id} className="answer-card">
                <b>{h.title}</b>
                {h.chips.map((c) => (
                  <span key={c.label}>{c.label} <em>{Math.round(c.value * 100) / 100} {c.unit}</em></span>
                ))}
              </div>
            ))}
          </div>
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
          answers={answers}
        />
      </div>

      <CommandBar message={message} onRun={runCommand} tools={tools} />

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