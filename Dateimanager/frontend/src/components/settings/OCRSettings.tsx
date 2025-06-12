import React from "react";

// --- Type Definitions ---
interface OCRSettingsProps {
    processorExcludedFolders: string;
    setProcessorExcludedFolders: React.Dispatch<React.SetStateAction<string>>;
    subfolder: string;
    setSubfolder: React.Dispatch<React.SetStateAction<string>>;
    prefix: string;
    setPrefix: React.Dispatch<React.SetStateAction<string>>;
    overwrite: boolean;
    setOverwrite: React.Dispatch<React.SetStateAction<boolean>>;
    processingCpuCores: number | null;
    setProcessingCpuCores: React.Dispatch<React.SetStateAction<number | null>>;
    forceOcr: boolean;
    setForceOcr: React.Dispatch<React.SetStateAction<boolean>>;
    skipText: boolean;
    setSkipText: React.Dispatch<React.SetStateAction<boolean>>;
    redoOcr: boolean;
    setRedoOcr: React.Dispatch<React.SetStateAction<boolean>>;
    // --- NEUE PROPS ---
    ocrLanguage: string;
    setOcrLanguage: React.Dispatch<React.SetStateAction<string>>;
    ocrImageDpi: number;
    setOcrImageDpi: React.Dispatch<React.SetStateAction<number>>;
    ocrOptimizeLevel: number;
    setOcrOptimizeLevel: React.Dispatch<React.SetStateAction<number>>;
    ocrCleanImages: boolean;
    setOcrCleanImages: React.Dispatch<React.SetStateAction<boolean>>;
    ocrTesseractConfig: string;
    setOcrTesseractConfig: React.Dispatch<React.SetStateAction<string>>;
}

// --- Component ---
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
    setRedoOcr,
    // --- NEUE PROPS ---
    ocrLanguage,
    setOcrLanguage,
    ocrImageDpi,
    setOcrImageDpi,
    ocrOptimizeLevel,
    setOcrOptimizeLevel,
    ocrCleanImages,
    setOcrCleanImages,
    ocrTesseractConfig,
    setOcrTesseractConfig,
}: OCRSettingsProps) {
    const handleTextChange = (
        setter: React.Dispatch<React.SetStateAction<string>>,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setter(e.target.value);
    };

    const handleCheckboxChange = (
        setter: React.Dispatch<React.SetStateAction<boolean>>,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setter(e.target.checked);
    };

    const handleNumberChange = (
        setter: React.Dispatch<React.SetStateAction<number>>,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setter(value);
        }
    };

    const handleCpuCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setProcessingCpuCores(isNaN(value) ? null : value);
    };

    // --- Logik für exklusive Auswahl der Ausgabeoption ---
    const handleOutputSubdirChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setSubfolder(e.target.value);
        setPrefix("");
        setOverwrite(false);
    };

    const handleOutputPrefixChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setPrefix(e.target.value);
        setSubfolder("");
        setOverwrite(false);
    };

    const handleOverwriteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleCheckboxChange(setOverwrite, e);
        if (e.target.checked) {
            setSubfolder("");
            setPrefix("");
        }
    };

    // --- Logik für exklusive Auswahl der OCR-Modi ---
    const handleForceOcrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForceOcr(e.target.checked);
        if (e.target.checked) {
            setSkipText(false);
            setRedoOcr(false);
        }
    };

    const handleSkipTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSkipText(e.target.checked);
        if (e.target.checked) {
            setForceOcr(false);
            setRedoOcr(false);
        }
    };

    const handleRedoOcrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRedoOcr(e.target.checked);
        if (e.target.checked) {
            setForceOcr(false);
            setSkipText(false);
        }
    };

    return (
        <div className="settings-section">
            <h2>OCR-Einstellungen</h2>

            <div className="settings-group">
                <h3>
                    Ausgabe-Optionen (wird im OCR-Tab für einen Prozesslauf
                    voreingestellt)
                </h3>
                <div className="form-group">
                    <label className="settings-input-group">
                        Ausgeschlossene Ordner:
                        <input
                            type="text"
                            value={processorExcludedFolders}
                            onChange={(e) =>
                                handleTextChange(setProcessorExcludedFolders, e)
                            }
                            placeholder="z.B. .venv, .tools, windows"
                            className="excluded-folders-input"
                        />
                        <p className="setting-description">
                            Durch Kommas getrennte Namen von Ordnern, die beim
                            Scannen ignoriert werden sollen.
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
                    Originaldateien überschreiben
                </label>
            </div>

            <div className="settings-group">
                <h3>Technische Einstellungen</h3>
                <label className="settings-input-group">
                    Maximale Anzahl an CPU-Kernen (0 = automatisch):
                    <input
                        type="number"
                        value={processingCpuCores ?? ""}
                        onChange={handleCpuCoreChange}
                        min="0"
                    />
                </label>
                {/* --- NEUE EINSTELLUNGEN --- */}
                <label className="settings-input-group">
                    OCR-Sprache(n):
                    <input
                        type="text"
                        value={ocrLanguage}
                        onChange={(e) => handleTextChange(setOcrLanguage, e)}
                        placeholder="z.B. deu+eng"
                    />
                    <p className="setting-description">
                        Tesseract-Sprachkürzel. Mehrere mit "+" trennen (z.B.
                        deu+eng).
                    </p>
                </label>
                <label className="settings-input-group">
                    Bild-DPI für OCR:
                    <input
                        type="number"
                        value={ocrImageDpi}
                        onChange={(e) => handleNumberChange(setOcrImageDpi, e)}
                        min="70"
                    />
                </label>
                <label className="settings-input-group">
                    Optimierungslevel (0-3):
                    <input
                        type="number"
                        value={ocrOptimizeLevel}
                        onChange={(e) =>
                            handleNumberChange(setOcrOptimizeLevel, e)
                        }
                        min="0"
                        max="3"
                    />
                    <p className="setting-description">
                        0=Keine, 1=Gut, 2=Besser, 3=Beste (langsamer).
                    </p>
                </label>
                <label className="settings-input-group">
                    Zusätzliche Tesseract-Konfiguration:
                    <input
                        type="text"
                        value={ocrTesseractConfig}
                        onChange={(e) =>
                            handleTextChange(setOcrTesseractConfig, e)
                        }
                        placeholder="z.B. --oem 1 --psm 3"
                    />
                </label>
            </div>

            <div className="settings-group">
                <h3>Standardverhalten für die Umwandlung</h3>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={forceOcr}
                        onChange={handleForceOcrChange}
                    />
                    OCR erzwingen (ignoriert existierende Textebene)
                </label>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={skipText}
                        onChange={handleSkipTextChange}
                    />
                    Seiten mit Text überspringen
                </label>
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={redoOcr}
                        onChange={handleRedoOcrChange}
                    />
                    OCR erneut durchführen (wenn Textebene schon da ist)
                </label>
                {/* --- NEUE EINSTELLUNG --- */}
                <label className="ocr-settings-input-label">
                    <input
                        type="checkbox"
                        checked={ocrCleanImages}
                        onChange={(e) =>
                            handleCheckboxChange(setOcrCleanImages, e)
                        }
                    />
                    Bilder vor der OCR-Analyse bereinigen
                </label>
            </div>
        </div>
    );
}
