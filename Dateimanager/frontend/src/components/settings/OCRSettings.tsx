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
}: OCRSettingsProps) {
  const [excludedFoldersInput, setExcludedFoldersInput] = useState<string>(
    processorExcludedFolders
  );

  useEffect(() => {
    setExcludedFoldersInput(processorExcludedFolders);
  }, [processorExcludedFolders]);

  useEffect(() => {
    const trimmedInput = excludedFoldersInput.trim();
    setProcessorExcludedFolders(trimmedInput);
  }, [excludedFoldersInput, setProcessorExcludedFolders]);

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

  const handleCpuCoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setProcessingCpuCores(isNaN(value) ? null : value);
  };

  const handleOutputSubdirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubfolder(e.target.value);
    setPrefix("");
    setOverwrite(false);
  };

  const handleOutputPrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrefix(e.target.value);
    setSubfolder("");
    setOverwrite(false);
  };

  const handleOverwriteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCheckboxChange(setOverwrite, e);
    setSubfolder("");
    setPrefix("");
  };

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
        <h3>Prozessor-Einstellungen (werden im OCR-Tab voreingestellt)</h3>
        <div className="form-group">
          <label className="settings-input-group">
            Ausgeschlossene Ordner:
            <input
              type="text"
              value={excludedFoldersInput}
              onChange={(e) => handleTextChange(setExcludedFoldersInput, e)}
              placeholder="z.B. .venv, .tools, windows"
              className="excluded-folders-input"
            />
            <p className="setting-description">
              Geben Sie die Ordner, die vom Scan ausgeschlossen werden sollen,
              durch Kommas getrennt ein.
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
            value={processingCpuCores ?? ""}
            onChange={handleCpuCoreChange}
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
          <p className="setting-description">
            OCR standardmäßig erzwingen (auch wenn Text vermutet wird)
          </p>
        </label>
        <label className="ocr-settings-input-label">
          <input
            type="checkbox"
            checked={skipText}
            onChange={handleSkipTextChange}
          />
          <p className="setting-description">
            Seiten mit Text standardmäßig überspringen
          </p>
        </label>
        <label className="ocr-settings-input-label">
          <input
            type="checkbox"
            checked={redoOcr}
            onChange={handleRedoOcrChange}
          />
          <p className="setting-description">
            OCR standardmäßig erneut durchführen (auch wenn bereits vorhanden)
          </p>
        </label>
      </div>
    </div>
  );
}
