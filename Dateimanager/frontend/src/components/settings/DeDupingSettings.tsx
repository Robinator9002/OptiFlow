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
    // Generischer Handler für Integer-Inputs
    const handleIntegerChange = (
        setter: React.Dispatch<React.SetStateAction<number>>,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = parseInt(event.target.value, 10);
        setter(isNaN(value) ? 0 : value);
    };

    // Generischer Handler für Float-Inputs
    const handleFloatChange = (
        setter: React.Dispatch<React.SetStateAction<number>>,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = parseFloat(event.target.value);
        setter(isNaN(value) ? 0.0 : value);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>Entduplizierung</h2>
            </div>

            <div className="setting-group">
                <h3>Gruppierung</h3>
                <div className="setting-item">
                    <label htmlFor="lengthRangeStep">
                        Längenbereich-Schrittweite
                        <input
                            type="number"
                            id="lengthRangeStep"
                            value={lengthRangeStep}
                            onChange={(e) =>
                                handleIntegerChange(setLengthRangeStep, e)
                            }
                            min="1"
                        />
                    </label>
                    <p className="setting-description">
                        Schrittweite für die Gruppierung von Dateien nach der
                        Länge ihres Inhalts.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="minCategoryLength">
                        Mindestanzahl pro Duplikat-Gruppe
                        <input
                            type="number"
                            id="minCategoryLength"
                            value={minCategoryLength}
                            onChange={(e) =>
                                handleIntegerChange(setMinCategoryLength, e)
                            }
                            min="2"
                        />
                    </label>
                    <p className="setting-description">
                        Eine Duplikatgruppe wird nur angezeigt, wenn sie
                        mindestens so viele Dateien enthält.
                    </p>
                </div>
            </div>

            <div className="setting-group">
                <h3>Analyse-Algorithmus (MinHash)</h3>
                <div className="setting-item">
                    <label htmlFor="snippetLengthDedupe">
                        Shingle-Länge (k)
                        <input
                            type="number"
                            id="snippetLengthDedupe"
                            value={snippetLengthDedupe}
                            onChange={(e) =>
                                handleIntegerChange(setSnippetLengthDedupe, e)
                            }
                            min="1"
                        />
                    </label>
                    <p className="setting-description">
                        Die Länge der Zeichen-Shingles (Text-Abschnitte), die
                        zur Erstellung der Inhaltssignatur verwendet werden.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="snippetStepDedupe">
                        Shingle-Schrittweite
                        <input
                            type="number"
                            id="snippetStepDedupe"
                            value={snippetStepDedupe}
                            onChange={(e) =>
                                handleIntegerChange(setSnippetStepDedupe, e)
                            }
                            min="1"
                        />
                    </label>
                    <p className="setting-description">
                        Der Abstand zwischen dem Start jedes Shingles. Ein
                        kleinerer Wert ist genauer, aber langsamer.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="signatureSize">
                        Signaturgröße (m)
                        <input
                            type="number"
                            id="signatureSize"
                            value={signatureSize}
                            onChange={(e) =>
                                handleIntegerChange(setSignatureSize, e)
                            }
                            min="1"
                        />
                    </label>
                    <p className="setting-description">
                        Die Anzahl der Hash-Werte, die die MinHash-Signatur
                        einer Datei bilden. Mehr = genauer.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="similarityThreshold">
                        Ähnlichkeitsschwellenwert
                        <input
                            type="number"
                            id="similarityThreshold"
                            value={similarityThreshold}
                            onChange={(e) =>
                                handleFloatChange(setSimilarityThreshold, e)
                            }
                            min="0"
                            max="1"
                            step="0.01"
                        />
                    </label>
                    <p className="setting-description">
                        Der minimale Ähnlichkeitswert (0.0 bis 1.0), damit
                        Dateien als Duplikate gelten.
                    </p>
                </div>
            </div>
        </div>
    );
}
