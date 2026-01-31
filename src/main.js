// === LUKER LAUNCHER CORE ===
// Main entry for the Electron app: window creation and lifecycle hooks.

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    console.log("Creating window...");
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        resizable: false,
        title: "Argentibia Launcher",
        icon: path.join(__dirname, 'assets', 'argentibia_icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    const htmlPath = path.join(__dirname, 'index.html');
    console.log("Loading:", htmlPath);

    win.loadFile(htmlPath)
        .then(() => console.log("Window loaded successfully"))
        .catch((err) => console.error("Error loading window:", err));

    win.removeMenu();

    ipcMain.handle("choose-install-path", async () => {
        const result = await dialog.showOpenDialog(win, {
            title: "Choose install folder",
            properties: ["openDirectory", "createDirectory"],
        });
        return result;
    });
}

app.whenReady().then(() => {
    console.log("Electron ready!");
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
