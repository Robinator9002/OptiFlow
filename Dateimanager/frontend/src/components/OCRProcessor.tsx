import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import { ConfirmModal } from './ConfirmModal.tsx';
import { ocrConvertFolder, ocrConvertIndex } from '../api/api.tsx';
import { FolderSelector } from './FolderSelector.tsx';
import { SettingsContext } from '../context/SettingsContext.tsx';

const PDFProcessor = ({ setProcessingPDF }) => {
    const { ocrSubfolder, ocrPrefix, ocrOverwrite, ocrExcludedDirs, ocrMaxWorkerCount } = useContext(SettingsContext);
    const [folderPath, setFolderPath] = useState('');
    const [outputSubdir, setOutputSubdir] = useState(ocrSubfolder);
    const [outputPrefix, setOutputPrefix] = useState(ocrPrefix);
    const [overwrite, setOverwrite] = useState(ocrOverwrite);
    const [ignoredDirNames, setIgnoredDirNames] = useState(ocrExcludedDirs); // Use OCR excluded dirs from settings
    const [maxWorkers, setMaxWorkers] = useState(ocrMaxWorkerCount);    // Use max workers from settings
    const [confirmConvertFolder, setConfirmConvertFolder] = useState(null);
    const [confirmConvertIndex, setConfirmConvertIndex] = useState(null);
    const [errorFields, setErrorFields] = useState([]);
    const [showFolderSelector, setShowFolderSelector] = useState(false);

    const validateForm = () => {
        setErrorFields([]);

        if (!folderPath) {
            toast.error('Ordnerpfad ist erforderlich.');
            setErrorFields(['folderPath']);
            return false;
        }
        if (!outputSubdir && !outputPrefix && !overwrite) {
            toast.error('Es muss mindestens ein Unterordner, Präfix oder Überschreiben ausgewählt sein.');
            setErrorFields(['outputSubdir', 'outputPrefix', 'overwrite']);
            return false;
        }
        if ([outputSubdir, outputPrefix, overwrite].filter(Boolean).length > 1) {
            toast.error('Nur eines von Unterordner, Präfix oder Überschreiben darf ausgewählt sein.');
            setErrorFields(['outputSubdir', 'outputPrefix', 'overwrite']);
            return false;
        }
        return true;
    };

    useEffect(() => {
        if (outputSubdir) {
            setOutputPrefix('');
            setOverwrite(false);
        } else if (outputPrefix) {
            setOutputSubdir('');
            setOverwrite(false);
        } else if (overwrite) {
            setOutputSubdir('');
            setOutputPrefix('');
        }
    }, [outputSubdir, outputPrefix, overwrite]);

    // Reset errorFields on input change
    useEffect(() => {
        setErrorFields([]);
    }, [folderPath, outputSubdir, outputPrefix, overwrite, ignoredDirNames, maxWorkers]);

    const handleConvertFolder = async () => {
        setConfirmConvertFolder(false);
        if (!validateForm()) {
            return;
        }
        try {
            setProcessingPDF(true);
            await ocrConvertFolder(
                folderPath,
                outputSubdir,
                outputPrefix,
                overwrite,
                ignoredDirNames,
                maxWorkers
            );
            toast.success("✅ Der Ordner wurde erfolgreich in OCR Format umgewandelt.");
        } catch (error) {
            toast.error(`❌ Fehler beim Konvertieren des Ordners: ${error.message}`);
        } finally {
            setProcessingPDF(false);
        }
    };

    const handleConvertIndex = async () => {
        setConfirmConvertIndex(false);
        try {
            setProcessingPDF(true);
            await ocrConvertIndex(true);
            toast.success("✅ Der Index wurde erfolgreich in OCR Format umgewandelt.");
        } catch (error) {
            toast.error(`❌ Fehler beim Konvertieren des Indexes: ${error.message}`);
        } finally {
            setProcessingPDF(false);
        }
    };

    const handleGetFolder = () => {
        setShowFolderSelector(true);
    };

    const handleFolderSelect = (selectedFolderPath) => {
        if (selectedFolderPath && folderPath !== selectedFolderPath) {
            setFolderPath(selectedFolderPath);
        } else {
            toast.warn(selectedFolderPath ? '⚠️ Eingabeordner schon vorhanden!' : '⚠️ Kein Ordner ausgewählt.');
        }
        setShowFolderSelector(false);
    };

    return (
        <div className="ocr-processor">
            <h2>PDF-Verarbeitung</h2>
            <div className="ocr-processor__settings">
                <div className="ocr-processor__group">
                    <h3>Ordner-Einstellungen</h3>
                    <button onClick={() => setConfirmConvertFolder(true)}>Ordner konvertieren</button>
                    <div className="input-with-tooltip"> {/* Wrapper für Input und Tooltip */}
                        <input
                            type="text"
                            placeholder="Ordnerpfad"
                            value={folderPath}
                            readOnly
                            onClick={handleGetFolder}
                            className={errorFields.includes('folderPath') ? 'error-input' : ''}
                        />
                        <div className="path-tooltip">{folderPath}</div>
                    </div>
                    <input
                        className={errorFields.includes('overwrite') ? 'error-input' : ''}
                        type="text"
                        placeholder="Unterordner"
                        value={outputSubdir}
                        onChange={(e) => {
                            setOutputSubdir(e.target.value);
                            setOutputPrefix(null);
                            setOverwrite(false);
                        }}
                    />
                    <input
                        className={errorFields.includes('overwrite') ? 'error-input' : ''}
                        type="text"
                        placeholder="Präfix"
                        value={outputPrefix}
                        onChange={(e) => {
                            setOutputPrefix(e.target.value);
                            setOutputSubdir(null);
                            setOverwrite(false);
                        }}
                    />
                    <label>
                        <input
                            className={errorFields.includes('overwrite') ? 'error-input' : ''}
                            type="checkbox"
                            checked={overwrite}
                            onChange={(e) => {
                                setOverwrite(e.target.checked);
                                setOutputSubdir(null);
                                setOutputPrefix(null);
                            }}
                        />
                        Überschreiben
                    </label>
                    <input
                        type="text"
                        placeholder="Ignorierte Ordner"
                        value={ignoredDirNames}
                        onChange={(e) => setIgnoredDirNames(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Max. Arbeiter"
                        value={maxWorkers}
                        onChange={(e) => setMaxWorkers(parseInt(e.target.value, 10))}
                    />
                </div>
                <div className="ocr-processor__group">
                    <h3>Index-Einstellungen</h3>
                    <button onClick={() => setConfirmConvertIndex(true)}>Index konvertieren</button>
                </div>
            </div>
            {(confirmConvertFolder || confirmConvertIndex) && (
                <ConfirmModal
                    title={confirmConvertFolder ? 'Ordner konvertieren?' : 'Index konvertieren?'}
                    message={confirmConvertFolder ? 'Bist du sicher das du den Ordner konvertieren möchtest?' : 'Bist du sicher das du den Index konvertieren möchtest?'}
                    isDanger={false}
                    onConfirm={confirmConvertFolder ? handleConvertFolder : handleConvertIndex}
                    onCancel={() => {
                        confirmConvertFolder ? setConfirmConvertFolder(null) : setConfirmConvertIndex(null);
                        toast.warn(confirmConvertFolder ? '⚠️ Die Konvertierung des Ordners abgebrochen' : '⚠️ Die Konvertierung des Indexes abgebrochen');
                    }}
                />
            )}
            {showFolderSelector && (
                <FolderSelector setPath={handleFolderSelect} onCancel={() => setShowFolderSelector(false)} />
            )}
        </div>
    );
};

export default PDFProcessor;
