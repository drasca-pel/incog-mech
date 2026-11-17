const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    title: "INCOG Mechanics",
    backgroundColor: "#0c111d",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
    win.webContents.setVisualZoomLevelLimits(1, 1); // stops pinch-zoom from scaling the whole window

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());