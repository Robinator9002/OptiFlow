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
    // Generischer Handler für numerische Inputs
    const handleNumberChange = (
        setter: React.Dispatch<React.SetStateAction<number>>,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = parseInt(event.target.value, 10);
        // Erlaube leere Eingabe (wird zu 0), ansonsten nur positive Zahlen
        if (event.target.value === "") {
            setter(0);
        } else if (!isNaN(value) && value >= 0) {
            setter(value);
        }
    };

    // Generischer Handler für Select-Inputs
    const handleSelectChange = (
        setter: React.Dispatch<React.SetStateAction<string>>,
        event: React.ChangeEvent<HTMLSelectElement>
    ) => {
        setter(event.target.value);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>Alte Dateien</h2>
            </div>
            <p
                className="setting-description"
                style={{ marginTop: "-1rem", marginBottom: "1.5rem" }}
            >
                Konfigurieren Sie die Suche nach alten und potenziell veralteten
                Dateien im Index.
            </p>

            <div className="setting-group">
                <h3>Filter & Limits</h3>
                <div className="setting-item">
                    <label htmlFor="maxAgeDays">
                        Mindestalter der Dateien (in Tagen)
                        <input
                            type="number"
                            id="maxAgeDays"
                            value={maxAgeDays > 0 ? maxAgeDays : ""}
                            onChange={(e) =>
                                handleNumberChange(setMaxAgeDays, e)
                            }
                            min="0"
                            placeholder="z.B. 365"
                        />
                    </label>
                    <p className="setting-description">
                        Findet nur Dateien, die älter als die angegebene Anzahl
                        von Tagen sind. 0, um kein Alterslimit zu setzen.
                    </p>
                </div>

                <div className="setting-item">
                    <label htmlFor="oldFilesLimit">
                        Maximale Anzahl an Ergebnissen
                        <input
                            type="number"
                            id="oldFilesLimit"
                            value={oldFilesLimit > 0 ? oldFilesLimit : ""}
                            onChange={(e) =>
                                handleNumberChange(setOldFilesLimit, e)
                            }
                            min="0"
                            placeholder="Alle anzeigen"
                        />
                    </label>
                    <p className="setting-description">
                        Begrenzt die Anzahl der angezeigten alten Dateien. 0, um
                        alle gefundenen Dateien anzuzeigen.
                    </p>
                </div>
            </div>

            <div className="setting-group">
                <h3>Sortierung</h3>
                <div className="setting-item">
                    <label htmlFor="sortBy">
                        Sortieren nach
                        <select
                            id="sortBy"
                            value={sortBy}
                            onChange={(e) => handleSelectChange(setSortBy, e)}
                        >
                            <option value="age">Alter</option>
                            <option value="size">Größe</option>
                        </select>
                    </label>
                    <p className="setting-description">
                        Wählen Sie das Kriterium, nach dem die gefundenen
                        Dateien sortiert werden sollen.
                    </p>
                </div>

                <div className="setting-item">
                    <label htmlFor="sortOrder">
                        Sortierreihenfolge
                        <select
                            id="sortOrder"
                            value={sortOrder}
                            onChange={(e) =>
                                handleSelectChange(setSortOrder, e)
                            }
                        >
                            <option value="normal">
                                Normal (Älteste/Größte zuerst)
                            </option>
                            <option value="inverted">
                                Invertiert (Neueste/Kleinste zuerst)
                            </option>
                        </select>
                    </label>
                    <p className="setting-description">
                        'Normal' sortiert absteigend nach Alter/Größe.
                    </p>
                </div>
            </div>
        </div>
    );
}
