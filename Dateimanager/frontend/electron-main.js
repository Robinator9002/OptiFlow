import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import os from "os"; 
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pythonProcess;
let mainWindow;

function writeLog(message) {
    const logDir = path.join(os.tmpdir(), "OptiFlowLogs"); 
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "electron_main.log");
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

// Handler zum Öffnen der Dokumentation
ipcMain.handle('open-documentation', () => {
    const docPath = isDev
      ? path.resolve(__dirname, '..', 'doc', 'documentation', 'template', 'index.html')
      : path.resolve(process.resourcesPath, 'doc', 'index.html');
      
    writeLog(`Attempting to open documentation at: ${docPath}`);

    if (fs.existsSync(docPath)) {
        shell.openPath(docPath);
        writeLog(`Successfully opened documentation.`);
    } else {
        writeLog(`ERROR: Documentation file not found at: ${docPath}`);
    }
});


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 800,
        icon: path.join(__dirname, "public", "icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // WICHTIG: Preload-Skript aktivieren
            preload: path.join(__dirname, 'preload.js') 
        },
    });

    writeLog("createWindow called.");

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
            const appRoot = path.dirname(app.getPath("exe"));
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
            return;
        }

        writeLog(`Attempting to spawn Python backend: ${pythonExecutablePath}`);

        pythonProcess = spawn(pythonExecutablePath, [], {
            stdio: "inherit",
            cwd: path.dirname(pythonExecutablePath),
        });

        pythonProcess.on("error", (err) => {
            writeLog(
                `ERROR: Failed to start Python backend process: ${err.message}`
            );
        });

        pythonProcess.on("close", (code) => {
            writeLog(`Python backend exited with code ${code}`);
        });

        writeLog("Python backend spawn command sent.");
    }

    startPythonBackend();

    if (isDev) {
        writeLog(
            "Loading frontend in development mode from http://localhost:5173"
        );
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools(); 
    } else {
        const frontendPath = path.join(__dirname, "dist", "index.html");
        writeLog(
            `Loading frontend in production mode from file: ${frontendPath}`
        );

        if (!fs.existsSync(frontendPath)) {
            writeLog(
                `ERROR: Frontend index.html not found at: ${frontendPath}`
            );
            mainWindow.loadFile(path.join(__dirname, "error.html")); 
            return;
        }

        mainWindow.loadFile(frontendPath);
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
    if (pythonProcess) {
        console.log("Terminating Python backend...");
        pythonProcess.kill();
    }
});
