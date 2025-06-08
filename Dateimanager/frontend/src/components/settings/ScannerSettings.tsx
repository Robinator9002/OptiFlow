import React, { useState, useEffect } from "react";

// --- Type Definitions ---
interface ScannerSettingsProps {
  scannerCpuCores: number | null;
  setScannerCpuCores: React.Dispatch<React.SetStateAction<number | null>>;
  usableExtensions: string[];
  setUsableExtensions: React.Dispatch<React.SetStateAction<string[]>>;
  scanDelay: number;
  setScanDelay: React.Dispatch<React.SetStateAction<number>>;
}

// --- Constants ---
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
  const [localUsableExtensions, setLocalUsableExtensions] =
    useState<string[]>(usableExtensions);

  useEffect(() => {
    setLocalUsableExtensions(usableExtensions);
  }, [usableExtensions]);

  const handleExtensionChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { value, checked } = event.target;
    const updatedExtensions = checked
      ? [...localUsableExtensions, value]
      : localUsableExtensions.filter((ext) => ext !== value);
    setLocalUsableExtensions(updatedExtensions);
    setUsableExtensions(updatedExtensions);
  };

  const handleProcessingDelayChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    setScanDelay(isNaN(value) || value < 0 ? 0 : value);
  };

  const handleCpuCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setScannerCpuCores(isNaN(value) ? null : value);
  };

  return (
    <div className="settings-section">
      <h3>Scannereinstellungen</h3>

      <div className="form-group">
        <label htmlFor="numCores" className="settings-input-group">
          Maximale Anzahl an Arbeitern:
          <input
            type="number"
            value={scannerCpuCores ?? ""}
            onChange={handleCpuCoreChange}
            min="0"
          />
          <p className="setting-description">
            Anzahl der CPU-Kerne, die für den Scan verwendet werden sollen. Wird
            ebenfalls für die Entduplizierung genutzt. 0 Bedeutet automatisch
            bestimmt.
          </p>
        </label>
      </div>

      <div className="form-group">
        <label>
          Wählbare Erweiterungen (Standard):
          <div className="checkbox-group">
            {ALL_EXTENSIONS.map((ext) => (
              <label key={ext} style={{ display: "block" }}>
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
          <p className="setting-description">
            Auswählbare Dateierweiterungen für den Scan.
          </p>
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
          <p className="setting-description">
            Eine optionale Verzögerung in Millisekunden zwischen dem Verarbeiten
            einzelner Dateien.
          </p>
        </label>
      </div>
    </div>
  );
}
