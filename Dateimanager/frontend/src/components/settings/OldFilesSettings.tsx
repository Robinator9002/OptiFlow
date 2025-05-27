import React from 'react';

export default function OldFilesSettings({
    oldFilesLimit,
    setOldFilesLimit,
    maxAgeDays,
    setMaxAgeDays,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder
}) {

    // Handler für Änderungen am Input-Feld für oldFilesLimit
    const handleOldFilesLimitChange = (event) => {
        const value = parseInt(event.target.value, 10);
        // Stelle sicher, dass der Wert eine nicht-negative Zahl ist
        if (!isNaN(value) && value >= 0) {
            setOldFilesLimit(value);
        } else if (event.target.value === '') {
            // Erlaube leeres Feld, interpretiere es als 0 oder null, je nachdem, wie du es im State handhabst
            // Wir setzen hier auf 0, was "kein Limit" im Sinne der Anzeige bedeuten könnte,
            // aber im Backend wird 0 oft als "unbegrenzt" interpretiert. Stelle sicher,
            // dass die Logik konsistent ist.
            setOldFilesLimit(0); // Oder null, je nach Backend/Frontend Logik
        }
    };

    // Handler für Änderungen am Input-Feld für maxAgeDays
    const handleMaxAgeDaysChange = (event) => {
        const value = parseInt(event.target.value, 10);
        // Stelle sicher, dass der Wert eine nicht-negative Zahl ist
        if (!isNaN(value) && value >= 0) {
            setMaxAgeDays(value);
        } else if (event.target.value === '') {
            // Erlaube leeres Feld, interpretiere es als 0 oder null
            setMaxAgeDays(0); // Oder null
        }
    };

    // Handler für Änderungen an der Sortierkriterium-Auswahl
    const handleSortByChange = (event) => {
        setSortBy(event.target.value);
    };

    // Handler für Änderungen an der Sortierreihenfolge-Auswahl
    const handleSortOrderChange = (event) => {
        setSortOrder(event.target.value);
    };


    return (
        <div className="settings-section"> {/* Nutze eine bestehende Sektion-Klasse */}
            <h3>Vergessene Dateien Einstellungen</h3>
            <p className="setting-description">
                Konfigurieren Sie die Suche nach alten und vergessenen Dateien im Index.
            </p>

            {/* Einstellung: Maximales Alter in Tagen */}
            <div className="setting-item">
                <label htmlFor="maxAgeDays" className="search-relevance-input">
                    Mindestalter in Tagen:
                    <input
                        type="number"
                        id="maxAgeDays"
                        name="maxAgeDays"
                        value={maxAgeDays > 0 ? maxAgeDays : ''} // Zeige 0 als leer oder '0'
                        onChange={handleMaxAgeDaysChange}
                        min="0" // Mindestens 0
                        placeholder="0 für kein Alterslimit"
                    />
                </label>
                <p className="setting-description">
                    Findet Dateien, die älter als die angegebene Anzahl Tage sind. Setzen Sie 0, um kein Alterslimit zu setzen (findet alle Dateien, sortiert dann).
                </p>
            </div>

            {/* Einstellung: Maximale Anzahl Dateien */}
            <div className="setting-item"> {/* Nutze eine bestehende Item-Klasse */}
                <label htmlFor="oldFilesLimit" className="search-relevance-input">
                    Maximale Anzahl Ergebnisse:
                    <input
                        type="number"
                        id="oldFilesLimit"
                        name="oldFilesLimit"
                        value={oldFilesLimit > 0 ? oldFilesLimit : ''} // Zeige 0 als leer oder '0'
                        onChange={handleOldFilesLimitChange}
                        min="0" // Mindestens 0
                        placeholder="0 für alle"
                    />
                </label>
                <p className="setting-description">
                    Begrenzt die Anzahl der angezeigten alten Dateien. Setzen Sie 0, um alle gefundenen Dateien anzuzeigen.
                </p>
            </div>


            {/* Einstellung: Sortierkriterium */}
            <div className="setting-item">
                <label htmlFor="sortBy" className="search-relevance-input">Sortieren nach:
                    <select
                        id="sortBy"
                        name="sortBy"
                        value={sortBy}
                        onChange={handleSortByChange}
                        style={{ marginLeft: '10px', padding: '5px' }} // Minimales Inline-Styling, falls nötig
                    >
                        <option value="age">Alter</option>
                        <option value="size">Größe</option>
                    </select>
                </label>
                <p className="setting-description">
                    Wählen Sie das Kriterium, nach dem die gefundenen Dateien sortiert werden sollen.
                </p>
            </div>

            {/* Einstellung: Sortierreihenfolge */}
            <div className="setting-item">
                <label htmlFor="sortOrder" className="search-relevance-input">Sortierreihenfolge:
                    <select
                        id="sortOrder"
                        name="sortOrder"
                        value={sortOrder}
                        onChange={handleSortOrderChange}
                        style={{ marginLeft: '10px', padding: '5px' }} // Minimales Inline-Styling, falls nötig
                    >
                        <option value="normal">Normal (Älteste/Größte zuerst)</option> {/* Passe die Beschreibung an das Sortierkriterium an */}
                        <option value="inverted">Invertiert (Neueste/Kleinste zuerst)</option>
                    </select>
                </label>
                <p className="setting-description">
                    Wählen Sie die Reihenfolge der Sortierung. 'Normal' ist absteigend für Alter/Größe, 'Invertiert' ist aufsteigend.
                </p>
            </div>
        </div>
    );
}
