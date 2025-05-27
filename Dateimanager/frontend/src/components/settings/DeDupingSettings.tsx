import React from 'react';

// Helper function to parse integer input, handling NaN
const parseIntInput = (value) => {
    const parsedValue = parseInt(value, 10);
    return isNaN(parsedValue) ? 0 : parsedValue;
};

// Helper function to parse float input, handling NaN
const parseFloatInput = (value) => {
    const parsedValue = parseFloat(value);
    return isNaN(parsedValue) ? 0.0 : parsedValue;
};


/**
 * Component for configuring De-Duping (Entduplizierung) settings.
 * Allows users to adjust parameters for the duplicate finding algorithm.
 */
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
    similarityThreshold, // Prop name corrected to similarityThreshold
    setSimilarityThreshold // Prop name corrected to setSimilarityThreshold
}) {

    // Handlers for each input field
    const handleLengthRangeStepChange = (event) => {
        setLengthRangeStep(parseIntInput(event.target.value));
    };

    const handleMinCategoryLengthChange = (event) => {
        setMinCategoryLength(parseIntInput(event.target.value));
    };

    const handleSnippetLengthDedupeChange = (event) => {
        setSnippetLengthDedupe(parseIntInput(event.target.value));
    };

    const handleSnippetStepDedupeChange = (event) => {
        setSnippetStepDedupe(parseIntInput(event.target.value));
    };

    const handleSignatureSizeChange = (event) => {
        setSignatureSize(parseIntInput(event.target.value));
    };

    const handleSimilarityThresholdChange = (event) => {
        // Allow decimal inputs for similarity threshold
        setSimilarityThreshold(parseFloatInput(event.target.value));
    };


    return (
        <div className="settings-section">
            <h3>Entduplizierungseinstellungen</h3>

            {/* lengthRangeStep */}
            <div className="form-group">
                <label htmlFor="lengthRangeStep" className="search-relevance-input">
                    Längenbereich Schrittweite:
                    <input
                        type="number"
                        id="lengthRangeStep"
                        value={lengthRangeStep ?? ''} // Use ?? '' to handle null/undefined from Optional[int]
                        onChange={handleLengthRangeStepChange}
                        min="1" // Must be at least 1
                    />
                </label>
                <p className="setting-description">
                    Schrittweite für die Gruppierung von Dateien nach der Länge ihres bereinigten Inhalts.
                    Kleinere Werte führen zu mehr, aber kleineren Gruppen.
                </p>
            </div>

            {/* minCategoryLength */}
            <div className="form-group">
                <label htmlFor="minCategoryLength" className="search-relevance-input">
                    Mindestanzahl pro Gruppe:
                    <input
                        type="number"
                        id="minCategoryLength"
                        value={minCategoryLength ?? ''} // Use ?? ''
                        onChange={handleMinCategoryLengthChange}
                        min="2" // Must be at least 2 for a duplicate group
                    />
                </label>
                <p className="setting-description">
                    Die minimale Anzahl von Dateien, die eine Duplikatgruppe haben muss, um angezeigt zu werden.
                    Sowohl nach Längengruppierung als auch nach Ähnlichkeitsgruppierung angewendet.
                </p>
            </div>

            {/* snippetLengthDedupe (K) */}
            <div className="form-group">
                <label htmlFor="snippetLengthDedupe" className="search-relevance-input">
                    Shingle-Länge (K):
                    <input
                        type="number"
                        id="snippetLengthDedupe"
                        value={snippetLengthDedupe ?? ''} // Use ?? ''
                        onChange={handleSnippetLengthDedupeChange}
                        min="1" // Must be at least 1
                    />
                </label>
                <p className="setting-description">
                    Die Länge der Zeichen-Shingles, die zur Erstellung der Signatur verwendet werden.
                    Größere Werte machen die Shingles spezifischer und können die Genauigkeit bei sehr ähnlichen Texten verbessern.
                </p>
            </div>

            {/* snippetStepDedupe */}
            <div className="form-group">
                <label htmlFor="snippetStepDedupe" className="search-relevance-input">
                    Shingle-Schrittweite:
                    <input
                        type="number"
                        id="snippetStepDedupe"
                        value={snippetStepDedupe ?? ''} // Use ?? ''
                        onChange={handleSnippetStepDedupeChange}
                        min="1" // Must be at least 1
                    />
                </label>
                <p className="setting-description">
                    Der Abstand zwischen dem Start jedes Shingles.
                    Ein Wert von 1 erfasst alle möglichen Shingles, größere Werte überspringen Shingles (kann Performance verbessern, Genauigkeit reduzieren).
                </p>
            </div>

            {/* signatureSize (M) */}
            <div className="form-group">
                <label htmlFor="signatureSize" className="search-relevance-input">
                    Signaturgröße (M):
                    <input
                        type="number"
                        id="signatureSize"
                        value={signatureSize ?? ''} // Use ?? ''
                        onChange={handleSignatureSizeChange}
                        min="1" // Must be at least 1
                    />
                </label>
                <p className="setting-description">
                    Die Anzahl der Hash-Funktionen, die für die MinHash-Signatur verwendet werden.
                    Größere Werte erhöhen die Genauigkeit der Ähnlichkeitsschätzung, benötigen aber mehr Speicher und Rechenzeit.
                </p>
            </div>

            {/* similarityThreshold */}
            <div className="form-group">
                <label htmlFor="similarityThreshold" className="search-relevance-input">
                    Ähnlichkeitsschwellenwert:
                    <input
                        type="number"
                        id="similarityThreshold"
                        value={similarityThreshold ?? ''} // Use ?? ''
                        onChange={handleSimilarityThresholdChange}
                        min="0"
                        max="1"
                        step="0.01" // Allow decimal input
                    />
                </label>
                <p className="setting-description">
                    Der minimale Ähnlichkeitswert (0.0 bis 1.0), damit Dateien als Duplikate gruppiert werden.
                    Höhere Werte finden nur sehr enge Duplikate, niedrigere Werte finden auch ähnliche Varianten.
                </p>
            </div>

        </div>
    );
}
