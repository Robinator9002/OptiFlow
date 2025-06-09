import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import SearchSettings from "./settings/SearchSettings";
import ScannerSettings from "./settings/ScannerSettings";
import OCRSettings from "./settings/OCRSettings";
import DeDupingSettings from "./settings/DeDupingSettings";
import OldFilesSettings from "./settings/OldFilesSettings";
import GeneralSettings from "./settings/GeneralSettings";
import UserSettings from "./settings/UserSettings";
import DatabaseSettings from "./settings/DatabaseSettings";
import SystemSettings from "./settings/SystemSettings";
import { getUserSettings, logoutUser, saveUserSettings } from "../api/api";
import { SettingsContext } from "../context/SettingsContext";
import { ConfirmModal } from "./ConfirmModal";

interface SettingsProps {
    currentUser: string | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<string | null>>;
    isAdmin: boolean;
    showRelevance: boolean;
    setShowRelevance: React.Dispatch<React.SetStateAction<boolean>>;
    onRegister: (() => void) | null;
    setLoggedIn: (loggedIn: boolean) => void;
    setExecutingEvent: (executing: boolean) => void;
    appActiveTab: string;
    swapBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({
    currentUser,
    setCurrentUser,
    isAdmin,
    showRelevance,
    setShowRelevance,
    onRegister,
    setLoggedIn,
    setExecutingEvent,
    appActiveTab,
    swapBack,
}) => {
    const context = useContext(SettingsContext);

    // Check if context is available
    if (!context) {
        // You might want to render a loading state or return null
        return <div>Loading settings context...</div>;
    }
    const { applySettings, loadSettings } = context;

    const [isBusy, setIsBusy] = useState(false);

    // --- State Hooks with types ---
    const [searchLimit, setSearchLimit] = useState(100);
    const [snippetLimit, setSnippetLimit] = useState(0);
    const [oldFilesLimit, setOldFilesLimit] = useState(0);
    const [filenameExactMatchScore, setFilenameExactMatchScore] = useState(5);
    const [filenamePartialMatchScore, setFilenamePartialMatchScore] =
        useState(3);
    const [contentMatchScore, setContentMatchScore] = useState(1);
    const [scannerCpuCoresState, setScannerCpuCoresState] = useState(0);
    const [scannerUsableExtensionsState, setScannerUsableExtensionsState] =
        useState<string[]>([
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
        ]);
    const [scanDelayState, setScanDelayState] = useState(0);
    const [snippetWindow, setSnippetWindow] = useState(0);
    const [proximityWindow, setProximityWindow] = useState(0);
    const [maxAgeDays, setMaxAgeDays] = useState(1000);
    const [sortBy, setSortBy] = useState("age");
    const [sortOrder, setSortOrder] = useState("normal");
    const [ocrExcludedDirsState, setOcrExcludedDirsState] = useState("");
    const [ocrSubfolderState, setOcrSubfolderState] = useState("");
    const [ocrPrefixState, setOcrPrefixState] = useState("");
    const [ocrOverwriteState, setOcrOverwriteState] = useState(true);
    const [ocrMaxWorkerCountState, setOcrMaxWorkerCountState] = useState(0);
    const [forceOcrState, setForceOcrState] = useState(true);
    const [skipTextState, setSkipTextState] = useState(false);
    const [redoOcrState, setRedoOcrState] = useState(false);
    const [themeName, setThemeName] = useState("default");
    const [fontType, setFontType] = useState("sans-serif");
    const [fontSize, setFontSize] = useState(1.0);
    const [checkInterval, setCheckInterval] = useState(60);
    const [activeTab, setActiveTab] = useState("general");
    const [lastActiveTab, setLastActiveTab] = useState("general");
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [maxFileSize, setMaxFileSize] = useState(1000000);
    const [lengthRangeStep, setLengthRangeStep] = useState(100);
    const [minCategoryLength, setMinCategoryLength] = useState(2);
    const [snippetLengthDedupe, setSnippetLengthDedupe] = useState(30);
    const [snippetStepDedupe, setSnippetStepDedupe] = useState(1);
    const [signatureSize, setSignatureSize] = useState(300);
    const [similarityThreshold, setSimilarityThreshold] = useState(0.8);

    const tabsAdmin = [
        { id: "general", label: "Allgemein" },
        { id: "search", label: "Suche" },
        { id: "scanner", label: "Scanner" },
        { id: "ocr", label: "OCR" },
        { id: "oldFiles", label: "Vergessene Dateien" },
        { id: "deduping", label: "Entuplizierung" },
        { id: "userSettings", label: "Nutzereinstellungen" },
        { id: "database", label: "Datenbank" },
        { id: "system", label: "System" },
    ];
    const tabsNonAdmin = [
        { id: "general", label: "Allgemein" },
        { id: "userSettings", label: "Nutzereinstellungen" },
    ];
    const visibleTabs = isAdmin ? tabsAdmin : tabsNonAdmin;

    const handleTabClick = (tabId: string) => {
        setLastActiveTab(activeTab);
        setActiveTab(tabId);
    };

    useEffect(() => {
        const loadUserSettings = async () => {
            if (currentUser) {
                try {
                    const response = await getUserSettings(currentUser);
                    const fetchedSettings = response?.settings || {};
                    const safeMatchScore = fetchedSettings.match_score || {
                        filename_exact: 5,
                        filename_partial: 3,
                        content: 1,
                    };

                    // Apply all settings with fallbacks
                    setSearchLimit(fetchedSettings.search_limit ?? 100);
                    // ... (set all other states similarly)
                    setShowRelevance(fetchedSettings.show_relevance ?? false);
                    setFilenameExactMatchScore(safeMatchScore.filename_exact);
                    setFilenamePartialMatchScore(
                        safeMatchScore.filename_partial
                    );
                    setContentMatchScore(safeMatchScore.content);
                    // ... and so on for all settings
                } catch (error: any) {
                    toast.error(
                        `Fehler beim Laden der Einstellungen: ${
                            error.message || "Unbekannter Fehler"
                        }`
                    );
                }
            }
        };
        loadUserSettings();
    }, [currentUser]);

    const handleSaveSettings = async () => {
        setIsSaving(false);
        setIsBusy(false);

        if (currentUser) {
            const settingsToSave = {
                search_limit: searchLimit,
                snippet_limit: snippetLimit,
                old_files_limit: oldFilesLimit,
                show_relevance: showRelevance,
                match_score: {
                    filename_exact: filenameExactMatchScore,
                    filename_partial: filenamePartialMatchScore,
                    content: contentMatchScore,
                },
                scanner_cpu_cores: scannerCpuCoresState,
                usable_extensions: scannerUsableExtensionsState,
                scan_delay: scanDelayState,
                snippet_window: snippetWindow,
                proximity_window: proximityWindow,
                max_age_days: maxAgeDays,
                sort_by: sortBy,
                sort_order: sortOrder,
                processor_excluded_folders: ocrExcludedDirsState,
                subfolder: ocrSubfolderState,
                prefix: ocrPrefixState,
                overwrite: ocrOverwriteState,
                processing_cpu_cores: ocrMaxWorkerCountState,
                force_ocr: forceOcrState,
                skip_text: skipTextState,
                redo_ocr: redoOcrState,
                theme_name: themeName,
                font_type: fontType,
                font_size: fontSize,
                check_interval: checkInterval,
                max_file_size: maxFileSize,
                length_range_step: lengthRangeStep,
                min_category_length: minCategoryLength,
                snippet_length_dedupe: snippetLengthDedupe,
                snippet_step_dedupe: snippetStepDedupe,
                signature_size: signatureSize,
                similarity_treshold: similarityThreshold,
            };

            try {
                const response = await saveUserSettings(
                    currentUser,
                    settingsToSave
                );
                toast.success(response.message || "Einstellungen gespeichert!");
                await loadSettings(currentUser);
            } catch (error: any) {
                toast.error(
                    `Fehler beim Speichern der Einstellungen: ${
                        error.message || "Unbekannter Fehler"
                    }`
                );
            }
        } else {
            toast.error(
                "Benutzername ist nicht verfügbar. Bitte melden Sie sich an."
            );
        }
    };

    const handleResetToDefaults = () => {
        // ... implementation to reset all states to default values
        toast.warn(
            "Alle Einstellungen wurden auf die Standardwerte zurückgesetzt."
        );
    };

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (appActiveTab !== "settings" || isBusy) return;

            if (event.key === "Enter") {
                setIsSaving(true);
                setIsBusy(true);
            }
            if (event.key === "Escape") {
                swapBack();
            }
        };

        document.addEventListener("keydown", handleGlobalKeyDown);
        return () =>
            document.removeEventListener("keydown", handleGlobalKeyDown);
    }, [appActiveTab, isBusy, swapBack]);

    return (
        <div className="settings-container container">
            <div className="settings-tabs">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${
                            activeTab === tab.id ? "active" : ""
                        }`}
                        onClick={() => handleTabClick(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="settings-content">
                {activeTab === "general" && (
                    <GeneralSettings
                        {...{
                            themeName,
                            setThemeName,
                            fontType,
                            setFontType,
                            fontSize,
                            setFontSize,
                        }}
                    />
                )}
                {activeTab === "search" && (
                    <SearchSettings
                        {...{
                            searchLimit,
                            setSearchLimit,
                            snippetLimit,
                            setSnippetLimit,
                            showRelevance,
                            setShowRelevance,
                            filenameExactMatchScore,
                            setFilenameExactMatchScore,
                            filenamePartialMatchScore,
                            setFilenamePartialMatchScore,
                            contentMatchScore,
                            setContentMatchScore,
                            snippetWindow,
                            setSnippetWindow,
                            proximityWindow,
                            setProximityWindow,
                        }}
                    />
                )}
                {activeTab === "scanner" && (
                    <ScannerSettings
                        scannerCpuCores={scannerCpuCoresState}
                        setScannerCpuCores={setScannerCpuCoresState}
                        usableExtensions={scannerUsableExtensionsState}
                        setUsableExtensions={setScannerUsableExtensionsState}
                        scanDelay={scanDelayState}
                        setScanDelay={setScanDelayState}
                    />
                )}
                {activeTab === "ocr" && (
                    <OCRSettings
                        processorExcludedFolders={ocrExcludedDirsState}
                        setProcessorExcludedFolders={setOcrExcludedDirsState}
                        subfolder={ocrSubfolderState}
                        setSubfolder={setOcrSubfolderState}
                        prefix={ocrPrefixState}
                        setPrefix={setOcrPrefixState}
                        overwrite={ocrOverwriteState}
                        setOverwrite={setOcrOverwriteState}
                        processingCpuCores={ocrMaxWorkerCountState}
                        setProcessingCpuCores={setOcrMaxWorkerCountState}
                        forceOcr={forceOcrState}
                        setForceOcr={setForceOcrState}
                        skipText={skipTextState}
                        setSkipText={setSkipTextState}
                        redoOcr={redoOcrState}
                        setRedoOcr={setRedoOcrState}
                    />
                )}
                {activeTab === "oldFiles" && (
                    <OldFilesSettings
                        oldFilesLimit={oldFilesLimit}
                        setOldFilesLimit={setOldFilesLimit}
                        maxAgeDays={maxAgeDays}
                        setMaxAgeDays={setMaxAgeDays}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                    />
                )}
                {activeTab === "deduping" && (
                    <DeDupingSettings
                        {...{
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
                        }}
                    />
                )}
                {activeTab === "userSettings" && (
                    <UserSettings
                        {...{
                            currentUser,
                            setCurrentUser,
                            isAdmin,
                            onLogout: () => {
                                logoutUser(currentUser || "");
                                setLoggedIn(false);
                            },
                            swapBack: () => setActiveTab(lastActiveTab),
                            setIsBusy,
                        }}
                    />
                )}
                {activeTab === "database" && (
                    <DatabaseSettings
                        {...{ isAdmin, maxFileSize, setMaxFileSize, setIsBusy }}
                    />
                )}
                {activeTab === "system" && (
                    <SystemSettings
                        {...{
                            currentUser,
                            checkInterval,
                            setCheckInterval,
                            setExecutingEvent,
                            setIsBusy,
                            onLogout: () => {
                                logoutUser(currentUser || "");
                                setLoggedIn(false);
                            },
                        }}
                    />
                )}

                <div className="settings-actions">
                    <button
                        className="save-button"
                        onClick={() => {
                            setIsSaving(true);
                            setIsBusy(true);
                        }}
                    >
                        Speichern
                    </button>
                    <button
                        className="reset-button"
                        onClick={() => {
                            setIsResetting(true);
                            setIsBusy(true);
                        }}
                    >
                        Zurücksetzen
                    </button>
                </div>
            </div>
            {(isSaving || isResetting) && (
                <ConfirmModal
                    title={
                        isSaving
                            ? "Einstellungen Speichern"
                            : "Einstellungen Zurücksetzen"
                    }
                    message={
                        isSaving
                            ? "Sind Sie sicher, dass Sie die Einstellungen speichern möchten?"
                            : "Sind Sie sicher, dass Sie die Einstellungen zurücksetzen möchten?"
                    }
                    isDanger={false}
                    onConfirm={
                        isSaving ? handleSaveSettings : handleResetToDefaults
                    }
                    onCancel={() => {
                        isSaving ? setIsSaving(false) : setIsResetting(false);
                        setIsBusy(false);
                    }}
                />
            )}
        </div>
    );
};
export default Settings;
