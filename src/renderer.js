// =========================================
// LUKER LAUNCHER — PHASE 3
// Handles installation, updates, and launching
// =========================================

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { exec } = require("child_process");
const { ipcRenderer } = require("electron");
const os = require("os");
const https = require("https");
const http = require("http");

// ===== CONFIGURATION =====

const GAME_NAME = "Argentibia";
// Default install folder (for admin installs)
const INSTALL_PATH = path.join("C:\\Program Files", GAME_NAME);
// Fallback for users without admin rights
const FALLBACK_PATH = path.join(process.env.LOCALAPPDATA || ".", GAME_NAME);
// Config to remember user-selected install path
const CONFIG_DIR = path.join(process.env.LOCALAPPDATA || ".", `${GAME_NAME}Launcher`);
const LEGACY_CONFIG_DIR = path.join(process.env.LOCALAPPDATA || ".", "LukerLauncher");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const LOG_PATH = path.join(CONFIG_DIR, "launcher.log");
// Executable path inside client structure
const CLIENT_EXE_RELATIVE = path.join("bin", "client.exe");
const CHOSEN_DIR_NAME = GAME_NAME;
let runningClient = null;

// Remote resources
const REMOTE_VERSION_URL =
    "https://raw.githubusercontent.com/luker-development/luker-otclient/main/updater/version.txt";
const GITHUB_RELEASES_API =
    "https://api.github.com/repos/luker-development/luker-otclient/releases/latest";

const PERMISSION_ERRORS = new Set(["EACCES", "EPERM"]);

const UI = {
    status: document.getElementById("status"),
    button: document.getElementById("checkUpdates"),
    progress: document.getElementById("progressBar"),
    installPath: document.getElementById("installPath"),
    choosePath: document.getElementById("choosePath"),
};

// ===== CORE UTILITIES =====

function logDebug(...args) {
    const message = args.map(String).join(" ");
    console.log(message);
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`);
    } catch {
        /* best effort */
    }
}

function logStatus(message) {
    logDebug(message);
    if (UI.status) UI.status.textContent = message;
}

function resetProgress() {
    if (!UI.progress) return;
    UI.progress.value = 0;
    UI.progress.max = 100;
}

function indeterminateProgress() {
    if (!UI.progress) return () => {};
    let forward = true;
    UI.progress.max = 100;
    UI.progress.value = 0;
    const timer = setInterval(() => {
        const delta = forward ? 4 : -4;
        let next = UI.progress.value + delta;
        if (next >= 100) {
            next = 100;
            forward = false;
        } else if (next <= 0) {
            next = 0;
            forward = true;
        }
        UI.progress.value = next;
    }, 120);
    return () => clearInterval(timer);
}

function isPermissionError(err) {
    if (!err) return false;
    return PERMISSION_ERRORS.has(err.code) || /permission/i.test(err.message || "");
}

function httpClientFor(url) {
    return url.startsWith("https") ? https : http;
}

function fetchText(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const client = httpClientFor(url);
        const req = client.get(url, { headers }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchText(res.headers.location, headers).then(resolve).catch(reject);
            }
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`HTTP ${res.statusCode || "ERR"}`));
            }
            let data = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
        });
        req.on("error", reject);
    });
}

function fetchJson(url, headers = {}) {
    return fetchText(url, headers).then((txt) => JSON.parse(txt));
}

function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const client = httpClientFor(url);
        const req = client.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
            }
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Download failed HTTP ${res.statusCode || "ERR"}`));
            }
            const totalLength = parseInt(res.headers["content-length"] || "0", 10);
            const writer = fs.createWriteStream(dest);
            let downloaded = 0;
            res.on("data", (chunk) => {
                downloaded += chunk.length;
                if (onProgress) onProgress(downloaded, totalLength);
            });
            res.pipe(writer);
            writer.on("finish", () => resolve({ downloaded, totalLength }));
            writer.on("error", reject);
        });
        req.on("error", reject);
    });
}

function ensureConfigDir() {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        return true;
    } catch {
        return false;
    }
}

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
        }
        const legacyPath = path.join(LEGACY_CONFIG_DIR, "config.json");
        if (fs.existsSync(legacyPath)) {
            return JSON.parse(fs.readFileSync(legacyPath, "utf8"));
        }
        return {};
    } catch {
        return {};
    }
}

function saveConfig(config) {
    if (!ensureConfigDir()) return;
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch {
        // best-effort
    }
}

function ensureWritableDirectory(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        const testFile = path.join(dir, ".write-test.tmp");
        fs.writeFileSync(testFile, "ok");
        fs.unlinkSync(testFile);
        return true;
    } catch (err) {
        console.error(`Write check failed for ${dir}:`, err.message);
        return false;
    }
}

function getInstallPath() {
    const config = loadConfig();
    const preferred = config.installPath;
    const defaultPath = INSTALL_PATH;
    const fallbackPath = FALLBACK_PATH;

    if (preferred && ensureWritableDirectory(preferred)) return preferred;
    if (ensureWritableDirectory(defaultPath)) return defaultPath;
    if (ensureWritableDirectory(fallbackPath)) {
        logStatus("No admin permissions, using LocalAppData.");
        saveConfig({ installPath: fallbackPath });
        return fallbackPath;
    }

    // As a last resort, keep trying default path (will throw and be surfaced in logs)
    return defaultPath;
}

async function ensureInstallPathChoice() {
    const existingConfig = loadConfig();
    if (!existingConfig.installPath) {
        const firstChoice = await promptInstallPath(false);
        if (firstChoice && ensureWritableDirectory(firstChoice)) return firstChoice;
    }

    const current = getInstallPath();
    if (ensureWritableDirectory(current)) return current;

    logStatus("Current install path is not writable. Please choose where to install.");
    const chosen = await promptInstallPath(true);
    if (chosen && ensureWritableDirectory(chosen)) return chosen;
    throw new Error("No writable install path available");
}

function getLocalVersion(installDir) {
    const versionPath = path.join(installDir, "updater", "version.txt");
    if (!fs.existsSync(versionPath)) return "0.0.0";
    return fs.readFileSync(versionPath, "utf8").trim();
}

async function getRemoteVersion() {
    try {
        const response = await fetchText(REMOTE_VERSION_URL);
        return response.trim();
    } catch (err) {
        logDebug("getRemoteVersion error:", err.message);
        return null;
    }
}

function compareVersions(local, remote) {
    const toNum = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
    const [a1, b1, c1] = toNum(local);
    const [a2, b2, c2] = toNum(remote);

    if (a1 < a2 || (a1 === a2 && b1 < b2) || (a1 === a2 && b1 === b2 && c1 < c2))
        return "update";
    if (a1 === a2 && b1 === b2 && c1 === c2) return "up-to-date";
    return "ahead";
}

async function extractZip(zipPath, targetDir) {
    const finalTarget = normalizeInstallPath(targetDir);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${GAME_NAME}-extract-`));
    await new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(zipPath);
            zip.extractAllToAsync(tempDir, true, (err) => {
                if (err) return reject(err);
                resolve();
            });
        } catch (e) {
            reject(e);
        }
    });

    try {
        fs.rmSync(finalTarget, { recursive: true, force: true });
    } catch (err) {
        console.error("Failed to clear install directory:", err);
        if (isPermissionError(err)) throw err;
    }

    try {
        fs.mkdirSync(path.dirname(finalTarget), { recursive: true });
        const entries = fs.readdirSync(tempDir);
        // If the ZIP already contains a root folder named like the game, preserve it; otherwise copy into finalTarget.
        if (entries.length === 1 && entries[0].toLowerCase() === CHOSEN_DIR_NAME.toLowerCase()) {
            fs.cpSync(path.join(tempDir, entries[0]), finalTarget, { recursive: true, force: true });
        } else {
            fs.mkdirSync(finalTarget, { recursive: true });
            fs.cpSync(tempDir, finalTarget, { recursive: true, force: true });
        }
    } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
}

// ===== DOWNLOAD & EXTRACTION =====

async function downloadLatestRelease(targetDir) {
    logStatus("Fetching latest release info...");
    resetProgress();

    const finalTarget = normalizeInstallPath(targetDir);

    if (!ensureWritableDirectory(finalTarget)) {
        logStatus("Install folder is not writable. Please choose another location.");
        throw new Error("Install folder not writable");
    }

    let stopIndeterminate = null;
    let currentZipPath = null;

    try {
        const release = await fetchJson(GITHUB_RELEASES_API, { "User-Agent": `${GAME_NAME}Launcher` });
        logDebug("GitHub API fetched:", release.tag_name);

        if (!release || !release.assets) {
            logStatus("No assets found in GitHub release data.");
            console.error("Full API response:", release);
            return;
        }

        const asset = release.assets.find((a) => a.name.endsWith(".zip"));
        if (!asset) {
            logStatus("No ZIP file found in the latest release.");
            console.error("Assets available:", release.assets.map((a) => a.name));
            return;
        }

        // Download to a temp location to avoid clobbering existing files in install dir
        const zipPath = path.join(os.tmpdir(), `${GAME_NAME}-${asset.name}`);
        currentZipPath = zipPath;
        logStatus(`Preparing to download: ${asset.name}`);
        console.log("Asset URL:", asset.browser_download_url);

        let totalLength = 0;
        const progressFn = (downloaded, total) => {
            totalLength = total;
            if (!UI.progress) return;
            if (Number.isFinite(total) && total > 0) {
                UI.progress.max = total;
                UI.progress.value = downloaded;
                const percent = ((downloaded / total) * 100).toFixed(1);
                if (UI.status) UI.status.textContent = `Downloading... ${percent}%`;
            } else {
                if (!stopIndeterminate) stopIndeterminate = indeterminateProgress();
                if (UI.status) UI.status.textContent = "Downloading...";
            }
        };

        await downloadFile(asset.browser_download_url, zipPath, progressFn);

        if (stopIndeterminate) stopIndeterminate();
        if (UI.progress && Number.isFinite(totalLength) && totalLength > 0) {
            UI.progress.value = UI.progress.max;
        }

        logStatus(`Extracting files to: ${targetDir}`);
        await extractZip(zipPath, finalTarget);

        try { if (currentZipPath) fs.unlinkSync(currentZipPath); } catch {}
        logStatus("Installation complete!");
        resetProgress();
    } catch (err) {
        if (stopIndeterminate) stopIndeterminate();
        const detail = err && (err.message || err.code || err.toString()) || "Unknown error";
        logStatus(`Failed to download or extract release${detail ? `: ${detail}` : ""}`);
        console.error("Error message:", err.message);
        console.error("Stack trace:", err.stack);
        if (currentZipPath) {
            try { fs.unlinkSync(currentZipPath); } catch {}
        }
        throw err;
    }
}

// ===== LAUNCH GAME =====

function launchClient(installDir) {
    if (runningClient && !runningClient.killed) {
        logStatus("Client is already running.");
        return;
    }

    const clientPath = path.join(installDir, CLIENT_EXE_RELATIVE);
    if (!fs.existsSync(clientPath)) {
        logStatus("Client executable not found!");
        return;
    }

    logStatus("Launching game...");
    runningClient = exec(`"${clientPath}"`);
    runningClient.on("error", (err) => {
        logStatus(`Failed to launch client: ${err.message}`);
        runningClient = null;
    });
    runningClient.on("exit", (code, signal) => {
        const reason = signal ? `signal ${signal}` : (code === 0 || code === null ? "closed" : `code ${code}`);
        logStatus(`Client exited (${reason}).`);
        runningClient = null;
    });
}

// ===== MAIN LOGIC =====

async function checkAndInstall() {
    if (!UI.button) return;
    UI.button.disabled = true;
    resetProgress();

    try {
        let installDir = normalizeInstallPath(await ensureInstallPathChoice());
        const clientExe = path.join(installDir, CLIENT_EXE_RELATIVE);
        const localVersion = getLocalVersion(installDir);
        const remoteVersion = await getRemoteVersion();

        if (!fs.existsSync(clientExe)) {
            logStatus("Client not installed. Starting installation...");
            try {
                await downloadLatestRelease(installDir);
            } catch (err) {
                if (isPermissionError(err)) {
                    const chosen = await promptInstallPath(true);
                    if (chosen) {
                        installDir = chosen;
                        await downloadLatestRelease(installDir);
                    }
                } else {
                    throw err;
                }
            }
            UI.button.textContent = "Play";
            UI.button.disabled = false;
            UI.button.onclick = () => launchClient(installDir);
            return;
        }

        if (!remoteVersion) {
            logStatus("Could not fetch remote version.");
            return;
        }

        const status = compareVersions(localVersion, remoteVersion);
        if (status === "update") {
            logStatus(`Update available (${localVersion} -> ${remoteVersion})`);
            await downloadLatestRelease(installDir);
        } else if (status === "up-to-date") {
            logStatus(`Up to date (v${localVersion})`);
        } else {
            logStatus(`Developer build (local ${localVersion})`);
        }

        UI.button.textContent = "Play";
        UI.button.onclick = () => launchClient(installDir);
    } catch (err) {
        if (isPermissionError(err)) {
            logStatus("Installation stopped: no permission to write to the chosen folder.");
        } else {
            const detail = err && (err.message || err.code || err.toString());
            logStatus(`Installation failed${detail ? `: ${detail}` : ""}`);
        }
    } finally {
        UI.button.disabled = false;
    }
}

// ===== INIT =====

window.addEventListener("DOMContentLoaded", () => {
    try {
        if (UI.button) UI.button.addEventListener("click", checkAndInstall);
        if (UI.choosePath) UI.choosePath.addEventListener("click", () => promptInstallPath(true));
        refreshInstallPathLabel();
        logStatus("Ready.");
    } catch (err) {
        logDebug("Init error:", err.message);
        if (UI.status) UI.status.textContent = `Init failed: ${err.message}`;
    }
});

// ===== INSTALL PATH UI =====

function refreshInstallPathLabel() {
    const current = getInstallPath();
    if (UI.installPath) UI.installPath.textContent = current;
}

async function promptInstallPath(forcePrompt = false) {
    if (promptInstallPath._open) return null;
    promptInstallPath._open = true;

    let result;
    try {
        result = await ipcRenderer.invoke("choose-install-path");
    } catch (err) {
        logStatus(`Cannot open folder picker: ${err.message}`);
        promptInstallPath._open = false;
        return null;
    }
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        if (forcePrompt) logStatus("No install folder selected. Install cancelled.");
        promptInstallPath._open = false;
        return null;
    }
    const chosen = normalizeInstallPath(result.filePaths[0]);
    if (!ensureWritableDirectory(chosen)) {
        logStatus("Selected folder is not writable. Please choose another location.");
        promptInstallPath._open = false;
        return null;
    }
    const config = loadConfig();
    config.installPath = chosen;
    saveConfig(config);
    refreshInstallPathLabel();
    logStatus(`Install path set to: ${chosen}`);
    logDebug("Install path chosen:", chosen);
    promptInstallPath._open = false;
    return chosen;
}
promptInstallPath._open = false;

function normalizeInstallPath(chosenPath) {
    const base = path.basename(chosenPath).toLowerCase();
    if (base === CHOSEN_DIR_NAME.toLowerCase()) return chosenPath;
    return path.join(chosenPath, CHOSEN_DIR_NAME);
}

if (UI.choosePath) {
    UI.choosePath.addEventListener("click", promptInstallPath);
    refreshInstallPathLabel();
}
