import React from "react";

// --- Type Definitions ---
interface OldFilesSettingsProps {
  oldFilesLimit: number;
  setOldFilesLimit: React.Dispatch<React.SetStateAction<number>>;
  maxAgeDays: number;
  setMaxAgeDays: React.Dispatch<React.SetStateAction<number>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: string;
  setSortOrder: React.Dispatch<React.SetStateAction<string>>;
}

// --- Component ---
export default function OldFilesSettings({
  oldFilesLimit,
  setOldFilesLimit,
  maxAgeDays,
  setMaxAgeDays,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}: OldFilesSettingsProps) {
  const handleNumberChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setter(value);
    } else if (event.target.value === "") {
      setter(0);
    }
  };

  const handleSelectChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setter(event.target.value);
  };

  return (
    <div className="settings-section">
      <h3>Vergessene Dateien Einstellungen</h3>
      <p className="setting-description">
        Konfigurieren Sie die Suche nach alten und vergessenen Dateien im Index.
      </p>

      <div className="setting-item">
        <label htmlFor="maxAgeDays" className="search-relevance-input">
          Mindestalter in Tagen:
          <input
            type="number"
            id="maxAgeDays"
            name="maxAgeDays"
            value={maxAgeDays > 0 ? maxAgeDays : ""}
            onChange={(e) => handleNumberChange(setMaxAgeDays, e)}
            min="0"
            placeholder="0 für kein Alterslimit"
          />
        </label>
        <p className="setting-description">
          Findet Dateien, die älter als die angegebene Anzahl Tage sind. Setzen
          Sie 0, um kein Alterslimit zu setzen.
        </p>
      </div>

      <div className="setting-item">
        <label htmlFor="oldFilesLimit" className="search-relevance-input">
          Maximale Anzahl Ergebnisse:
          <input
            type="number"
            id="oldFilesLimit"
            name="oldFilesLimit"
            value={oldFilesLimit > 0 ? oldFilesLimit : ""}
            onChange={(e) => handleNumberChange(setOldFilesLimit, e)}
            min="0"
            placeholder="0 für alle"
          />
        </label>
        <p className="setting-description">
          Begrenzt die Anzahl der angezeigten alten Dateien. Setzen Sie 0, um
          alle gefundenen Dateien anzuzeigen.
        </p>
      </div>

      <div className="setting-item">
        <label htmlFor="sortBy" className="search-relevance-input">
          Sortieren nach:
          <select
            id="sortBy"
            name="sortBy"
            value={sortBy}
            onChange={(e) => handleSelectChange(setSortBy, e)}
            style={{ marginLeft: "10px", padding: "5px" }}
          >
            <option value="age">Alter</option>
            <option value="size">Größe</option>
          </select>
        </label>
        <p className="setting-description">
          Wählen Sie das Kriterium, nach dem die gefundenen Dateien sortiert
          werden sollen.
        </p>
      </div>

      <div className="setting-item">
        <label htmlFor="sortOrder" className="search-relevance-input">
          Sortierreihenfolge:
          <select
            id="sortOrder"
            name="sortOrder"
            value={sortOrder}
            onChange={(e) => handleSelectChange(setSortOrder, e)}
            style={{ marginLeft: "10px", padding: "5px" }}
          >
            <option value="normal">Normal (Älteste/Größte zuerst)</option>
            <option value="inverted">
              Invertiert (Neueste/Kleinste zuerst)
            </option>
          </select>
        </label>
        <p className="setting-description">
          Wählen Sie die Reihenfolge der Sortierung. 'Normal' ist absteigend für
          Alter/Größe, 'Invertiert' ist aufsteigend.
        </p>
      </div>
    </div>
  );
}
