import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

export default function OCRSettings({
    processorExcludedFolders,
    setProcessorExcludedFolders,
    subfolder,
    setSubfolder,
    prefix,
    setPrefix,
    overwrite,
    setOverwrite,
    processingCpuCores,
    setProcessingCpuCores,
    forceOcr,
    setForceOcr,
    skipText,
    setSkipText,
    redoOcr,
    setRedoOcr
}) {
    const [excludedFoldersInput, setExcludedFoldersInput] = useState(processorExcludedFolders);

    // Update input field when processorExcludedFolders changes
    useEffect(() => {
        setExcludedFoldersInput(processorExcludedFolders);
    }, [processorExcludedFolders]);

    // Update processorExcludedFolders whenever excludedFoldersInput changes
    useEffect(() => {
        const trimmedInput = excludedFoldersInput.trim();
        setProcessorExcludedFolders(trimmedInput);
    }, [excludedFoldersInput, setProcessorExcludedFolders]); // Abhängigkeit von excludedFoldersInput

    // Handler für Änderungen im Unterordner-Feld
    const handleOutputSubdirChange = (e) => {
        setSubfolder(e.target.value);
        setPrefix('');
        setOverwrite(false);
    };

    // Handler für Änderungen im Präfix-Feld
    const handleOutputPrefixChange = (e) => {
        setPrefix(e.target.value);
        setSubfolder('');
        setOverwrite(false);
    };

    // Handler für die Überschreiben-Checkbox
    const handleOverwriteChange = (e) => {
        setOverwrite(e.target.checked);
        setSubfolder('');
        setPrefix('');
    };

    // Handler für die Force OCR-Checkbox
    const handleForceOcrChange = (e) => {
        setForceOcr(e.target.checked);
        if (e.target.checked === true) {
            setSkipText(false);
            setRedoOcr(false);
        }
    };

    // Handler für die Skip Text-Checkbox
    const handleSkipTextChange = (e) => {
        setSkipText(e.target.checked);
        if (e.target.checked === true) {
            setForceOcr(false);
            setRedoOcr(false);
        }
    };

    // Handler für die Redo OCR-Checkbox
    const handleRedoOcrChange = (e) => {
        setRedoOcr(e.target.checked);
        if (e.target.checked === true) {
            setForceOcr(false);
            setSkipText(false);
        }
    };

    const handleExcludedFoldersInputChange = (event) => {
        setExcludedFoldersInput(event.target.value);
    };

    return (
        <div className="settings-section">
            <h2>OCR-Einstellungen</h2>

            <div className="settings-group">
                <h3>Prozessor-Einstellungen (werden im OCR-Tab voreingestellt)</h3>
                <div className="form-group">
                    <label className="settings-input-group">
                        Ausgeschlossene Ordner:
                        <input
                            type="text"
                            value={excludedFoldersInput}
                            onChange={handleExcludedFoldersInputChange}
                            placeholder="z.B. .venv, .tools, windows"
                            className="excluded-folders-input"
                        />
                        <p className="setting-description">
                            Geben Sie die Ordner, die vom Scan ausgeschlossen werden sollen, durch Kommas getrennt ein.
                        </p>
                    </label>
                </div>
                <label className="settings-input-group">
                    Unterordner für OCR-Ausgabe:
                    <input
                        type="text"
                        value={subfolder}
                        onChange={handleOutputSubdirChange}
                        placeholder="z.B. OCR_Output"
                    />
                </label>
                <label className="settings-input-group">
                    Präfix für OCR-Dateinamen:
                    <input
                        type="text"
                        value={prefix}
                        onChange={handleOutputPrefixChange}
                        placeholder="z.B. OCR_"
                    />
                </label>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={overwrite}
                        onChange={handleOverwriteChange}
                    />
                    Überschreiben
                </label>
                <label className="settings-input-group">
                    Maximale Anzahl an Arbeitern:
                    <input
                        type="number"
                        value={processingCpuCores}
                        onChange={(e) => setProcessingCpuCores(parseInt(e.target.value, 10) || null)}
                        min="0"
                    />
                </label>
            </div>

            <div className="settings-group">
                <h3>Standardeinstellungen für OCR-Umwandlung</h3>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={forceOcr}
                        onChange={handleForceOcrChange}
                    />
                    <p className="setting-description">OCR standardmäßig erzwingen (auch wenn Text vermutet wird)</p>
                </label>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={skipText}
                        onChange={handleSkipTextChange}
                    />
                    <p className="setting-description">Seiten mit Text standardmäßig überspringen</p>
                </label>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={redoOcr}
                        onChange={handleRedoOcrChange}
                    />
                    <p className="setting-description">OCR standardmäßig erneut durchführen (auch wenn bereits vorhanden)</p>
                </label>
            </div>
        </div>
    );
}
