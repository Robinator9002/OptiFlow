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
    showRelevance: boolean;
    setShowRelevance: React.Dispatch<React.SetStateAction<boolean>>;
    setLoggedIn: (loggedIn: boolean) => void;
    setExecutingEvent: React.Dispatch<React.SetStateAction<boolean>>;
    appActiveTab: string;
    swapBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({
    currentUser,
    setCurrentUser,
    isAdmin,
    showRelevance,
    setShowRelevance,
    setLoggedIn,
    setExecutingEvent,
    appActiveTab,
    swapBack,
}) => {
    const context = useContext(SettingsContext);

    if (!context) {
        return <div>Loading settings context...</div>;
    }

    const {
        loadSettings,
        settings,
        scannerUsableExtensions,
        setScannerUsableExtensions,
        ocrExcludedDirs,
        setOcrExcludedDirs,
        ocrSubfolder,
        setOcrSubfolder,
        ocrPrefix,
        setOcrPrefix,
        ocrOverwrite,
        setOcrOverwrite,
        ocrMaxWorkerCount,
        setOcrMaxWorkerCount,
        maxAgeDays,
        setMaxAgeDays,
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
        minCategoryLength,
        setMinCategoryLength,
    } = context;

    const [isBusy, setIsBusy] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [searchLimit, setSearchLimit] = useState(
        settings.search_limit ?? 100
    );
    const [snippetLimit, setSnippetLimit] = useState(
        settings.snippet_limit ?? 0
    );
    const [oldFilesLimit, setOldFilesLimit] = useState(
        settings.old_files_limit ?? 0
    );
    const [filenameExactMatchScore, setFilenameExactMatchScore] = useState(
        settings.match_score?.filename_exact ?? 5
    );
    const [filenamePartialMatchScore, setFilenamePartialMatchScore] = useState(
        settings.match_score?.filename_partial ?? 3
    );
    const [contentMatchScore, setContentMatchScore] = useState(
        settings.match_score?.content ?? 1
    );
    const [scannerCpuCoresState, setScannerCpuCoresState] = useState<
        number | null
    >(settings.scanner_cpu_cores ?? 0);
    const [scanDelayState, setScanDelayState] = useState<number>(
        settings.scan_delay ?? 0
    );
    const [snippetWindow, setSnippetWindow] = useState(
        settings.snippet_window ?? 0
    );
    const [proximityWindow, setProximityWindow] = useState(
        settings.proximity_window ?? 0
    );
    const [sortBy, setSortBy] = useState(settings.sort_by ?? "age");
    const [sortOrder, setSortOrder] = useState(settings.sort_order ?? "normal");
    const [themeName, setThemeName] = useState(
        settings.theme_name ?? "default"
    );
    const [fontSize, setFontSize] = useState(settings.font_size ?? 1.0);
    const [checkInterval, setCheckInterval] = useState(
        settings.check_interval ?? 60
    );
    const [maxFileSize, setMaxFileSize] = useState(
        settings.max_file_size ?? 1000000
    );
    const [lengthRangeStep, setLengthRangeStep] = useState(
        settings.length_range_step ?? 100
    );
    const [snippetLengthDedupe, setSnippetLengthDedupe] = useState(
        settings.snippet_length ?? 30
    );
    const [snippetStepDedupe, setSnippetStepDedupe] = useState(
        settings.snippet_step ?? 1
    );
    const [signatureSize, setSignatureSize] = useState(
        settings.signature_size ?? 300
    );
    const [similarityThreshold, setSimilarityThreshold] = useState(
        settings.similarity_threshold ?? 0.8
    );

    const [activeTab, setActiveTab] = useState("general");
    const [lastActiveTab, setLastActiveTab] = useState("general");

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
                scan_delay: scanDelayState || undefined,
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
        toast.warn(
            "Alle Einstellungen wurden auf die Standardwerte zurückgesetzt."
        );
        // Logik für Reset hier einfügen...
        setIsResetting(false);
        setIsBusy(false);
    };

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            // =================================================================
            // DER FIX: Wir überprüfen, ob irgendein Modal aktiv ist.
            // Wenn ja, ignorieren wir alle globalen Tastenbefehle.
            // Das verhindert, dass dieser Listener auf "Enter" reagiert,
            // wenn der Benutzer eigentlich in einem anderen Dialog ist.
            const isModalActive = document.querySelector(
                ".modal-overlay, .event-form-overlay, .user-confirmation-overlay"
            );
            if (isModalActive) {
                return;
            }
            // =================================================================

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
                            logoutUser(currentUser);
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
                            logoutUser(currentUser);
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
