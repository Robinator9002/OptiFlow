import React from 'react';

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
}) {
    const handleSearchLimitChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setSearchLimit(isNaN(value) ? 0 : value);
    };

    const handleSnippetLimitChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setSnippetLimit(isNaN(value) ? 0 : value);
    };

    const handleShowRelevanceScoresChange = (event) => {
        setShowRelevance(event.target.checked);
    };

    const handleFilenameExactMatchScoreChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setFilenameExactMatchScore(isNaN(value) ? 0 : value);
    };

    const handleFilenamePartialMatchScoreChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setFilenamePartialMatchScore(isNaN(value) ? 0 : value);
    };

    const handleContentMatchScoreChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setContentMatchScore(isNaN(value) ? 0 : value);
    };

    const handleSnippetWindowChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setSnippetWindow(isNaN(value) ? 0 : value);
    };

    const handleProximityWindowChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setProximityWindow(isNaN(value) ? 0 : value);
    };

    return (
        <div className="settings-section">
            <h3>Sucheinstellungen</h3>
            <div className="form-group">
                <label htmlFor="searchLimit" className="search-relevance-input">Max. Suchergebnisse:
                    <input
                        type="number"
                        id="searchLimit"
                        value={searchLimit}
                        onChange={handleSearchLimitChange}
                        min="0"
                    />
                </label>
                <p className="setting-description">Begrenzt die Anzahl der angezeigten Suchergebnisse.</p>
            </div>
            <div className="form-group">
                <label htmlFor="showRelevanceScores" className="checkbox-label">Relevanz-Scores anzeigen:
                <input
                    type="checkbox"
                    id="showRelevanceScores"
                    checked={showRelevance}
                    onChange={handleShowRelevanceScoresChange}
                />
                </label>
                <p className="setting-description">Zeigt die Relevanzbewertung für jedes Suchergebnis an.</p>
            </div>

            <h3>Punktesystem</h3>

            <div className="form-group">
                <label htmlFor="filenameExactMatchScore" className="search-relevance-input">Dateiname (Exakt):
                    <input
                        type="number"
                        id="filenameExactMatchScore"
                        value={filenameExactMatchScore}
                        onChange={handleFilenameExactMatchScoreChange}
                        min="0"
                    />
                </label>
                <label htmlFor="filenamePartialMatchScore" className="search-relevance-input">Dateiname (Teilweise):
                    <input
                        type="number"
                        id="filenamePartialMatchScore"
                        value={filenamePartialMatchScore}
                        onChange={handleFilenamePartialMatchScoreChange}
                        min="0"
                    />
                </label>
                <label htmlFor="contentMatchScore" className="search-relevance-input">Inhalt:
                    <input
                        type="number"
                        id="contentMatchScore"
                        value={contentMatchScore}
                        onChange={handleContentMatchScoreChange}
                        min="0"
                    />
                </label>
                <p className='setting-description'>Wie viele Punkte für ...</p>
            </div>

            <h3>In Datei Suche</h3>
            <div className="form-group">
                <div className="form-group">
                    <label htmlFor="snippetLimit" className="search-relevance-input">Max. Snippets:
                        <input
                            type="number"
                            id="snippetLimit"
                            value={snippetLimit}
                            onChange={handleSnippetLimitChange}
                            min="0"
                        />
                    </label>
                    <p className="setting-description">Begrenzt die Anzahl der angezeigten Snippets.</p>
                </div>
                <label htmlFor="snippetWindow" className="search-relevance-input">Snippet Fenster:
                    <input
                        type="number"
                        id="snippetWindow"
                        value={snippetWindow}
                        onChange={handleSnippetWindowChange}
                        min="0"
                    />
                </label>
                <p className="setting-description">Wie viele Zeichen nach und vor dem Suchbegriff angezeigt werden sollen.</p>
            </div>

            <div className="form-group">
                <label htmlFor="proximityWindow" className="search-relevance-input">Proximity Fenster:
                    <input
                        type="number"
                        id="proximityWindow"
                        value={proximityWindow}
                        onChange={handleProximityWindowChange}
                        min="0"
                    />
                </label>
                <p className="setting-description">Wie viele Zeichen um den Suchbegriff miteinbezogen werden.</p>
            </div>
        </div>
    );
}
