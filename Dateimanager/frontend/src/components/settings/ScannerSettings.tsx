import React from "react";

// --- Type Definitions ---
interface ScannerSettingsProps {
    scannerCpuCores: number | null;
    setScannerCpuCores: React.Dispatch<React.SetStateAction<number | null>>;
    usableExtensions: string[];
    setUsableExtensions: React.Dispatch<React.SetStateAction<string[]>>;
    scanDelay: number;
    setScanDelay: React.Dispatch<React.SetStateAction<number>>;
}

// --- Konstanten ---
// Eine Liste aller potenziell scannbaren Dateiendungen.
const ALL_EXTENSIONS = [
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".css",
    ".js",
    ".py",
    ".pdf",
    ".docx",
];

// --- Component ---
export default function ScannerSettings({
    scannerCpuCores,
    setScannerCpuCores,
    usableExtensions,
    setUsableExtensions,
    scanDelay,
    setScanDelay,
}: ScannerSettingsProps) {
    // Handler für die Änderung der CPU-Kern-Anzahl
    const handleCpuCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        // Bei leerer Eingabe oder ungültiger Zahl wird `null` gesetzt (automatische Bestimmung)
        setScannerCpuCores(isNaN(value) ? null : value);
    };

    // Handler für Änderungen bei den Dateiendungen
    const handleExtensionChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { value, checked } = event.target;
        // Fügt die Endung hinzu oder entfernt sie aus dem Array
        const updatedExtensions = checked
            ? [...usableExtensions, value]
            : usableExtensions.filter((ext) => ext !== value);
        setUsableExtensions(updatedExtensions);
    };

    // Handler für die Verarbeitungsverzögerung
    const handleScanDelayChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = parseInt(event.target.value, 10);
        // Nur positive Werte oder 0 sind erlaubt
        setScanDelay(isNaN(value) || value < 0 ? 0 : value);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>Scanner</h2>
            </div>

            <div className="setting-group">
                <h3>Leistung</h3>
                <div className="setting-item">
                    <label htmlFor="scannerCpuCores">
                        Maximale Anzahl an CPU-Kernen
                        <input
                            type="number"
                            id="scannerCpuCores"
                            value={scannerCpuCores ?? ""}
                            onChange={handleCpuCoreChange}
                            min="0"
                            placeholder="Auto"
                        />
                    </label>
                    <p className="setting-description">
                        Anzahl der CPU-Kerne für den Scan und die
                        Entduplizierung. 0 oder leer für automatische
                        Bestimmung.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="scanDelay">
                        Verzögerung zwischen Dateien (ms)
                        <input
                            type="number"
                            id="scanDelay"
                            value={scanDelay}
                            onChange={handleScanDelayChange}
                            min="0"
                        />
                    </label>
                    <p className="setting-description">
                        Optionale Verzögerung, um die Systemlast auf langsameren
                        Festplatten zu reduzieren.
                    </p>
                </div>
            </div>

            <div className="setting-group">
                <h3>Dateitypen</h3>
                <p className="setting-description" style={{ marginTop: 0 }}>
                    Wählen Sie die Dateiendungen aus, die der Scanner
                    standardmäßig berücksichtigen soll.
                </p>
                <div className="extensions-grid">
                    {ALL_EXTENSIONS.map((ext) => (
                        <label key={ext} className="checkbox-label">
                            <input
                                type="checkbox"
                                value={ext}
                                checked={usableExtensions.includes(ext)}
                                onChange={handleExtensionChange}
                            />
                            {ext}
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
