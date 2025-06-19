import { app, BrowserWindow, ipcMain } from "electron"; // ipcMain hinzugefügt, falls du später Kommunikation brauchst
import path from "path";
import { fileURLToPath } from 'url';
import isDev from "electron-is-dev";
import { spawn } from 'child_process'; // Hinzugefügt, um Python-Prozess zu starten

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess; // Globale Variable, um den Python-Prozess zu halten, damit wir ihn beenden können

function createWindow() {
    // Erstelle das Browser-Fenster.
    const mainWindow = new BrowserWindow({
        width: 1440, // Etwas größer für eine typische App
        height: 800,
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: false, // Wichtig für Sicherheit! Standard ist false.
            contextIsolation: true, // Wichtig für Sicherheit! Standard ist true.
            // preload: path.join(__dirname, 'preload.js') // Optional, falls du später einen Preload-Skript brauchst
            // Wenn du IPC zwischen Renderer und Main-Prozess nutzen willst, ist preload.js der richtige Ort.
        },
    });

    // === START PYTHON BACKEND ===
    function startPythonBackend() {
        let pythonExecutablePath;

        if (isDev) {
            // Im Entwicklungsmodus: Pfad zum PyInstaller-Ausgabeordner (relative vom Frontend-Root zum Backend/dist)
            // Annahme: dein Python-Projekt liegt parallel zum Frontend-Projekt
            // Dateimanager/
            // ├── backend/
            // │   └── dist/OptiFlowFileManager/OptiFlowFileManager.exe
            // └── frontend/
            //     └── electron-main.js
            pythonExecutablePath = path.join(__dirname, '..', '..', 'backend', 'dist', 'OptiFlowFileManager', 'OptiFlowFileManager.exe');
        } else {
            // Im Produktionsmodus (nach Electron-Build):
            // Electron-Builder packt extraResources in 'resources/app.asar.unpacked/DEIN_ZIELPFAD'
            // Wir definieren unten in package.json, dass 'OptiFlowFileManager' nach 'backend' im Bundle kopiert wird.
            pythonExecutablePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'OptiFlowFileManager.exe');
        }

        console.log(`Attempting to start Python backend from: ${pythonExecutablePath}`);

        // TODO: Port für FastAPI festlegen oder dynamisch ermitteln (z.B. über ein Env-Variable oder Config-Datei)
        // Für den Anfang nehmen wir mal Port 8000 an.
        // Du könntest hier auch Argumente an das Python-Backend übergeben, z.B. den Port.
        pythonProcess = spawn(pythonExecutablePath, [], {
            stdio: 'inherit', // Zeigt die Python-Konsolenausgabe in der Electron-Entwicklerkonsole an
            // cwd: path.dirname(pythonExecutablePath), // Optional: Setzt das Arbeitsverzeichnis des Python-Prozesses
            // env: { ...process.env, OPTIFLOW_SECRET_KEY: 'DeinGeheimerProduktionsSchluessel' } // Wichtig für Prod!
        });

        pythonProcess.on('error', (err) => {
            console.error('Failed to start Python backend:', err);
            // Hier könntest du eine Fehlermeldung im Frontend anzeigen
            // z.B. über mainWindow.webContents.send() oder indem du ein Dialogfenster öffnest
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python backend exited with code ${code}`);
            // Hier könntest du reagieren, wenn das Backend abstürzt (z.B. App beenden oder neu starten)
        });

        // Optional: Warte eine kurze Zeit, damit das Backend hochfahren kann, bevor das Frontend eine Anfrage sendet.
        // In einer echten Anwendung würdest du besser ein Health-Check-Endpoint im Backend pingen.
        setTimeout(() => {
            console.log('Python backend started (hopefully)!');
        }, 5000); // 5 Sekunden warten
    }

    startPythonBackend(); // Starte das Python-Backend beim Initialisieren des Fensters

    // === LADE FRONTEND ===
    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.setMenu(null); // Menü für Dev-Tools, wenn nicht gewollt, hier auskommentieren
        // mainWindow.webContents.openDevTools(); // Zum Debuggen im Dev-Modus nützlich
    } else {
        mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
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