import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const ALL_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"];

export default function ScannerSettings({
    scannerCpuCores,
    setScannerCpuCores,
    usableExtensions,
    setUsableExtensions,
    scanDelay,
    setScanDelay
}) {
    const [localUsableExtensions, setLocalUsableExtensions] = useState(usableExtensions);

    // Initialize localUsableExtensions when usableExtensions prop changes
    useEffect(() => {
        setLocalUsableExtensions(usableExtensions);
    }, [usableExtensions]);

    const handleExtensionChange = (event) => {
        const { value, checked } = event.target;
        const updatedExtensions = checked
            ? [...localUsableExtensions, value]
            : localUsableExtensions.filter(ext => ext !== value);
        setLocalUsableExtensions(updatedExtensions);
        setUsableExtensions(updatedExtensions);
    };

    const handleProcessingDelayChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setScanDelay(isNaN(value) || value < 0 ? 0 : value);
    };

    return (
        <div className="settings-section">
            <h3>Scannereinstellungen</h3>

            <div className="form-group">
                <label htmlFor="numCores" className="settings-input-group">
                    Maximale Anzahl an Arbeitern:
                    <input
                        type="number"
                        value={scannerCpuCores}
                        onChange={(e) => setScannerCpuCores(parseInt(e.target.value, 10) || null)}
                        min="0"
                    />
                    <p className="setting-description">Anzahl der CPU-Kerne, die für den Scan verwendet werden sollen. Wird ebenfalls für die Entduplizierung genutzt. 0 Bedeutet automatisch bestimmt.</p>
                </label>
            </div>

            <div className="form-group">
                <label>
                    Wählbare Erweiterungen (Standard):
                    <div className="checkbox-group">
                        {ALL_EXTENSIONS.map(ext => (
                            <label key={ext} style={{ display: 'block' }}>
                                <input
                                    type="checkbox"
                                    value={ext}
                                    checked={localUsableExtensions.includes(ext)}
                                    onChange={handleExtensionChange}
                                />
                                {ext}
                            </label>
                        ))}
                    </div>
                    <p className="setting-description">Auswählbare Dateierweiterungen für den Scan.</p>
                </label>
            </div>

            <div className="form-group">
                <label htmlFor="processingDelay" className="settings-input-group">
                    Verzögerung zwischen Dateioperationen (ms):
                    <input
                        type="number"
                        id="processingDelay"
                        value={scanDelay ?? 0}
                        onChange={handleProcessingDelayChange}
                        min="0"
                    />
                    <p className="setting-description">Eine optionale Verzögerung in Millisekunden zwischen dem Verarbeiten einzelner Dateien.</p>
                </label>
            </div>
        </div>
    );
}
