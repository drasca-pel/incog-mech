// Checks the saved-projects library and the phone/desktop choice. Run with:  node tests/library.test.mjs
// (a pretend browser storage is used, so this runs in plain Node)
const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  },
};
const { listProjects, saveToLibrary, loadFromLibrary, deleteFromLibrary, renameInLibrary, duplicateInLibrary, exportText, importText, formatWhen, libraryAvailable } = await import("../src/core/library.js");
const { detectLayout } = await import("../src/mobile/useLayout.js");
const { newProject } = await import("../src/core/projects.js");
const { applyTopic, TOPICS } = await import("../src/core/topics.js");
const { addItem } = await import("../src/core/scene.js");
await import("../src/tools/index.js");

let pass = 0, fail = 0;
const yes = (name, c) => { if (c) pass++; else { fail++; console.log("  FAIL " + name); } };

console.log("Layout choice");
{
  yes("phone portrait", detectLayout({ width: 390, height: 844, coarse: true }).mode === "phone");
  yes("phone landscape", detectLayout({ width: 844, height: 390, coarse: true }).mode === "phone" && detectLayout({ width: 844, height: 390, coarse: true }).landscape);
  yes("laptop", detectLayout({ width: 1366, height: 768, coarse: false }).mode === "desktop");
  yes("tablet portrait stays desktop", detectLayout({ width: 820, height: 1180, coarse: true }).mode === "desktop");
  yes("narrow window is phone", detectLayout({ width: 700, height: 900, coarse: false }).mode === "phone");
  yes("override phone", detectLayout({ width: 1600, height: 900, coarse: false, override: "phone" }).mode === "phone");
  yes("override desktop", detectLayout({ width: 390, height: 844, coarse: true, override: "desktop" }).mode === "desktop");
}

console.log("My projects");
{
  yes("storage available", libraryAvailable());
  // a project with a drawing in two topics
  let p = newProject(1);
  p.name = "Friction and collision";
  const size = { w: 1000, h: 580 };
  p = applyTopic(p, "dynamics", size);
  p = { ...p, scene: addItem(p.scene, { type: "block", x: 1, y: 0.4, w: 1.2, h: 0.8, mass: 5, friction: 0.4, rotation: 0, label: "A" }).scene };
  p = applyTopic(p, "collisions", size);
  p = { ...p, scene: addItem(p.scene, { type: "ball", x: 0, y: 0, radius: 0.35, mass: 1, friction: 0, bounce: 1, speed0: 4, angle0: 0, label: "puck" }).scene };

  const t0 = 1_000_000;
  const e1 = saveToLibrary(p, { thumb: "data:image/jpeg;base64,AAAA", now: t0 });
  yes("entry made", e1.id && e1.name === "Friction and collision" && e1.topic === "collisions");
  yes("counts every topic's objects", e1.items === 2);
  yes("listed", listProjects().length === 1 && listProjects()[0].thumb.startsWith("data:image"));

  const back = loadFromLibrary(e1.id, 5);
  yes("name comes back", back.name === "Friction and collision" && back.libraryId === e1.id);
  yes("current topic drawing comes back", back.topic === "collisions" && back.scene.items.length === 1 && back.scene.items[0].label === "puck");
  const dyn = applyTopic(back, "dynamics", size);
  yes("other topic drawing comes back too", dyn.scene.items.length === 1 && dyn.scene.items[0].label === "A");
  const again = applyTopic(dyn, "collisions", size);
  yes("and back again", again.scene.items.length === 1 && again.scene.items[0].label === "puck");
  yes("the room of each topic is kept", again.gravity === 0 && again.env.ceiling.on === true && dyn.gravity === 9.81);

  // saving again replaces the same entry
  const e2 = saveToLibrary({ ...back, name: "Renamed in place" }, { now: t0 + 5000 });
  yes("same entry is replaced", e2.id === e1.id && listProjects().length === 1 && listProjects()[0].name === "Renamed in place");

  renameInLibrary(e1.id, "  My lab  ");
  yes("rename", listProjects()[0].name === "My lab" && loadFromLibrary(e1.id).name === "My lab");
  renameInLibrary(e1.id, "   ");
  yes("empty rename ignored", listProjects()[0].name === "My lab");

  const copy = duplicateInLibrary(e1.id, t0 + 9000);
  yes("copy is separate", copy.id !== e1.id && copy.name === "My lab copy" && listProjects().length === 2);
  yes("newest first", listProjects()[0].id === copy.id);

  // sharing as a file and bringing it back in
  const text = exportText(e1.id);
  const imported = importText(text, t0 + 20000);
  yes("import makes a new entry", imported.id !== e1.id && listProjects().length === 3);
  const imp = loadFromLibrary(imported.id);
  yes("imported project is complete", imp.workspaces && Object.keys(imp.workspaces).length >= 1 && imp.name === "My lab");
  let bad = false; try { importText("not a project"); } catch { bad = true; }
  yes("a junk file is refused", bad);
  let missing = false; try { loadFromLibrary("nope"); } catch { missing = true; }
  yes("a missing project gives a clear message", missing);

  deleteFromLibrary(copy.id);
  yes("delete", listProjects().length === 2 && !listProjects().some((x) => x.id === copy.id));
  yes("times", formatWhen(1_000_000, 1_000_000 + 30000) === "just now" && formatWhen(1_000_000, 1_000_000 + 5 * 60000) === "5 min ago" && formatWhen(1_000_000, 1_000_000 + 3 * 3600000) === "3 h ago");
  // every topic can be saved and opened
  for (const t of TOPICS) {
    const q = applyTopic(newProject(9), t.id, size);
    const en = saveToLibrary(q, { now: t0 + 30000 });
    yes(`topic ${t.id} saves and opens`, loadFromLibrary(en.id).topic === t.id);
  }
}
console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
