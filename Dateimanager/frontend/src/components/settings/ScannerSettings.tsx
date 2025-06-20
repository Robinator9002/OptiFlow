import React, { useState } from "react";

// --- Type Definitions ---
interface ScannerSettingsProps {
    scannerCpuCores: number | null;
    setScannerCpuCores: React.Dispatch<React.SetStateAction<number | null>>;
    usableExtensions: string[];
    setUsableExtensions: React.Dispatch<React.SetStateAction<string[]>>;
    scanDelay: number;
    setScanDelay: React.Dispatch<React.SetStateAction<number>>;
    ignoredDirs: string[];
    setIgnoredDirs: React.Dispatch<React.SetStateAction<string[]>>;
}

// --- Konstanten ---
// Eine Liste aller potenziell scannbaren Dateiendungen.
const ALL_EXTENSIONS = [
    ".txt", ".md", ".csv", ".json", ".xml", ".html",
    ".css", ".js", ".py", ".pdf", ".docx",
];

// --- Component ---
export default function ScannerSettings({
    scannerCpuCores,
    setScannerCpuCores,
    usableExtensions,
    setUsableExtensions,
    scanDelay,
    setScanDelay,
    ignoredDirs,
    setIgnoredDirs,
}: ScannerSettingsProps) {
    const [newIgnoredDir, setNewIgnoredDir] = useState("");

    // Handler für die Änderung der CPU-Kern-Anzahl
    const handleCpuCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setScannerCpuCores(isNaN(value) ? null : value);
    };

    // Handler für Änderungen bei den Dateiendungen
    const handleExtensionChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { value, checked } = event.target;
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
        setScanDelay(isNaN(value) || value < 0 ? 0 : value);
    };

    // Handler zum Hinzufügen eines ignorierten Verzeichnisses
    const handleAddIgnoredDir = () => {
        const trimmedDir = newIgnoredDir.trim();
        if (trimmedDir && !ignoredDirs.includes(trimmedDir)) {
            setIgnoredDirs([...ignoredDirs, trimmedDir]);
            setNewIgnoredDir(""); // Eingabefeld zurücksetzen
        }
    };

    // Handler zum Entfernen eines ignorierten Verzeichnisses
    const handleRemoveIgnoredDir = (dirToRemove: string) => {
        setIgnoredDirs(ignoredDirs.filter((dir) => dir !== dirToRemove));
    };
    
    // Handler für die Enter-Taste im Input-Feld
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            handleAddIgnoredDir();
        }
    };


    return (
        <>
            {/* Component-specific styles for the new tag-like editor */}
            <style>
                {`
                .ignored-dirs-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    background: var(--bg-primary);
                    border-radius: 0.375rem;
                    border: 1px solid var(--border-tertiary);
                    margin-bottom: 0.75rem;
                    min-height: 50px;
                }

                .ignored-dir-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background-color: var(--bg-tertiary);
                    color: var(--text-secondary);
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    border: 1px solid var(--border-primary);
                    transition: all var(--transition-short);
                }

                .remove-tag-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    font-size: 1.25rem;
                    line-height: 1;
                    padding: 0;
                    font-weight: bold;
                    transition: color var(--transition-short);
                }

                .remove-tag-btn:hover {
                    color: var(--text-danger);
                    background: none;
                    transform: none;
                    box-shadow: none;
                }

                .add-dir-input-group {
                    display: flex;
                    gap: 0.5rem;
                }

                .add-dir-input-group input {
                    flex-grow: 1;
                }

                .add-dir-input-group button {
                    flex-shrink: 0;
                    padding: 0.625rem 1rem; /* Adjust padding to match input height */
                }
                `}
            </style>

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
                            Anzahl der CPU-Kerne für den Scan. 0 oder leer für automatische Bestimmung.
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
                            Optionale Verzögerung, um die Systemlast auf langsameren Festplatten zu reduzieren.
                        </p>
                    </div>
                </div>

                <div className="setting-group">
                    <h3>Ignorierte Verzeichnisse</h3>
                     <p className="setting-description" style={{ marginTop: 0 }}>
                        Liste von Ordnernamen, die beim Scannen komplett ignoriert werden sollen (z.B. node_modules, .git).
                    </p>
                    <div className="ignored-dirs-container">
                        {ignoredDirs.map((dir, index) => (
                            <div key={index} className="ignored-dir-tag">
                                <span>{dir}</span>
                                <button onClick={() => handleRemoveIgnoredDir(dir)} className="remove-tag-btn" title={`Remove ${dir}`}>&times;</button>
                            </div>
                        ))}
                    </div>
                    <div className="add-dir-input-group">
                        <input
                            type="text"
                            value={newIgnoredDir}
                            onChange={(e) => setNewIgnoredDir(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ordnernamen hinzufügen..."
                        />
                        <button onClick={handleAddIgnoredDir}>Hinzufügen</button>
                    </div>
                </div>

                <div className="setting-group">
                    <h3>Dateitypen</h3>
                    <p className="setting-description" style={{ marginTop: 0 }}>
                        Wählen Sie die Dateiendungen aus, die der Scanner standardmäßig berücksichtigen soll.
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
        </>
    );
}
