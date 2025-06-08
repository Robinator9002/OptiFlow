import React from "react";

// --- Type Definitions ---
interface DeDupingSettingsProps {
  lengthRangeStep: number;
  setLengthRangeStep: React.Dispatch<React.SetStateAction<number>>;
  minCategoryLength: number;
  setMinCategoryLength: React.Dispatch<React.SetStateAction<number>>;
  snippetLengthDedupe: number;
  setSnippetLengthDedupe: React.Dispatch<React.SetStateAction<number>>;
  snippetStepDedupe: number;
  setSnippetStepDedupe: React.Dispatch<React.SetStateAction<number>>;
  signatureSize: number;
  setSignatureSize: React.Dispatch<React.SetStateAction<number>>;
  similarityThreshold: number;
  setSimilarityThreshold: React.Dispatch<React.SetStateAction<number>>;
}

// --- Helper Functions ---
const parseIntInput = (value: string): number => {
  const parsedValue = parseInt(value, 10);
  return isNaN(parsedValue) ? 0 : parsedValue;
};

const parseFloatInput = (value: string): number => {
  const parsedValue = parseFloat(value);
  return isNaN(parsedValue) ? 0.0 : parsedValue;
};

// --- Component ---
export default function DeDupingSettings({
  lengthRangeStep,
  setLengthRangeStep,
  minCategoryLength,
  setMinCategoryLength,
  snippetLengthDedupe,
  setSnippetLengthDedupe,
  snippetStepDedupe,
  setSnippetStepDedupe,
  signatureSize,
  setSignatureSize,
  similarityThreshold,
  setSimilarityThreshold,
}: DeDupingSettingsProps) {
  const handleIntegerChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setter(parseIntInput(event.target.value));
  };

  const handleFloatChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setter(parseFloatInput(event.target.value));
  };

  return (
    <div className="settings-section">
      <h3>Entduplizierungseinstellungen</h3>

      <div className="form-group">
        <label htmlFor="lengthRangeStep" className="search-relevance-input">
          Längenbereich Schrittweite:
          <input
            type="number"
            id="lengthRangeStep"
            value={lengthRangeStep ?? ""}
            onChange={(e) => handleIntegerChange(setLengthRangeStep, e)}
            min="1"
          />
        </label>
        <p className="setting-description">
          Schrittweite für die Gruppierung von Dateien nach der Länge ihres
          bereinigten Inhalts.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="minCategoryLength" className="search-relevance-input">
          Mindestanzahl pro Gruppe:
          <input
            type="number"
            id="minCategoryLength"
            value={minCategoryLength ?? ""}
            onChange={(e) => handleIntegerChange(setMinCategoryLength, e)}
            min="2"
          />
        </label>
        <p className="setting-description">
          Die minimale Anzahl von Dateien, die eine Duplikatgruppe haben muss,
          um angezeigt zu werden.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="snippetLengthDedupe" className="search-relevance-input">
          Shingle-Länge (K):
          <input
            type="number"
            id="snippetLengthDedupe"
            value={snippetLengthDedupe ?? ""}
            onChange={(e) => handleIntegerChange(setSnippetLengthDedupe, e)}
            min="1"
          />
        </label>
        <p className="setting-description">
          Die Länge der Zeichen-Shingles, die zur Erstellung der Signatur
          verwendet werden.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="snippetStepDedupe" className="search-relevance-input">
          Shingle-Schrittweite:
          <input
            type="number"
            id="snippetStepDedupe"
            value={snippetStepDedupe ?? ""}
            onChange={(e) => handleIntegerChange(setSnippetStepDedupe, e)}
            min="1"
          />
        </label>
        <p className="setting-description">
          Der Abstand zwischen dem Start jedes Shingles.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="signatureSize" className="search-relevance-input">
          Signaturgröße (M):
          <input
            type="number"
            id="signatureSize"
            value={signatureSize ?? ""}
            onChange={(e) => handleIntegerChange(setSignatureSize, e)}
            min="1"
          />
        </label>
        <p className="setting-description">
          Die Anzahl der Hash-Funktionen, die für die MinHash-Signatur verwendet
          werden.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="similarityThreshold" className="search-relevance-input">
          Ähnlichkeitsschwellenwert:
          <input
            type="number"
            id="similarityThreshold"
            value={similarityThreshold ?? ""}
            onChange={(e) => handleFloatChange(setSimilarityThreshold, e)}
            min="0"
            max="1"
            step="0.01"
          />
        </label>
        <p className="setting-description">
          Der minimale Ähnlichkeitswert (0.0 bis 1.0), damit Dateien als
          Duplikate gruppiert werden.
        </p>
      </div>
    </div>
  );
}
