import React from "react";

// --- Type Definitions ---
interface SearchSettingsProps {
    searchLimit: number;
    setSearchLimit: React.Dispatch<React.SetStateAction<number>>;
    showRelevance: boolean;
    setShowRelevance: React.Dispatch<React.SetStateAction<boolean>>;
    filenameExactMatchScore: number;
    setFilenameExactMatchScore: React.Dispatch<React.SetStateAction<number>>;
    filenamePartialMatchScore: number;
    setFilenamePartialMatchScore: React.Dispatch<React.SetStateAction<number>>;
    contentMatchScore: number;
    setContentMatchScore: React.Dispatch<React.SetStateAction<number>>;
    snippetLimit: number;
    setSnippetLimit: React.Dispatch<React.SetStateAction<number>>;
    snippetWindow: number;
    setSnippetWindow: React.Dispatch<React.SetStateAction<number>>;
    proximityWindow: number;
    setProximityWindow: React.Dispatch<React.SetStateAction<number>>;
}

// --- Component ---
export default function SearchSettings({
    searchLimit,
    setSearchLimit,
    showRelevance,
    setShowRelevance,
    filenameExactMatchScore,
    setFilenameExactMatchScore,
    filenamePartialMatchScore,
    setFilenamePartialMatchScore,
    contentMatchScore,
    setContentMatchScore,
    snippetLimit,
    setSnippetLimit,
    snippetWindow,
    setSnippetWindow,
    proximityWindow,
    setProximityWindow,
}: SearchSettingsProps) {
    // Generischer Handler für numerische Inputs
    const handleNumberChange = (
        setter: React.Dispatch<React.SetStateAction<number>>,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = parseInt(event.target.value, 10);
        setter(isNaN(value) ? 0 : value);
    };

    // Handler für die Checkbox zur Anzeige der Relevanz
    const handleShowRelevanceChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setShowRelevance(event.target.checked);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>Suche</h2>
            </div>

            {/* Allgemeine Sucheinstellungen */}
            <div className="setting-group">
                <h3>Ergebnisse & Anzeige</h3>
                <div className="setting-item">
                    <label htmlFor="searchLimit">
                        Maximale Suchergebnisse
                        <input
                            type="number"
                            id="searchLimit"
                            value={searchLimit}
                            onChange={(e) =>
                                handleNumberChange(setSearchLimit, e)
                            }
                            min="0"
                        />
                    </label>
                    <p className="setting-description">
                        Begrenzt die Anzahl der angezeigten Suchergebnisse. 0
                        für unbegrenzt.
                    </p>
                </div>
                <div className="setting-item">
                    <label
                        htmlFor="showRelevanceScores"
                        className="checkbox-label"
                    >
                        Relevanz-Scores anzeigen
                        <input
                            type="checkbox"
                            id="showRelevanceScores"
                            checked={showRelevance}
                            onChange={handleShowRelevanceChange}
                        />
                    </label>
                    <p className="setting-description">
                        Zeigt die berechnete Relevanzbewertung für jedes
                        Suchergebnis an.
                    </p>
                </div>
            </div>

            {/* Punktesystem für Relevanz */}
            <div className="setting-group">
                <h3>Relevanz-Bewertung</h3>
                <div className="setting-item">
                    <label htmlFor="filenameExactMatchScore">
                        Punkte für exakten Dateinamen-Treffer
                        <input
                            type="number"
                            id="filenameExactMatchScore"
                            value={filenameExactMatchScore}
                            onChange={(e) =>
                                handleNumberChange(
                                    setFilenameExactMatchScore,
                                    e
                                )
                            }
                            min="0"
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label htmlFor="filenamePartialMatchScore">
                        Punkte für teilweisen Dateinamen-Treffer
                        <input
                            type="number"
                            id="filenamePartialMatchScore"
                            value={filenamePartialMatchScore}
                            onChange={(e) =>
                                handleNumberChange(
                                    setFilenamePartialMatchScore,
                                    e
                                )
                            }
                            min="0"
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label htmlFor="contentMatchScore">
                        Punkte pro Treffer im Inhalt
                        <input
                            type="number"
                            id="contentMatchScore"
                            value={contentMatchScore}
                            onChange={(e) =>
                                handleNumberChange(setContentMatchScore, e)
                            }
                            min="0"
                        />
                    </label>
                </div>
                <p className="setting-description">
                    Konfiguriert die Gewichtung verschiedener Treffertypen für
                    die Sortierung.
                </p>
            </div>

            {/* Snippet-Einstellungen */}
            <div className="setting-group">
                <h3>Vorschau-Snippets</h3>
                <div className="setting-item">
                    <label htmlFor="snippetLimit">
                        Maximale Snippets pro Datei
                        <input
                            type="number"
                            id="snippetLimit"
                            value={snippetLimit}
                            onChange={(e) =>
                                handleNumberChange(setSnippetLimit, e)
                            }
                            min="0"
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label htmlFor="snippetWindow">
                        Snippet-Fenster (Zeichen)
                        <input
                            type="number"
                            id="snippetWindow"
                            value={snippetWindow}
                            onChange={(e) =>
                                handleNumberChange(setSnippetWindow, e)
                            }
                            min="0"
                        />
                    </label>
                    <p className="setting-description">
                        Anzahl der Zeichen, die vor und nach einem Treffer im
                        Snippet angezeigt werden.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="proximityWindow">
                        Proximity-Fenster (Zeichen)
                        <input
                            type="number"
                            id="proximityWindow"
                            value={proximityWindow}
                            onChange={(e) =>
                                handleNumberChange(setProximityWindow, e)
                            }
                            min="0"
                        />
                    </label>
                    <p className="setting-description">
                        Relevant für Suchen mit mehreren Begriffen: der maximale
                        Abstand zwischen den Wörtern, um als relevanter Treffer
                        zu gelten.
                    </p>
                </div>
            </div>
        </div>
    );
}
