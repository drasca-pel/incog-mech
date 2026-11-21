// "My projects": named projects kept on the device, like the project list of a circuit simulator.
// Each saved project holds EVERYTHING in it: the drawing, and the separate workspace of every topic
// (projectile, forces, collisions...), so opening it brings back all of it.
//
// They live in the browser's local storage (on a phone: inside the installed app).
// A project can also be exported to a file and imported again, to move it to another device.
import { projectFileJson, projectFromFileText } from "./storage.js";

const INDEX_KEY = "incog-library-v1";
const ITEM_KEY = (id) => `incog-project-v1:${id}`;

const store = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

const readIndex = () => {
  const s = store();
  if (!s) return [];
  try {
    const list = JSON.parse(s.getItem(INDEX_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const writeIndex = (list) => store().setItem(INDEX_KEY, JSON.stringify(list));

export const libraryAvailable = () => store() !== null;

// Newest first. Each entry: { id, name, topic, updated, items, thumb }
export const listProjects = () => readIndex().sort((a, b) => b.updated - a.updated);

const countItems = (p) => (p.scene && p.scene.items ? p.scene.items.length : 0) + Object.values(p.workspaces || {}).reduce((n, w) => n + (w.scene && w.scene.items ? w.scene.items.length : 0), 0);

// Save a project (a new entry, or replace the entry with the same libraryId). Returns the entry.
export function saveToLibrary(project, { thumb = null, now = Date.now() } = {}) {
  const s = store();
  if (!s) throw new Error("This device does not allow saving here.");
  const id = project.libraryId || `p${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const entry = { id, name: project.name, topic: project.topic || "sandbox", updated: now, items: countItems(project), thumb };
  try {
    s.setItem(ITEM_KEY(id), projectFileJson({ ...project, libraryId: id }));
  } catch {
    throw new Error("The device storage is full. Delete some saved projects and try again.");
  }
  const rest = readIndex().filter((e) => e.id !== id);
  writeIndex([entry, ...rest]);
  return entry;
}

// Read one back as a project ready to open. It gets a fresh tab number.
export function loadFromLibrary(id, number = 1) {
  const s = store();
  const text = s && s.getItem(ITEM_KEY(id));
  if (!text) throw new Error("That project is no longer saved on this device.");
  const p = projectFromFileText(text, number);
  return { ...p, libraryId: id };
}

export function deleteFromLibrary(id) {
  const s = store();
  if (!s) return;
  s.removeItem(ITEM_KEY(id));
  writeIndex(readIndex().filter((e) => e.id !== id));
}

export function renameInLibrary(id, name) {
  const n = String(name || "").trim();
  if (!n) return;
  const s = store();
  const text = s && s.getItem(ITEM_KEY(id));
  if (!text) return;
  const raw = JSON.parse(text);
  raw.project.name = n;
  s.setItem(ITEM_KEY(id), JSON.stringify(raw));
  writeIndex(readIndex().map((e) => (e.id === id ? { ...e, name: n } : e)));
}

// A copy under a new name
export function duplicateInLibrary(id, now = Date.now()) {
  const p = loadFromLibrary(id);
  return saveToLibrary({ ...p, libraryId: null, name: `${p.name} copy` }, { now });
}

// The text of a project, for sharing as a file
export const exportText = (id) => {
  const s = store();
  const text = s && s.getItem(ITEM_KEY(id));
  if (!text) throw new Error("That project is no longer saved on this device.");
  return text;
};

// Bring a shared file in as a new saved project
export function importText(text, now = Date.now()) {
  const p = projectFromFileText(text, 1);
  return saveToLibrary({ ...p, libraryId: null }, { now });
}

export const formatWhen = (t, now = Date.now()) => {
  if (now - t < 45000) return "just now";
  const mins = Math.max(1, Math.round((now - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString();
};
