const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

// ---------- saving to disk ----------
const workspaceFile = () => path.join(app.getPath("userData"), "workspace.json");
// This app saves its own .incogmech files so they never clash with other apps that use .incog.
// Old .incog files made by this app can still be opened.
const FILTERS = [{ name: "INCOG Mechanics workspace or project", extensions: ["incogmech", "incog"] }];

// Write to a temporary file first, then swap it in. If the computer dies half way through,
// the old save is still there and untouched, never a half-written file.
function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}

const withExt = (file) => (/\.incogmech$/i.test(file) ? file : `${file.replace(/\.incog$/i, "")}.incogmech`);

// The autosaved workspace (all open tabs)
ipcMain.handle("workspace:load", () => {
  try {
    return fs.readFileSync(workspaceFile(), "utf8");
  } catch {
    return null;
  }
});
ipcMain.handle("workspace:save", (_event, text) => {
  try {
    writeAtomic(workspaceFile(), String(text));
    return true;
  } catch {
    return false;
  }
});
// Used when the window is closing: the window waits for this one to finish
ipcMain.on("workspace:saveSync", (event, text) => {
  try {
    writeAtomic(workspaceFile(), String(text));
    event.returnValue = true;
  } catch {
    event.returnValue = false;
  }
});

// One project saved to a file you choose
ipcMain.handle("project:saveAs", async (event, suggestedName, text) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: "Save project",
    defaultPath: path.join(app.getPath("documents"), `${suggestedName || "Project"}.incogmech`),
    filters: FILTERS,
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const file = withExt(result.filePath);
  try {
    writeAtomic(file, String(text));
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Save again to the file the project already has (Ctrl+S after the first save)
ipcMain.handle("project:save", (_event, file, text) => {
  if (typeof file !== "string" || !/\.incog(mech)?$/i.test(file)) return { ok: false, error: "not a project file path." };
  try {
    writeAtomic(file, String(text));
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("project:open", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: "Open project",
    defaultPath: app.getPath("documents"),
    properties: ["openFile"],
    filters: FILTERS,
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    return { ok: true, path: result.filePaths[0], content: fs.readFileSync(result.filePaths[0], "utf8") };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---------- the window ----------
let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    title: "INCOG Mechanics",
    icon: path.join(__dirname, "../build/icon.png"),
    backgroundColor: "#0c111d",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.removeMenu(); // no File/Edit/View bar hidden at the top
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {}); // stops pinch-zoom from scaling the whole window
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" })); // the app never opens extra windows

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow = win;
  win.on("closed", () => {
    mainWindow = null;
  });
  return win;
}

// ---------- updates ----------
// The installed app checks GitHub Releases when it starts. If a newer version is there it is
// downloaded quietly, then you are asked to restart. If you choose Later it installs when you quit.
function setupUpdates(win) {
  if (!app.isPackaged) return; // only the installed app updates itself, not "npm run dev"
  const tell = (message) => {
    if (!win.isDestroyed()) win.webContents.send("update:status", message);
  };
  autoUpdater.on("update-available", (info) => tell(`Update ${info.version} found. Downloading in the background...`));
  autoUpdater.on("update-downloaded", async (info) => {
    tell(`Update ${info.version} is ready. It installs when you restart the app.`);
    const choice = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: `INCOG Mechanics ${info.version} is ready to install.`,
      detail: "Your work is saved automatically. Restart to finish updating.",
    });
    if (choice.response === 0) autoUpdater.quitAndInstall();
  });
  // Offline is normal for this app, so a failed check is ignored quietly
  autoUpdater.on("error", () => {});
  autoUpdater.checkForUpdates().catch(() => {});
}

// ---------- start ----------
// Only one copy of the app at a time, so two windows can never overwrite each other's saves
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null); // the app has its own ribbon, so the system menu is removed completely
    setupUpdates(createWindow());
  });
  app.on("window-all-closed", () => app.quit());
}