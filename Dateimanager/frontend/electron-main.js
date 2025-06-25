import { app, BrowserWindow, ipcMain, shell, protocol, net } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import os from "os";
import fs from "fs";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// KORREKTUR 1: Dem Chromium-Kern FRÜHZEITIG mitteilen, dass unser Protokoll vertrauenswürdig ist.
// Dies MUSS vor dem app.whenReady() Event geschehen.
protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            corsEnabled: true, // Wichtig für fetch-Anfragen aus dem Renderer
        },
    },
]);

let pythonProcess;
let mainWindow;
let docServer = null;
const DOC_PORT = 8081;

/**
 * Schreibt eine Log-Nachricht in eine temporäre Datei.
 * @param {string} message Die zu loggende Nachricht.
 */
function writeLog(message) {
    const logDir = path.join(os.tmpdir(), "OptiFlowLogs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "electron_main.log");
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

// --- HANDLER ZUM ÖFFNEN DER DOKUMENTATION (bleibt unverändert) ---
ipcMain.handle("open-documentation", async () => {
    if (docServer && docServer.listening) {
        const serverAddress = `http://localhost:${DOC_PORT}`;
        writeLog(
            `Dokumentations-Server läuft bereits. Öffne Browser bei ${serverAddress}`
        );
        await shell.openExternal(serverAddress);
        return;
    }

    const docDir = isDev
        ? path.resolve(__dirname, "..", "doc", "documentation", "template")
        : path.resolve(process.resourcesPath, "doc");

    writeLog(`Pfad zum Dokumentations-Verzeichnis: ${docDir}`);

    if (!fs.existsSync(docDir)) {
        writeLog(
            `FEHLER: Dokumentations-Verzeichnis nicht gefunden unter: ${docDir}`
        );
        if (mainWindow) {
            mainWindow.webContents.send(
                "error-dialog",
                "Dokumentation nicht gefunden",
                `Das Verzeichnis wurde nicht gefunden: ${docDir}`
            );
        }
        return;
    }

    docServer = http.createServer((req, res) => {
        let requestUrl = req.url === "/" ? "index.html" : req.url;
        requestUrl = requestUrl.split("?")[0];

        try {
            requestUrl = decodeURIComponent(requestUrl);
        } catch (e) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Bad Request: Malformed URI");
            return;
        }

        let filePath = path.join(docDir, requestUrl);

        if (!filePath.startsWith(docDir)) {
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end("Forbidden");
            return;
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
        };
        const contentType = mimeTypes[extname] || "application/octet-stream";

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === "ENOENT") {
                    res.writeHead(404, {
                        "Content-Type": "text/html; charset=utf-8",
                    });
                    res.end(
                        `<h1>404 Not Found</h1><p>Die Ressource <code>${requestUrl}</code> wurde nicht gefunden.</p><a href="/">Zurück</a>`
                    );
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${error.code}`);
                }
            } else {
                res.writeHead(200, { "Content-Type": contentType });
                res.end(content, "utf-8");
            }
        });
    });

    docServer
        .listen(DOC_PORT, "127.0.0.1", () => {
            const serverAddress = `http://localhost:${DOC_PORT}`;
            writeLog(
                `Dokumentations-Server erfolgreich gestartet unter ${serverAddress}`
            );
            shell.openExternal(serverAddress);
        })
        .on("error", (err) => {
            writeLog(`FEHLER beim Starten des Doku-Servers: ${err.message}`);
            if (mainWindow) {
                mainWindow.webContents.send(
                    "error-dialog",
                    "Doku-Server Fehler",
                    `Der Server konnte nicht gestartet werden: ${err.message}`
                );
            }
        });
});

/**
 * Erstellt das Hauptfenster der Anwendung.
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 800,
        icon: path.join(__dirname, "public", "icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    writeLog("createWindow called.");

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
            `Lade Frontend im Produktionsmodus von: app://dist/index.html`
        );

        if (!fs.existsSync(frontendPath)) {
            writeLog(
                `FEHLER: Frontend index.html nicht gefunden unter: ${frontendPath}`
            );
            mainWindow.loadURL("app://error.html");
            return;
        }

        mainWindow.loadURL("app://dist/index.html");
    }
}

/**
 * Startet den Python-Backend-Prozess.
 */
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
    } else {
        const appRoot = path.dirname(app.getPath("exe"));
        pythonExecutablePath = path.join(
            appRoot,
            "backend",
            "OptiFlowFileManager.exe"
        );
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
    pythonProcess.on("error", (err) =>
        writeLog(
            `ERROR: Failed to start Python backend process: ${err.message}`
        )
    );
    pythonProcess.on("close", (code) =>
        writeLog(`Python backend exited with code ${code}`)
    );
}

// Electron App Lifecycle Events

app.whenReady().then(() => {
    // KORREKTUR 2: Die moderne 'protocol.handle' Methode verwenden.
    protocol.handle("app", (request) => {
        const url = request.url.slice("app://".length).split("?")[0];
        const filePath = path.join(__dirname, url);

        // Verwende net.fetch, um die lokale Datei wie eine Web-Ressource zu behandeln.
        return net.fetch(pathToFileURL(filePath).toString()).catch((error) => {
            console.error(
                `[protocol.handle] Failed to fetch ${filePath}:`,
                error
            );
            // Gibt eine saubere 404-Antwort zurück, wenn die Datei nicht gefunden wird.
            return new Response(`File Not Found: ${url}`, { status: 404 });
        });
    });

    createWindow();

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("will-quit", () => {
    if (pythonProcess) {
        console.log("Terminating Python backend...");
        pythonProcess.kill();
    }
    if (docServer) {
        console.log("Closing documentation server...");
        docServer.close();
    }
});
