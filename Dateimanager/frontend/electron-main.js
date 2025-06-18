import { app, BrowserWindow, Menu } from "electron"; // 'Menu' hinzugefügt
import path from "path";
import { fileURLToPath } from 'url';
// import isDev from "electron-is-dev"; // <--- isDev ist für den Build nicht mehr nötig

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    // Erstelle das Browser-Fenster.
    const mainWindow = new BrowserWindow({
        width: 1440, // Etwas größer für eine typische App
        height: 800,
        minWidth: 800, // Optional: Mindestbreite, damit die App nicht zu klein wird
        minHeight: 600, // Optional: Mindesthöhe
        icon: path.join(__dirname, 'public', 'icon.png'), // Stelle sicher, dass dieser Pfad korrekt ist
        webPreferences: {
            nodeIntegration: false, // Wichtig für Sicherheit! Bleibt auf false.
            contextIsolation: true, // Wichtig für Sicherheit! Bleibt auf true.
            preload: path.join(__dirname, 'preload.js') // Es ist eine gute Praxis, immer ein Preload-Skript zu haben
        },
    });

    // Im Build-Modus laden wir immer die 'index.html' aus dem 'dist'-Ordner.
    // Der isDev-Check ist hier nicht mehr nötig.
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

    // --- Produktions-spezifische Anpassungen ---

    // Deaktiviere das Menü im Produktions-Build für eine schlankere App-Erfahrung.
    // Im Entwicklungsmodus ist das Menü nützlich für DevTools, im Prod-Modus eher störend.
    Menu.setApplicationMenu(null); 
    
    // Optional: Öffne DevTools NICHT im Produktionsmodus. 
    // Wenn du sie im Prod-Build dennoch brauchst (z.B. für Debugging-Releases),
    // kannst du diese Zeile wieder einkommentieren oder eine Bedingung dafür einbauen.
    // mainWindow.webContents.openDevTools(); 
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
});

// Optional: Hier könnten weitere IPC-Handler oder globale Event-Listener hinzugefügt werden,
// die für die App-Logik wichtig sind und unabhängig vom Fenster existieren.
// Beispiel: IPC-Handler für Kommunikation zwischen Renderer und Main-Prozess
// import { ipcMain } from 'electron';
// ipcMain.on('some-event-from-renderer', (event, arg) => {
//    console.log(arg); // z.B. 'ping'
//    event.reply('some-reply-to-renderer', 'pong');
// });