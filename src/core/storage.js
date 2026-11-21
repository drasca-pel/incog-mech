// Saving and loading. Two kinds of saving happen:
//
//  1. Autosave: every open project is kept in one workspace file inside the app's own data
//     folder. It is written a moment after each change and read back when the app starts,
//     so closing the app never loses work.
//  2. Save / Open: one project written to a .incog file you choose (Documents, a USB stick...), named .incogmech.
//
// In the desktop app the work is done by electron/main.cjs, reached through window.api
// (see electron/preload.cjs). In a normal browser (npm run dev) autosave uses localStorage instead.
import { newProject, DEFAULT_VIEW } from "./projects.js";
import { newEnv } from "./env.js";
import { itemType } from "./itemTypes.js";

const FORMAT = 1; // bump this if the saved layout ever changes in a way old files cannot be read
const LS_KEY = "incog-mech-workspace";

export const hasDesktop = () => typeof window !== "undefined" && Boolean(window.api);

// ----- one project <-> plain data -----

// What is written to disk. Undo history and the running simulation are not saved.
export const projectToData = (p) => ({
  name: p.name,
  topic: p.topic,
  view: p.view,
  gravity: p.gravity,
  env: p.env,
  viewed: p.viewed,
  scene: p.scene,
  workspaces: p.workspaces || {},
  libraryId: p.libraryId || null,
});

// Turn data read from disk back into a full project. Anything missing gets its default,
// so files written by an older version of the app still open.
export function projectFromData(d, number = 1) {
  if (!d || typeof d !== "object" || !d.scene || !Array.isArray(d.scene.items)) {
    throw new Error("this file is not an INCOG Mechanics project.");
  }
  const base = newProject(number);
  const env = newEnv();
  for (const part of Object.keys(env)) env[part] = { ...env[part], ...(d.env && d.env[part]) };
  const items = d.scene.items.filter((i) => i && itemType(i.type)); // skip anything this version does not know
  const maxId = items.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0);
  return {
    ...base,
    topic: typeof d.topic === "string" ? d.topic : "sandbox",
    name: typeof d.name === "string" && d.name.trim() ? d.name : base.name,
    view: { ...DEFAULT_VIEW, ...d.view },
    gravity: typeof d.gravity === "number" ? d.gravity : 9.81,
    env,
    viewed: Array.isArray(d.viewed) ? d.viewed : [],
    scene: { items, nextId: Math.max(Number(d.scene.nextId) || 1, maxId + 1) },
    workspaces: d.workspaces && typeof d.workspaces === "object" ? d.workspaces : {},
    filePath: typeof d.filePath === "string" ? d.filePath : null,
    libraryId: typeof d.libraryId === "string" ? d.libraryId : null,
  };
}

// ----- a single .incog file -----
export const projectFileJson = (p) =>
  JSON.stringify({ app: "incog-mech", format: FORMAT, project: projectToData(p) }, null, 1);

export function projectFromFileText(text, number) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("this file is damaged or is not an INCOG Mechanics project.");
  }
  if (!raw || raw.app !== "incog-mech") throw new Error("this file was not made by INCOG Mechanics (it may belong to another app).");
  return projectFromData(raw.project, number);
}

// A .incogmech file stores the COMPLETE workspace: all project tabs and all topic workspaces.
export const workspaceFileJson = (projects, activeId) =>
  JSON.stringify({ app: "incog-mech", format: FORMAT, kind: "workspace", ...JSON.parse(workspaceToJson(projects, activeId)) }, null, 1);

export function workspaceFromFileText(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch { throw new Error("This file is damaged or is not a valid INCOG Mechanics file."); }
  if (!raw || raw.app !== "incog-mech") throw new Error("This file was not created by INCOG Mechanics.");
  if (Array.isArray(raw.projects)) {
    const restored = workspaceFromJson(text);
    if (!restored || !restored.projects.length) throw new Error("No valid projects were found in this file.");
    return restored;
  }
  // Older versions saved one project per file. Continue to support those files.
  if (raw.project) {
    const project = projectFromData(raw.project, 1);
    return { projects: [project], activeId: project.id, extra: {} };
  }
  throw new Error("This INCOG Mechanics file contains no projects.");
}

// ----- the whole workspace (all tabs) -----
export function workspaceToJson(projects, activeId, extra = {}) {
  return JSON.stringify({
    app: "incog-mech",
    format: FORMAT,
    activeId,
    extra,
    projects: projects.map((p) => ({ ...projectToData(p), id: p.id, filePath: p.filePath || null })),
  });
}

export function workspaceFromJson(text) {
  try {
    const raw = JSON.parse(text);
    if (!raw || !Array.isArray(raw.projects)) return null;
    let n = 0;
    const projects = [];
    for (const d of raw.projects) {
      try {
        n += 1;
        const p = projectFromData(d, n);
        if (typeof d.id === "string") p.id = d.id; // keep the same tab ids so the active tab is remembered
        projects.push(p);
      } catch {
        // one damaged project must not stop the others from opening
      }
    }
    const activeId = projects.some((p) => p.id === raw.activeId) ? raw.activeId : projects[0]?.id ?? null;
    return { projects, activeId, extra: raw.extra && typeof raw.extra === "object" ? raw.extra : {} };
  } catch {
    return null;
  }
}

// ----- reading and writing the workspace -----
export async function loadWorkspace() {
  try {
    const text = hasDesktop() ? await window.api.loadWorkspace() : window.localStorage.getItem(LS_KEY);
    return text ? workspaceFromJson(text) : null;
  } catch {
    return null;
  }
}

export async function saveWorkspace(json) {
  try {
    if (hasDesktop()) await window.api.saveWorkspace(json);
    else window.localStorage.setItem(LS_KEY, json);
  } catch {
    // if the disk is full or locked there is nothing useful to do here; the next change tries again
  }
}

// Used while the window is closing: waits until the file is really written
export function saveWorkspaceNow(json) {
  try {
    if (hasDesktop()) window.api.saveWorkspaceSync(json);
    else window.localStorage.setItem(LS_KEY, json);
  } catch {
    // nothing more can be done at this point
  }
}