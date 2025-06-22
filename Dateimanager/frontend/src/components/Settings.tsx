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
import {
    logoutUser,
    saveUserSettings,
    type Settings as ApiSettings,
} from "../api/api";
import { SettingsContext } from "../context/SettingsContext";
import { ConfirmModal } from "./modals/ConfirmModal";

interface SettingsProps {
    currentUser: string | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<string | null>>;
    isAdmin: boolean;
    setLoggedIn: (loggedIn: boolean) => void;
    setExecutingEvent: React.Dispatch<React.SetStateAction<boolean>>;
    appActiveTab: string;
    swapBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({
    currentUser,
    setCurrentUser,
    isAdmin,
    setLoggedIn,
    setExecutingEvent,
    appActiveTab,
    swapBack,
}) => {
    const context = useContext(SettingsContext);

    if (!context) {
        return <div>Loading settings context...</div>;
    }

    // Hole alle benötigten Werte, Setter UND die Defaults aus dem Context
    const {
        loadSettings,
        settings,
        defaultSettings,
        // Suche
        showRelevance, setShowRelevance,
        // Scanner
        scannerUsableExtensions, setScannerUsableExtensions,
        scannerIgnoredDirs, setScannerIgnoredDirs,
        // OCR
        ocrExcludedDirs, setOcrExcludedDirs,
        ocrSubfolder, setOcrSubfolder,
        ocrPrefix, setOcrPrefix,
        ocrOverwrite, setOcrOverwrite,
        ocrMaxWorkerCount, setOcrMaxWorkerCount,
        forceOcr, setForceOcr,
        skipText, setSkipText,
        redoOcr, setRedoOcr,
        ocrLanguage, setOcrLanguage,
        ocrImageDpi, setOcrImageDpi,
        ocrOptimizeLevel, setOcrOptimizeLevel,
        ocrCleanImages, setOcrCleanImages,
        ocrTesseractConfig, setOcrTesseractConfig,
        // Old Files
        maxAgeDays, setMaxAgeDays,
        // DeDuping
        minCategoryLength, setMinCategoryLength,
    } = context;

    const [isBusy, setIsBusy] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // KORREKTUR: Initialisiere die lokalen States mit einem Fallback auf die defaultSettings.
    // Dies garantiert, dass der Typ korrekt ist (z.B. `number` anstatt `number | undefined`).
    const [searchLimit, setSearchLimit] = useState(settings.search_limit ?? defaultSettings.search_limit!);
    const [snippetLimit, setSnippetLimit] = useState(settings.snippet_limit ?? defaultSettings.snippet_limit!);
    const [oldFilesLimit, setOldFilesLimit] = useState(settings.old_files_limit ?? defaultSettings.old_files_limit!);
    const [filenameExactMatchScore, setFilenameExactMatchScore] = useState(settings.match_score?.filename_exact ?? defaultSettings.match_score!.filename_exact!);
    const [filenamePartialMatchScore, setFilenamePartialMatchScore] = useState(settings.match_score?.filename_partial ?? defaultSettings.match_score!.filename_partial!);
    const [contentMatchScore, setContentMatchScore] = useState(settings.match_score?.content ?? defaultSettings.match_score!.content!);
    const [scannerCpuCoresState, setScannerCpuCoresState] = useState<number | null>(settings.scanner_cpu_cores ?? defaultSettings.scanner_cpu_cores!);
    const [scanDelayState, setScanDelayState] = useState<number>(settings.scan_delay ?? defaultSettings.scan_delay!);
    const [snippetWindow, setSnippetWindow] = useState(settings.snippet_window ?? defaultSettings.snippet_window!);
    const [proximityWindow, setProximityWindow] = useState(settings.proximity_window ?? defaultSettings.proximity_window!);
    const [sortBy, setSortBy] = useState(settings.sort_by ?? defaultSettings.sort_by!);
    const [sortOrder, setSortOrder] = useState(settings.sort_order ?? defaultSettings.sort_order!);
    const [themeName, setThemeName] = useState(settings.theme_name ?? defaultSettings.theme_name!);
    const [fontSize, setFontSize] = useState(settings.font_size ?? defaultSettings.font_size!);
    const [checkInterval, setCheckInterval] = useState(settings.check_interval ?? defaultSettings.check_interval!);
    const [maxFileSize, setMaxFileSize] = useState(settings.max_file_size ?? defaultSettings.max_file_size!);
    const [lengthRangeStep, setLengthRangeStep] = useState(settings.length_range_step ?? defaultSettings.length_range_step!);
    const [snippetLengthDedupe, setSnippetLengthDedupe] = useState(settings.snippet_length ?? defaultSettings.snippet_length!);
    const [snippetStepDedupe, setSnippetStepDedupe] = useState(settings.snippet_step ?? defaultSettings.snippet_step!);
    const [signatureSize, setSignatureSize] = useState(settings.signature_size ?? defaultSettings.signature_size!);
    const [similarityThreshold, setSimilarityThreshold] = useState(settings.similarity_threshold ?? defaultSettings.similarity_threshold!);

    const [activeTab, setActiveTab] = useState("general");
    const [lastActiveTab, setLastActiveTab] = useState("general");

    // KORREKTUR: Auch der useEffect muss die Fallbacks verwenden, um die Typ-Sicherheit zu gewährleisten.
    useEffect(() => {
        setSearchLimit(settings.search_limit ?? defaultSettings.search_limit!);
        setSnippetLimit(settings.snippet_limit ?? defaultSettings.snippet_limit!);
        setOldFilesLimit(settings.old_files_limit ?? defaultSettings.old_files_limit!);
        setFilenameExactMatchScore(settings.match_score?.filename_exact ?? defaultSettings.match_score!.filename_exact!);
        setFilenamePartialMatchScore(settings.match_score?.filename_partial ?? defaultSettings.match_score!.filename_partial!);
        setContentMatchScore(settings.match_score?.content ?? defaultSettings.match_score!.content!);
        setScannerCpuCoresState(settings.scanner_cpu_cores ?? defaultSettings.scanner_cpu_cores!);
        setScanDelayState(settings.scan_delay ?? defaultSettings.scan_delay!);
        setSnippetWindow(settings.snippet_window ?? defaultSettings.snippet_window!);
        setProximityWindow(settings.proximity_window ?? defaultSettings.proximity_window!);
        setSortBy(settings.sort_by ?? defaultSettings.sort_by!);
        setSortOrder(settings.sort_order ?? defaultSettings.sort_order!);
        setThemeName(settings.theme_name ?? defaultSettings.theme_name!);
        setFontSize(settings.font_size ?? defaultSettings.font_size!);
        setCheckInterval(settings.check_interval ?? defaultSettings.check_interval!);
        setMaxFileSize(settings.max_file_size ?? defaultSettings.max_file_size!);
        setLengthRangeStep(settings.length_range_step ?? defaultSettings.length_range_step!);
        setSnippetLengthDedupe(settings.snippet_length ?? defaultSettings.snippet_length!);
        setSnippetStepDedupe(settings.snippet_step ?? defaultSettings.snippet_step!);
        setSignatureSize(settings.signature_size ?? defaultSettings.signature_size!);
        setSimilarityThreshold(settings.similarity_threshold ?? defaultSettings.similarity_threshold!);
    }, [settings, defaultSettings]);


    const tabsAdmin = [
        { id: "general", label: "Allgemein" },
        { id: "search", label: "Suche" },
        { id: "scanner", label: "Scanner" },
        { id: "ocr", label: "OCR" },
        { id: "oldFiles", label: "Alte Dateien" },
        { id: "deduping", label: "Entduplizierung" },
        { id: "userSettings", label: "Benutzer" },
        { id: "database", label: "Datenbank" },
        { id: "system", label: "System" },
    ];
    const tabsNonAdmin = [
        { id: "general", label: "Allgemein" },
        { id: "userSettings", label: "Benutzer" },
    ];
    const visibleTabs = isAdmin ? tabsAdmin : tabsNonAdmin;

    const handleTabClick = (tabId: string) => {
        setLastActiveTab(activeTab);
        setActiveTab(tabId);
    };

    const handleSaveSettings = async () => {
        if (currentUser) {
            const settingsToSave: ApiSettings = {
                search_limit: searchLimit,
                snippet_limit: snippetLimit,
                old_files_limit: oldFilesLimit,
                show_relevance: showRelevance,
                match_score: {
                    filename_exact: filenameExactMatchScore,
                    filename_partial: filenamePartialMatchScore,
                    content: contentMatchScore,
                },
                scanner_cpu_cores: scannerCpuCoresState ?? undefined,
                usable_extensions: scannerUsableExtensions,
                ignored_dirs: scannerIgnoredDirs,
                scan_delay: scanDelayState,
                snippet_window: snippetWindow,
                proximity_window: proximityWindow,
                max_age_days: maxAgeDays,
                sort_by: sortBy,
                sort_order: sortOrder,
                processor_excluded_folders: ocrExcludedDirs,
                subfolder: ocrSubfolder,
                prefix: ocrPrefix,
                overwrite: ocrOverwrite,
                ocr_processing: {
                    ocr_force: forceOcr,
                    ocr_skip_text_layer: skipText,
                    ocr_redo_text_layer: redoOcr,
                    ocr_language: ocrLanguage,
                    ocr_image_dpi: ocrImageDpi,
                    ocr_optimize_level: ocrOptimizeLevel,
                    ocr_clean_images: ocrCleanImages,
                    ocr_tesseract_config: ocrTesseractConfig,
                },
                theme_name: themeName,
                font_size: fontSize,
                check_interval: checkInterval,
                max_file_size: maxFileSize,
                length_range_step: lengthRangeStep,
                min_category_length: minCategoryLength,
                snippet_length: snippetLengthDedupe,
                snippet_step: snippetStepDedupe,
                signature_size: signatureSize,
                similarity_threshold: similarityThreshold,
            };

            try {
                setIsSaving(true);
                setIsBusy(true);
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
            } finally {
                setIsSaving(false);
                setIsBusy(false);
            }
        } else {
            toast.error(
                "Benutzername ist nicht verfügbar. Bitte melden Sie sich an."
            );
            setIsSaving(false);
            setIsBusy(false);
        }
    };

    const handleResetToDefaults = () => {
        if(currentUser) {
            context.applySettings(defaultSettings);
            toast.warn(
                "Alle Einstellungen auf die Standardwerte zurückgesetzt. Drücken Sie 'Speichern', um die Änderung zu übernehmen."
            );
        }
        setIsResetting(false);
        setIsBusy(false);
    };

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            const isModalActive = document.querySelector(
                ".modal-overlay, .event-form-overlay, .user-confirmation-overlay"
            );
            if (isModalActive) {
                return;
            }

            if (appActiveTab !== "settings" || isBusy) return;

            if (event.key === "Enter") {
                handleSaveSettings();
            }
            if (event.key === "Escape") {
                swapBack();
            }
        };

        document.addEventListener("keydown", handleGlobalKeyDown);
        return () =>
            document.removeEventListener("keydown", handleGlobalKeyDown);
    }, [appActiveTab, isBusy, swapBack, handleSaveSettings]);

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
                        {...{ themeName, setThemeName, fontSize, setFontSize }}
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
                        usableExtensions={scannerUsableExtensions}
                        setUsableExtensions={setScannerUsableExtensions}
                        scanDelay={scanDelayState}
                        setScanDelay={setScanDelayState}
                        ignoredDirs={scannerIgnoredDirs}
                        setIgnoredDirs={setScannerIgnoredDirs}
                    />
                )}
                {activeTab === "ocr" && (
                    <OCRSettings
                        processorExcludedFolders={ocrExcludedDirs}
                        setProcessorExcludedFolders={setOcrExcludedDirs}
                        subfolder={ocrSubfolder}
                        setSubfolder={setOcrSubfolder}
                        prefix={ocrPrefix}
                        setPrefix={setOcrPrefix}
                        overwrite={ocrOverwrite}
                        setOverwrite={setOcrOverwrite}
                        processingCpuCores={ocrMaxWorkerCount}
                        setProcessingCpuCores={setOcrMaxWorkerCount}
                        forceOcr={forceOcr}
                        setForceOcr={setForceOcr}
                        skipText={skipText}
                        setSkipText={setSkipText}
                        redoOcr={redoOcr}
                        setRedoOcr={setRedoOcr}
                        ocrLanguage={ocrLanguage}
                        setOcrLanguage={setOcrLanguage}
                        ocrImageDpi={ocrImageDpi}
                        setOcrImageDpi={setOcrImageDpi}
                        ocrOptimizeLevel={ocrOptimizeLevel}
                        setOcrOptimizeLevel={setOcrOptimizeLevel}
                        ocrCleanImages={ocrCleanImages}
                        setOcrCleanImages={setOcrCleanImages}
                        ocrTesseractConfig={ocrTesseractConfig}
                        setOcrTesseractConfig={setOcrTesseractConfig}
                    />
                )}
                {activeTab === "oldFiles" && (
                    <OldFilesSettings
                        {...{
                            oldFilesLimit,
                            setOldFilesLimit,
                            maxAgeDays,
                            setMaxAgeDays,
                            sortBy,
                            setSortBy,
                            sortOrder,
                            setSortOrder,
                        }}
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
                {activeTab === "userSettings" && currentUser && (
                    <UserSettings
                        currentUser={currentUser}
                        setCurrentUser={
                            setCurrentUser as React.Dispatch<
                                React.SetStateAction<string>
                            >
                        }
                        isAdmin={isAdmin}
                        onLogout={() => {
                            if (currentUser) logoutUser(currentUser);
                            setLoggedIn(false);
                        }}
                        swapBack={() => setActiveTab(lastActiveTab)}
                        setIsBusy={setIsBusy}
                    />
                )}
                {activeTab === "database" && (
                    <DatabaseSettings
                        {...{ isAdmin, maxFileSize, setMaxFileSize, setIsBusy }}
                    />
                )}
                {activeTab === "system" && currentUser && (
                    <SystemSettings
                        currentUser={currentUser}
                        checkInterval={checkInterval}
                        setCheckInterval={setCheckInterval}
                        setExecutingEvent={setExecutingEvent}
                        setIsBusy={setIsBusy}
                        onLogout={() => {
                            if (currentUser) logoutUser(currentUser);
                            setLoggedIn(false);
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
                            : "Sind Sie sicher, dass Sie die Einstellungen zurücksetzen möchten? (Dies ist keine permanente Aktion, Sie müssen danach noch 'Speichern' klicken)"
                    }
                    isDanger={isResetting}
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
