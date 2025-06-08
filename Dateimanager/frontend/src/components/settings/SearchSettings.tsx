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
  const handleNumberChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    setter(isNaN(value) ? 0 : value);
  };

  const handleShowRelevanceScoresChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setShowRelevance(event.target.checked);
  };

  return (
    <div className="settings-section">
      <h3>Sucheinstellungen</h3>
      <div className="form-group">
        <label htmlFor="searchLimit" className="search-relevance-input">
          Max. Suchergebnisse:
          <input
            type="number"
            id="searchLimit"
            value={searchLimit}
            onChange={(e) => handleNumberChange(setSearchLimit, e)}
            min="0"
          />
        </label>
        <p className="setting-description">
          Begrenzt die Anzahl der angezeigten Suchergebnisse.
        </p>
      </div>
      <div className="form-group">
        <label htmlFor="showRelevanceScores" className="checkbox-label">
          Relevanz-Scores anzeigen:
          <input
            type="checkbox"
            id="showRelevanceScores"
            checked={showRelevance}
            onChange={handleShowRelevanceScoresChange}
          />
        </label>
        <p className="setting-description">
          Zeigt die Relevanzbewertung für jedes Suchergebnis an.
        </p>
      </div>

      <h3>Punktesystem</h3>
      <div className="form-group">
        <label
          htmlFor="filenameExactMatchScore"
          className="search-relevance-input"
        >
          Dateiname (Exakt):
          <input
            type="number"
            id="filenameExactMatchScore"
            value={filenameExactMatchScore}
            onChange={(e) => handleNumberChange(setFilenameExactMatchScore, e)}
            min="0"
          />
        </label>
        <label
          htmlFor="filenamePartialMatchScore"
          className="search-relevance-input"
        >
          Dateiname (Teilweise):
          <input
            type="number"
            id="filenamePartialMatchScore"
            value={filenamePartialMatchScore}
            onChange={(e) =>
              handleNumberChange(setFilenamePartialMatchScore, e)
            }
            min="0"
          />
        </label>
        <label htmlFor="contentMatchScore" className="search-relevance-input">
          Inhalt:
          <input
            type="number"
            id="contentMatchScore"
            value={contentMatchScore}
            onChange={(e) => handleNumberChange(setContentMatchScore, e)}
            min="0"
          />
        </label>
        <p className="setting-description">Wie viele Punkte für ...</p>
      </div>

      <h3>In Datei Suche</h3>
      <div className="form-group">
        <div className="form-group">
          <label htmlFor="snippetLimit" className="search-relevance-input">
            Max. Snippets:
            <input
              type="number"
              id="snippetLimit"
              value={snippetLimit}
              onChange={(e) => handleNumberChange(setSnippetLimit, e)}
              min="0"
            />
          </label>
          <p className="setting-description">
            Begrenzt die Anzahl der angezeigten Snippets.
          </p>
        </div>
        <label htmlFor="snippetWindow" className="search-relevance-input">
          Snippet Fenster:
          <input
            type="number"
            id="snippetWindow"
            value={snippetWindow}
            onChange={(e) => handleNumberChange(setSnippetWindow, e)}
            min="0"
          />
        </label>
        <p className="setting-description">
          Wie viele Zeichen nach und vor dem Suchbegriff angezeigt werden
          sollen.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="proximityWindow" className="search-relevance-input">
          Proximity Fenster:
          <input
            type="number"
            id="proximityWindow"
            value={proximityWindow}
            onChange={(e) => handleNumberChange(setProximityWindow, e)}
            min="0"
          />
        </label>
        <p className="setting-description">
          Wie viele Zeichen um den Suchbegriff miteinbezogen werden.
        </p>
      </div>
    </div>
  );
}
