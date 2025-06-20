import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import os from "os"; // Importiere 'os' um TEMP-Verzeichnis zu finden
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess;
let mainWindow; // Fenster global halten für Debugging

// Funktion zum Schreiben von Logs in eine Datei
function writeLog(message) {
    const logDir = path.join(os.tmpdir(), "OptiFlowLogs"); // Log-Verzeichnis im System-Temp-Ordner
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "electron_main.log");
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        // Fenster global zuweisen
        width: 1440,
        height: 800,
        icon: path.join(__dirname, "public", "icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // preload: path.join(__dirname, 'preload.js') // Füge dies hinzu, wenn du einen Preload-Skript hast
        },
    });

    writeLog("createWindow called.");

    // === START PYTHON BACKEND ===
    function startPythonBackend() {
        let pythonExecutablePath;

        if (isDev) {
            pythonExecutablePath = path.join(
                __dirname,
                "..",
                "dist",
                "OptiFlowFileManager",
                "OptiFlowFileManager.exe"
            );
            writeLog(`Dev path to Python executable: ${pythonExecutablePath}`);
        } else {
            // Im Produktionsmodus: Finde den Root-Pfad der Anwendung
            const appRoot = path.dirname(app.getPath("exe"));

            // Der 'backend'-Ordner liegt direkt in diesem Root, als Geschwister-Ordner
            pythonExecutablePath = path.join(
                appRoot,
                "backend",
                "OptiFlowFileManager.exe"
            );

            writeLog(`Prod path to Python executable: ${pythonExecutablePath}`);
        }

        if (!fs.existsSync(pythonExecutablePath)) {
            writeLog(
                `ERROR: Python executable not found at: ${pythonExecutablePath}`
            );
            // Hier könntest du eine Fehlermeldung direkt im Fenster anzeigen, z.B. eine HTML-Seite laden
            // mainWindow.loadFile(path.join(__dirname, 'error_backend_not_found.html')); // Temporäre Fehlerseite
            return;
        }

        writeLog(`Attempting to spawn Python backend: ${pythonExecutablePath}`);

        pythonProcess = spawn(pythonExecutablePath, [], {
            stdio: "inherit",
        });

        pythonProcess.on("error", (err) => {
            writeLog(
                `ERROR: Failed to start Python backend process: ${err.message}`
            );
            // mainWindow.webContents.send('backend-error', `Failed to start backend: ${err.message}`);
        });

        pythonProcess.on("close", (code) => {
            writeLog(`Python backend exited with code ${code}`);
            // mainWindow.webContents.send('backend-closed', `Backend exited with code: ${code}`);
        });

        writeLog("Python backend spawn command sent.");
    }

    startPythonBackend(); // Starte das Python-Backend beim Initialisieren des Fensters

    // === LADE FRONTEND ===
    if (isDev) {
        writeLog(
            "Loading frontend in development mode from http://localhost:5173"
        );
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools(); // Öffne DevTools im Entwicklungsmodus
    } else {
        mainWindow.webContents.openDevTools(); // Öffne DevTools im Entwicklungsmodus
        // Pfad zum gebauten React-Frontend im Produktionsmodus
        // 'dist' ist der Ordner, der von 'vite build' im 'frontend'-Verzeichnis erstellt wird.
        const frontendPath = path.join(__dirname, "dist", "index.html");
        writeLog(
            `Loading frontend in production mode from file: ${frontendPath}`
        );

        // Überprüfe, ob die index.html existiert
        if (!fs.existsSync(frontendPath)) {
            writeLog(
                `ERROR: Frontend index.html not found at: ${frontendPath}`
            );
            mainWindow.loadFile(path.join(__dirname, "error.html")); // Lade eine Fehlerseite
            return;
        }

        mainWindow.loadFile(frontendPath);
    }
}

// Diese Methode wird aufgerufen, wenn Electron mit der Initialisierung fertig ist
// und bereit ist, Browser-Fenster zu erstellen.
app.whenReady().then(() => {
    createWindow();

    app.on("activate", function () {
        // macOS: Erstelle ein neues Fenster, wenn auf das Dock-Icon geklickt wird und keine anderen Fenster offen sind.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Beende die Anwendung, wenn alle Fenster geschlossen sind (außer auf macOS).
app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
    // Beende den Python-Prozess sauber, wenn die Electron-App geschlossen wird
    if (pythonProcess) {
        console.log("Terminating Python backend...");
        pythonProcess.kill(); // Sendet SIGTERM
        // Für Windows: pythonProcess.kill('SIGKILL'); falls SIGTERM nicht reicht
    }
});
