import React, { useState, useEffect, useContext, useCallback } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "../modals/ConfirmModal";
import { updateScannerConfig, type ScannerConfigs } from "../../api/api";
import { FolderSelector } from "../modals/FolderSelector";
import { SettingsContext } from "../../context/SettingsContext";

// --- FIX: The local interface is no longer needed. We import it from api.tsx. ---
// interface ScannerConfigData { ... }

// Define the props for the ScannerConfig component
interface ScannerConfigProps {
    // Use the imported ScannerConfig type
    configs: ScannerConfigs | null;
    setConfigs: (configs: ScannerConfigs) => void;
}

// Define the structure for an extension option in the dropdown
interface ExtensionOption {
    label: string;
    value: string[] | null;
}

const ALL_EXTENSIONS = [
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".html",
    ".css",
    ".js",
    ".py",
    ".pdf",
    ".docx",
];

const EXTENSION_OPTIONS: ExtensionOption[] = [
    { label: "Alle", value: ALL_EXTENSIONS },
    {
        label: "Textformate (.txt, .md, .csv, .json, .xml)",
        value: [".txt", ".md", ".csv", ".json", ".xml"],
    },
    {
        label: "Web & Styles (.html, .css, .js)",
        value: [".html", ".css", ".js"],
    },
    { label: "Skripte & Code (.py, .js)", value: [".py", ".js"] },
    { label: "Dokumente (.pdf, .docx)", value: [".pdf", ".docx"] },
    { label: "Eigene", value: null },
];

const ScannerConfig: React.FC<ScannerConfigProps> = ({
    configs,
    setConfigs,
}) => {
    const [baseDirs, setBaseDirs] = useState<string[]>([]);
    const [extensions, setExtensions] = useState<string[]>([]);
    const [indexContent, setIndexContent] = useState<boolean>(false);
    const [convertPDF, setConvertPDF] = useState<boolean>(false);
    const [maxSizeKb, setMaxSizeKb] = useState<string>("");
    const [maxContentSizeLet, setMaxContentSizeLet] = useState<string>("");
    const [selectedOption, setSelectedOption] = useState<string>("Eigene");
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [showFolderSelector, setShowFolderSelector] =
        useState<boolean>(false);

    const settings = useContext(SettingsContext);
    const scannerUsableExtensions = settings?.scannerUsableExtensions;

    const [filteredExtensions, setFilteredExtensions] =
        useState<string[]>(ALL_EXTENSIONS);

    useEffect(() => {
        if (scannerUsableExtensions && Array.isArray(scannerUsableExtensions)) {
            setFilteredExtensions(
                ALL_EXTENSIONS.filter((ext) =>
                    scannerUsableExtensions.includes(ext)
                )
            );
        } else {
            setFilteredExtensions(ALL_EXTENSIONS);
        }
    }, [scannerUsableExtensions]);

    const filteredExtensionOptions = EXTENSION_OPTIONS.map((option) => ({
        ...option,
        value: option.value
            ? option.value.filter((ext) => filteredExtensions.includes(ext))
            : null,
    })).filter(
        (option) =>
            option.value === null ||
            (option.value && option.value.length > 0) ||
            option.label === "Eigene"
    );

    const resetConfigs = useCallback(() => {
        if (configs) {
            setBaseDirs(configs.base_dirs || []);
            setExtensions(
                (configs.extensions || []).filter((ext) =>
                    filteredExtensions.includes(ext)
                )
            );
            setIndexContent(configs.index_content || false);
            setConvertPDF(configs.convert_pdf || false);
            setMaxSizeKb(configs.max_size_kb?.toString() || "");
            setMaxContentSizeLet(
                configs.max_content_size_let?.toString() || ""
            );
        }
    }, [configs, filteredExtensions]);

    useEffect(() => {
        resetConfigs();
    }, [resetConfigs]);

    const handleUpdate = async () => {
        setShowConfirmModal(false);
        try {
            // --- FIX START ---
            // Create an object that conforms to the imported ScannerConfig interface.
            // Use `undefined` for empty values as the interface expects optional fields.
            const newConfig: ScannerConfigs = {
                base_dirs: baseDirs.length > 0 ? baseDirs : [],
                extensions: extensions.length > 0 ? extensions : [],
                index_content: indexContent,
                convert_pdf: convertPDF,
                max_size_kb: maxSizeKb ? parseInt(maxSizeKb, 10) : undefined,
                max_content_size_let: maxContentSizeLet
                    ? parseInt(maxContentSizeLet, 10)
                    : undefined,
            };
            // --- FIX END ---

            const data = await updateScannerConfig(newConfig);
            setConfigs(data.configs);
            toast.success("✅ Konfiguration erfolgreich aktualisiert!");
        } catch (error) {
            toast.error("❌ Fehler beim Speichern der Konfiguration!");
        }
    };

    const handleGetFolder = () => {
        setShowFolderSelector(true);
    };

    const handleFolderSelect = (folderPath: string) => {
        if (folderPath && !baseDirs.includes(folderPath)) {
            setBaseDirs((prevDirs) => [...prevDirs, folderPath]);
        } else {
            toast.warn(
                folderPath
                    ? "⚠️ Ordner schon vorhanden!"
                    : "⚠️ Kein Ordner ausgewählt."
            );
        }
        setShowFolderSelector(false);
    };

    const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedLabel = e.target.value;
        setSelectedOption(selectedLabel);

        const selectedConfig = filteredExtensionOptions.find(
            (option) => option.label === selectedLabel
        );
        if (selectedConfig && selectedConfig.value) {
            setExtensions(selectedConfig.value);
        } else if (selectedConfig) {
            setExtensions([]);
        }
    };

    const handleCheckboxChange = (ext: string) => {
        const newExtensions = extensions.includes(ext)
            ? extensions.filter((e) => e !== ext)
            : [...extensions, ext];

        setExtensions(newExtensions);

        const matchedOption = filteredExtensionOptions.find(
            (option) =>
                option.value &&
                option.value.length === newExtensions.length &&
                option.value.every((e) => newExtensions.includes(e)) &&
                newExtensions.every((e) => option.value!.includes(e))
        );
        setSelectedOption(matchedOption ? matchedOption.label : "Eigene");
    };

    const removeBaseDir = (dirToRemove: string) => {
        setBaseDirs(baseDirs.filter((d) => d !== dirToRemove));
    };

    return (
        <div className="container scanner-config-container">
            <label>
                <h2>Zielordner:</h2>
                <div className="base-dir-list">
                    {baseDirs.map((dir, index) => (
                        <div
                            key={index}
                            className="base-dir-item input-with-tooltip"
                        >
                            <input type="text" value={dir} readOnly />
                            <button
                                className="remove-button"
                                onClick={() => removeBaseDir(dir)}
                            >
                                Entfernen
                            </button>
                            <div className="path-tooltip">{dir}</div>
                        </div>
                    ))}
                    <button onClick={handleGetFolder}>Neuer Ordner</button>
                </div>
            </label>

            <div className="scanner-configs">
                <h2>Scanner-Konfiguration</h2>
                <label>
                    Dateierweiterungen:
                    <select
                        value={selectedOption}
                        onChange={handleDropdownChange}
                    >
                        {filteredExtensionOptions.map((option, index) => (
                            <option key={index} value={option.label}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="checkbox-group">
                    {filteredExtensions.map((ext) => (
                        <label
                            key={ext}
                            style={{
                                display: "block",
                                color: extensions.includes(ext)
                                    ? "black"
                                    : "gray",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={extensions.includes(ext)}
                                onChange={() => handleCheckboxChange(ext)}
                            />
                            {ext}
                        </label>
                    ))}
                </div>
                <div className="checkbox-container">
                    <label>
                        Inhalt Indexieren:
                        <input
                            type="checkbox"
                            checked={indexContent}
                            onChange={(e) => setIndexContent(e.target.checked)}
                        />
                    </label>
                    <label>
                        PDF Konversion:
                        <input
                            type="checkbox"
                            checked={convertPDF}
                            onChange={(e) => setConvertPDF(e.target.checked)}
                        />
                    </label>
                </div>
                <label>
                    Maximale Dateigröße (Kilobyte):
                    <input
                        type="number"
                        value={maxSizeKb}
                        onChange={(e) => setMaxSizeKb(e.target.value)}
                        placeholder="Unbegrenzt (Leer)"
                    />
                </label>
                <label>
                    Maximale Inhaltsgröße per Datei (Zeichen):
                    <input
                        type="number"
                        value={maxContentSizeLet}
                        onChange={(e) => setMaxContentSizeLet(e.target.value)}
                        placeholder="Unbegrenzt (Leer)"
                    />
                </label>
            </div>
            <button
                onClick={() => setShowConfirmModal(true)}
                className="update-button"
            >
                Konfiguration speichern
            </button>
            {showConfirmModal && (
                <ConfirmModal
                    title="Konfigurieren bestätigen"
                    message="Möchtest du die Konfiguration speichern?"
                    isDanger={false}
                    onConfirm={handleUpdate}
                    onCancel={() => {
                        setShowConfirmModal(false);
                        toast.warn("⚠️ Konfiguration nicht Aktualisiert");
                        resetConfigs();
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

export default ScannerConfig;
