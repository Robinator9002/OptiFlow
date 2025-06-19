import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from 'url';
import isDev from "electron-is-dev";
import { spawn } from 'child_process';
import os from 'os'; // Importiere 'os' um TEMP-Verzeichnis zu finden

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess;
let mainWindow; // Fenster global halten für Debugging

// Funktion zum Schreiben von Logs in eine Datei
function writeLog(message) {
    const logDir = path.join(os.tmpdir(), 'OptiFlowLogs'); // Log-Verzeichnis im System-Temp-Ordner
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'electron_main.log');
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

function createWindow() {
    mainWindow = new BrowserWindow({ // Fenster global zuweisen
        width: 1440,
        height: 800,
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // preload: path.join(__dirname, 'preload.js') // Füge dies hinzu, wenn du einen Preload-Skript hast
        },
    });

    writeLog('createWindow called.');

    // === START PYTHON BACKEND ===
    function startPythonBackend() {
        let pythonExecutablePath;

        if (isDev) {
            // Im Entwicklungsmodus: Vom Frontend-Ordner (C:\OptiFlow\Dateimanager\frontend)
            // zum PyInstaller-Output (C:\OptiFlow\Dateimanager\dist\OptiFlowFileManager)
            pythonExecutablePath = path.join(__dirname, '..', 'dist', 'OptiFlowFileManager', 'OptiFlowFileManager.exe');
            writeLog(`Dev path to Python executable: ${pythonExecutablePath}`);
        } else {
            // Im Produktionsmodus (nach Electron-Build):
            // Electron-Builder packt extraFiles in 'resources/app.asar.unpacked/ZIELPFAD'
            // In package.json haben wir "to": "backend" gesetzt.
            pythonExecutablePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'OptiFlowFileManager.exe');
            writeLog(`Prod path to Python executable: ${pythonExecutablePath}`);
        }

        // Überprüfe, ob die Python-Executable existiert
        if (!fs.existsSync(pythonExecutablePath)) {
            writeLog(`ERROR: Python executable not found at: ${pythonExecutablePath}`);
            // Optional: Zeige eine Fehlermeldung im Electron-Fenster
            // mainWindow.webContents.send('backend-error', `Backend executable not found at: ${pythonExecutablePath}`);
            return; // Backend kann nicht gestartet werden
        }

        writeLog(`Attempting to spawn Python backend: ${pythonExecutablePath}`);

        // Setze den Port für FastAPI. Stelle sicher, dass dies auch im Python-Code übereinstimmt (z.B. Uvicorn-Parameter)
        const FASTAPI_PORT = 8000; 

        // Starte den Python-Prozess
        pythonProcess = spawn(pythonExecutablePath, [], {
            stdio: 'inherit', // Standardausgabe und -fehler der Python-App in der Electron-Konsole anzeigen (nur im Dev-Modus hilfreich)
            // Wenn du im Produktionsmodus keine Konsole hast, leite die Ausgaben um:
            // stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr pipes
            // env: { ...process.env, OPTIFLOW_SECRET_KEY: 'DeinSichererProdKey123' } // Für Produktion wichtig!
        });

        // Wenn du stdio: ['pipe', 'pipe', 'pipe'] verwendest, kannst du Ausgaben so loggen:
        // pythonProcess.stdout.on('data', (data) => {
        //     writeLog(`Python stdout: ${data}`);
        // });
        // pythonProcess.stderr.on('data', (data) => {
        //     writeLog(`Python stderr: ${data}`);
        // });


        pythonProcess.on('error', (err) => {
            writeLog(`ERROR: Failed to start Python backend process: ${err.message}`);
            // Hier könntest du eine sichtbare Fehlermeldung im Frontend anzeigen
            // mainWindow.webContents.send('backend-error', `Failed to start backend: ${err.message}`);
        });

        pythonProcess.on('close', (code) => {
            writeLog(`Python backend exited with code ${code}`);
            // Hier könntest du reagieren, wenn das Backend abstürzt
            // mainWindow.webContents.send('backend-closed', `Backend exited with code: ${code}`);
        });

        writeLog('Python backend spawn command sent.');

        // Optional: Kurze Wartezeit für das Backend, bevor das Frontend geladen wird
        // In einer echten App ist ein Health-Check-Endpoint im Backend besser
        // setTimeout(() => {
        //     writeLog('Python backend (hopefully) initialized after delay.');
        // }, 5000); // 5 Sekunden warten
    }

    startPythonBackend(); // Starte das Python-Backend beim Initialisieren des Fensters

    // === LADE FRONTEND ===
    if (isDev) {
        writeLog('Loading frontend in development mode from http://localhost:5173');
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools(); // Öffne DevTools im Entwicklungsmodus
    } else {
        mainWindow.webContents.openDevTools(); // Öffne DevTools im Entwicklungsmodus
        // Pfad zum gebauten React-Frontend im Produktionsmodus
        // 'dist' ist der Ordner, der von 'vite build' im 'frontend'-Verzeichnis erstellt wird.
        const frontendPath = path.join(__dirname, "dist", "index.html");
        writeLog(`Loading frontend in production mode from file: ${frontendPath}`);
        
        // Überprüfe, ob die index.html existiert
        if (!fs.existsSync(frontendPath)) {
            writeLog(`ERROR: Frontend index.html not found at: ${frontendPath}`);
            mainWindow.loadFile(path.join(__dirname, 'error.html')); // Lade eine Fehlerseite
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
        console.log('Terminating Python backend...');
        pythonProcess.kill(); // Sendet SIGTERM
        // Für Windows: pythonProcess.kill('SIGKILL'); falls SIGTERM nicht reicht
    }
});