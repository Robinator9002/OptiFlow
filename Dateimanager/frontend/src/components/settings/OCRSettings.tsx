import React, { useState, useEffect } from "react";

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

// Definition der Qualitäts-Voreinstellungen
const PRESET_PACKS = {
    schnell: { ocrImageDpi: 150, ocrOptimizeLevel: 0, ocrCleanImages: false },
    ausgeglichen: { ocrImageDpi: 300, ocrOptimizeLevel: 1, ocrCleanImages: true },
    qualität: { ocrImageDpi: 400, ocrOptimizeLevel: 2, ocrCleanImages: true },
};

type PresetName = keyof typeof PRESET_PACKS | "custom";

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
    const [activePreset, setActivePreset] = useState<PresetName>("custom");

    // Effekt, um den aktiven Preset basierend auf den aktuellen Einstellungen zu bestimmen
    useEffect(() => {
        for (const presetName in PRESET_PACKS) {
            const preset =
                PRESET_PACKS[presetName as keyof typeof PRESET_PACKS];
            if (
                preset.ocrImageDpi === ocrImageDpi &&
                preset.ocrOptimizeLevel === ocrOptimizeLevel &&
                preset.ocrCleanImages === ocrCleanImages
            ) {
                setActivePreset(presetName as keyof typeof PRESET_PACKS);
                return;
            }
        }
        setActivePreset("custom");
    }, [ocrImageDpi, ocrOptimizeLevel, ocrCleanImages]);

    const handlePresetSelect = (presetName: keyof typeof PRESET_PACKS) => {
        const selectedPack = PRESET_PACKS[presetName];
        setOcrImageDpi(selectedPack.ocrImageDpi);
        setOcrOptimizeLevel(selectedPack.ocrOptimizeLevel);
        setOcrCleanImages(selectedPack.ocrCleanImages);
        setActivePreset(presetName);
    };

    // Setzt den Preset auf "custom", wenn manuelle Änderungen vorgenommen werden
    const handleManualChange = <T,>(
        setter: React.Dispatch<React.SetStateAction<T>>,
        value: T
    ) => {
        setter(value);
        setActivePreset("custom");
    };

    // Handler für mutually exclusive Output-Optionen
    const handleOutputSubdirChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setSubfolder(e.target.value);
        if (e.target.value) {
            setPrefix("");
            setOverwrite(false);
        }
    };
    const handleOutputPrefixChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setPrefix(e.target.value);
        if (e.target.value) {
            setSubfolder("");
            setOverwrite(false);
        }
    };
    const handleOverwriteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOverwrite(e.target.checked);
        if (e.target.checked) {
            setSubfolder("");
            setPrefix("");
        }
    };

    // Handler für mutually exclusive OCR-Verhaltensoptionen
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

    const isCustomizing = activePreset === "custom";

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>OCR-Einstellungen</h2>
            </div>

            <div className="setting-group">
                <h3>Qualitäts-Voreinstellungen</h3>
                <p
                    className="setting-description"
                    style={{ marginBottom: "1rem" }}
                >
                    Wählen Sie eine Voreinstellung oder "Benutzerdefiniert", um
                    die technischen Einstellungen manuell anzupassen.
                </p>
                <div className="preset-buttons">
                    {(
                        Object.keys(PRESET_PACKS) as Array<
                            keyof typeof PRESET_PACKS
                        >
                    ).map((p) => (
                        <button
                            key={p}
                            className={`preset-button ${
                                activePreset === p ? "active" : ""
                            }`}
                            onClick={() => handlePresetSelect(p)}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                    <button
                        className={`preset-button ${
                            activePreset === "custom" ? "active" : ""
                        }`}
                        onClick={() => setActivePreset("custom")}
                    >
                        Benutzerdefiniert
                    </button>
                </div>
            </div>

            <div className="setting-group">
                <h3>
                    Ausgabe-Optionen{" "}
                    <span className="setting-description">
                        (wird im OCR-Tab für einen Prozesslauf voreingestellt)
                    </span>
                </h3>
                <div className="setting-item">
                    <label htmlFor="processorExcludedFolders">
                        Ausgeschlossene Ordner
                        <input
                            id="processorExcludedFolders"
                            type="text"
                            value={processorExcludedFolders}
                            onChange={(e) =>
                                setProcessorExcludedFolders(e.target.value)
                            }
                            placeholder="z.B. .venv, .tools"
                        />
                    </label>
                    <p className="setting-description">
                        Durch Kommas getrennte Namen von Ordnern, die beim
                        Scannen ignoriert werden sollen.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="subfolder">
                        Unterordner für OCR-Ausgabe
                        <input
                            id="subfolder"
                            type="text"
                            value={subfolder}
                            onChange={handleOutputSubdirChange}
                            placeholder="z.B. OCR_Output"
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label htmlFor="prefix">
                        Präfix für OCR-Dateinamen
                        <input
                            id="prefix"
                            type="text"
                            value={prefix}
                            onChange={handleOutputPrefixChange}
                            placeholder="z.B. OCR_"
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label className="checkbox-label" htmlFor="overwrite">
                        Originaldateien überschreiben
                        <input
                            id="overwrite"
                            type="checkbox"
                            checked={overwrite}
                            onChange={handleOverwriteChange}
                        />
                    </label>
                </div>
            </div>

            <div className="setting-group">
                <h3>Standardverhalten für die Umwandlung</h3>
                <div className="setting-item">
                    <label className="checkbox-label" htmlFor="forceOcr">
                        OCR erzwingen (ignoriert existierende Textebene)
                        <input
                            id="forceOcr"
                            type="checkbox"
                            checked={forceOcr}
                            onChange={handleForceOcrChange}
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label className="checkbox-label" htmlFor="skipText">
                        Seiten mit Text überspringen
                        <input
                            id="skipText"
                            type="checkbox"
                            checked={skipText}
                            onChange={handleSkipTextChange}
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label className="checkbox-label" htmlFor="redoOcr">
                        OCR erneut durchführen (wenn Textebene schon da ist)
                        <input
                            id="redoOcr"
                            type="checkbox"
                            checked={redoOcr}
                            onChange={handleRedoOcrChange}
                        />
                    </label>
                </div>
            </div>

            <div className="setting-group">
                <h3>Technische Einstellungen</h3>
                <div className="setting-item">
                    <label htmlFor="processingCpuCores">
                        Maximale Anzahl an CPU-Kernen
                        <input
                            id="processingCpuCores"
                            type="number"
                            value={processingCpuCores ?? ""}
                            onChange={(e) =>
                                setProcessingCpuCores(
                                    e.target.value
                                        ? parseInt(e.target.value, 10)
                                        : null
                                )
                            }
                            min="0"
                            placeholder="Auto"
                        />
                    </label>
                    <p className="setting-description">
                        0 oder leer für automatische Bestimmung.
                    </p>
                </div>
                <div className="setting-item">
                    <label htmlFor="ocrLanguage">
                        OCR-Sprache(n)
                        <input
                            id="ocrLanguage"
                            type="text"
                            value={ocrLanguage}
                            onChange={(e) => setOcrLanguage(e.target.value)}
                            placeholder="z.B. deu+eng"
                        />
                    </label>
                    <p className="setting-description">
                        Tesseract-Sprachkürzel. Mehrere mit "+" trennen (z.B.
                        deu+eng).
                    </p>
                </div>

                <div
                    className={`setting-item ${
                        !isCustomizing ? "disabled-setting" : ""
                    }`}
                >
                    <label htmlFor="ocrImageDpi">
                        Bild-DPI für OCR
                        <input
                            id="ocrImageDpi"
                            type="number"
                            value={ocrImageDpi}
                            onChange={(e) =>
                                handleManualChange(
                                    setOcrImageDpi,
                                    parseInt(e.target.value, 10)
                                )
                            }
                            min="70"
                            disabled={!isCustomizing}
                        />
                    </label>
                </div>
                <div
                    className={`setting-item ${
                        !isCustomizing ? "disabled-setting" : ""
                    }`}
                >
                    <label htmlFor="ocrOptimizeLevel">
                        Optimierungslevel (0-3)
                        <input
                            id="ocrOptimizeLevel"
                            type="number"
                            value={ocrOptimizeLevel}
                            onChange={(e) =>
                                handleManualChange(
                                    setOcrOptimizeLevel,
                                    parseInt(e.target.value, 10)
                                )
                            }
                            min="0"
                            max="3"
                            disabled={!isCustomizing}
                        />
                    </label>
                    <p className="setting-description">
                        0=Keine, 1=Gut, 2=Besser, 3=Beste (langsamer, braucht weitere abhängigkeiten).
                    </p>
                </div>
                <div
                    className={`setting-item ${
                        !isCustomizing ? "disabled-setting" : ""
                    }`}
                >
                    <label className="checkbox-label" htmlFor="ocrCleanImages">
                        Bilder vor der OCR-Analyse bereinigen
                        <input
                            id="ocrCleanImages"
                            type="checkbox"
                            checked={ocrCleanImages}
                            onChange={(e) =>
                                handleManualChange(
                                    setOcrCleanImages,
                                    e.target.checked
                                )
                            }
                            disabled={!isCustomizing}
                        />
                    </label>
                </div>
                <div className="setting-item">
                    <label htmlFor="ocrTesseractConfig">
                        Zusätzliche Tesseract-Konfiguration
                        <input
                            id="ocrTesseractConfig"
                            type="text"
                            value={ocrTesseractConfig}
                            onChange={(e) =>
                                setOcrTesseractConfig(e.target.value)
                            }
                            placeholder="z.B. --oem 1 --psm 3"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
