import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "./ConfirmModal";
import { ocrConvertFolder, ocrConvertIndex } from "../api/api";
import { FolderSelector } from "./FolderSelector";
import { SettingsContext } from "../context/SettingsContext";

interface PDFProcessorProps {
    setProcessingPDF: (isProcessing: boolean) => void;
}

const PDFProcessor: React.FC<PDFProcessorProps> = ({ setProcessingPDF }) => {
    const settings = useContext(SettingsContext);

    // Fallback values if context is not yet ready
    const {
        ocrSubfolder = "",
        ocrPrefix = "",
        ocrOverwrite = false,
        ocrExcludedDirs = "",
        ocrMaxWorkerCount = 0,
    } = settings || {};

    const [folderPath, setFolderPath] = useState<string>("");
    const [outputSubdir, setOutputSubdir] = useState<string>(ocrSubfolder);
    const [outputPrefix, setOutputPrefix] = useState<string>(ocrPrefix);
    const [overwrite, setOverwrite] = useState<boolean>(ocrOverwrite);
    const [ignoredDirNames, setIgnoredDirNames] =
        useState<string>(ocrExcludedDirs);
    const [maxWorkers, setMaxWorkers] = useState<number>(ocrMaxWorkerCount ?? 0);
    const [confirmConvertFolder, setConfirmConvertFolder] = useState<
        boolean | null
    >(null);
    const [confirmConvertIndex, setConfirmConvertIndex] = useState<
        boolean | null
    >(null);
    const [errorFields, setErrorFields] = useState<string[]>([]);
    const [showFolderSelector, setShowFolderSelector] =
        useState<boolean>(false);

    const validateForm = (): boolean => {
        const newErrorFields: string[] = [];

        if (!folderPath) {
            toast.error("Ordnerpfad ist erforderlich.");
            newErrorFields.push("folderPath");
        }

        // This logic seems to want exactly one option selected
        const optionsCount = [!!outputSubdir, !!outputPrefix, overwrite].filter(
            Boolean
        ).length;
        if (optionsCount !== 1) {
            toast.error(
                "Genau eine der Optionen (Unterordner, Präfix oder Überschreiben) muss ausgewählt sein."
            );
            newErrorFields.push("outputOptions");
        }

        setErrorFields(newErrorFields);
        return newErrorFields.length === 0;
    };

    // This effect ensures only one output option is active
    useEffect(() => {
        // This logic is handled by the individual onChange handlers now
    }, [outputSubdir, outputPrefix, overwrite]);

    // Reset errorFields on input change
    useEffect(() => {
        if (errorFields.length > 0) {
            setErrorFields([]);
        }
    }, [
        folderPath,
        outputSubdir,
        outputPrefix,
        overwrite,
        ignoredDirNames,
        maxWorkers,
    ]);

    const handleConvertFolder = async () => {
        setConfirmConvertFolder(false);
        if (!validateForm()) {
            return;
        }
        try {
            setProcessingPDF(true);
            await ocrConvertFolder(
                folderPath,
                outputSubdir || null, // Send null if empty string
                outputPrefix || null, // Send null if empty string
                overwrite,
                ignoredDirNames,
                maxWorkers
            );
            toast.success(
                "✅ Der Ordner wurde erfolgreich in OCR Format umgewandelt."
            );
        } catch (error: any) {
            toast.error(
                `❌ Fehler beim Konvertieren des Ordners: ${error.message}`
            );
        } finally {
            setProcessingPDF(false);
        }
    };

    const handleConvertIndex = async () => {
        setConfirmConvertIndex(false);
        try {
            setProcessingPDF(true);
            await ocrConvertIndex(true); // Assuming this parameter is correct
            toast.success(
                "✅ Der Index wurde erfolgreich in OCR Format umgewandelt."
            );
        } catch (error: any) {
            toast.error(
                `❌ Fehler beim Konvertieren des Indexes: ${error.message}`
            );
        } finally {
            setProcessingPDF(false);
        }
    };

    const handleGetFolder = () => {
        setShowFolderSelector(true);
    };

    const handleFolderSelect = (selectedFolderPath: string) => {
        if (selectedFolderPath && folderPath !== selectedFolderPath) {
            setFolderPath(selectedFolderPath);
        } else {
            toast.warn(
                selectedFolderPath
                    ? "⚠️ Eingabeordner schon vorhanden!"
                    : "⚠️ Kein Ordner ausgewählt."
            );
        }
        setShowFolderSelector(false);
    };

    return (
        <div className="ocr-processor">
            <h2>PDF-Verarbeitung</h2>
            <div className="ocr-processor__settings">
                <div className="ocr-processor__group">
                    <h3>Ordner-Einstellungen</h3>
                    <button onClick={() => setConfirmConvertFolder(true)}>
                        Ordner konvertieren
                    </button>
                    <div className="input-with-tooltip">
                        <input
                            type="text"
                            placeholder="Ordnerpfad"
                            value={folderPath}
                            readOnly
                            onClick={handleGetFolder}
                            className={
                                errorFields.includes("folderPath")
                                    ? "error-input"
                                    : ""
                            }
                        />
                        <div className="path-tooltip">{folderPath}</div>
                    </div>
                    <input
                        className={
                            errorFields.includes("outputOptions")
                                ? "error-input"
                                : ""
                        }
                        type="text"
                        placeholder="Unterordner"
                        value={outputSubdir}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setOutputSubdir(e.target.value);
                            setOutputPrefix("");
                            setOverwrite(false);
                        }}
                    />
                    <input
                        className={
                            errorFields.includes("outputOptions")
                                ? "error-input"
                                : ""
                        }
                        type="text"
                        placeholder="Präfix"
                        value={outputPrefix}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setOutputPrefix(e.target.value);
                            setOutputSubdir("");
                            setOverwrite(false);
                        }}
                    />
                    <label>
                        <input
                            className={
                                errorFields.includes("outputOptions")
                                    ? "error-input"
                                    : ""
                            }
                            type="checkbox"
                            checked={overwrite}
                            onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                            ) => {
                                setOverwrite(e.target.checked);
                                setOutputSubdir("");
                                setOutputPrefix("");
                            }}
                        />
                        Überschreiben
                    </label>
                    <input
                        type="text"
                        placeholder="Ignorierte Ordner (kommasepariert)"
                        value={ignoredDirNames}
                        onChange={(e) => setIgnoredDirNames(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Max. Arbeiter"
                        value={maxWorkers}
                        onChange={(e) =>
                            setMaxWorkers(parseInt(e.target.value, 10) || 0)
                        }
                    />
                </div>
                <div className="ocr-processor__group">
                    <h3>Index-Einstellungen</h3>
                    <button onClick={() => setConfirmConvertIndex(true)}>
                        Index konvertieren
                    </button>
                </div>
            </div>
            {(confirmConvertFolder || confirmConvertIndex) && (
                <ConfirmModal
                    title={
                        confirmConvertFolder
                            ? "Ordner konvertieren?"
                            : "Index konvertieren?"
                    }
                    message={
                        confirmConvertFolder
                            ? "Bist du sicher, dass du den Ordner konvertieren möchtest?"
                            : "Bist du sicher, dass du den Index konvertieren möchtest?"
                    }
                    isDanger={false}
                    onConfirm={
                        confirmConvertFolder
                            ? handleConvertFolder
                            : handleConvertIndex
                    }
                    onCancel={() => {
                        confirmConvertFolder
                            ? setConfirmConvertFolder(null)
                            : setConfirmConvertIndex(null);
                        toast.warn(
                            confirmConvertFolder
                                ? "⚠️ Die Konvertierung des Ordners abgebrochen"
                                : "⚠️ Die Konvertierung des Indexes abgebrochen"
                        );
                    }}
                />
            )}
            {showFolderSelector && (
                <FolderSelector
                    setPath={handleFolderSelect}
                    onCancel={() => setShowFolderSelector(false)}
                />
            )}
        </div>
    );
};

export default PDFProcessor;
