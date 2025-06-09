import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from 'url'; // Hinzufügen für __dirname
import isDev from "electron-is-dev";

const __filename = fileURLToPath(import.meta.url); // Aktueller Dateipfad
const __dirname = path.dirname(__filename);       // Verzeichnis der aktuellen Datei

function createWindow() {
	// Erstelle das Browser-Fenster.
	const mainWindow = new BrowserWindow({
		width: 1920, // Etwas größer für eine typische App
		height: 1080,
        icon: path.join(__dirname, 'public', 'icon.png'),
		webPreferences: {
			nodeIntegration: false, // Wichtig für Sicherheit! Standard ist false.
			contextIsolation: true, // Wichtig für Sicherheit! Standard ist true.
			// preload: path.join(__dirname, 'preload.js') // Optional, falls du später einen Preload-Skript brauchst
		},
	});

	if (isDev) {
		// Lade die URL des Vite Dev Servers. Standardmäßig http://localhost:5173
		// Stelle sicher, dass der Port mit deinem Vite-Setup übereinstimmt!
		mainWindow.loadURL("http://localhost:5173");
		// Öffne die DevTools automatisch im Entwicklungsmodus.
		mainWindow.setMenu(null);
	} else {
		// Lade die index.html aus dem Vite Build-Verzeichnis (normalerweise 'dist')
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
});
