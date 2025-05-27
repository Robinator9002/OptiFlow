import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import SearchSettings from './settings/SearchSettings.tsx';
import ScannerSettings from './settings/ScannerSettings.tsx';
import OCRSettings from './settings/OCRSettings.tsx';
import DeDupingSettings from './settings/DeDupingSettings.tsx';
import OldFilesSettings from './settings/OldFilesSettings.tsx';
import GeneralSettings from './settings/GeneralSettings.tsx';
import UserSettings from './settings/UserSettings.tsx';
import DatabaseSettings from './settings/DatabaseSettings.tsx';
import SystemSettings from './settings/SystemSettings.tsx';
import { getUserSettings, logoutUser, saveUserSettings } from '../api/api.tsx';
import { SettingsContext } from '../context/SettingsContext.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';

function Settings({ currentUser, setCurrentUser, isAdmin, showRelevance, setShowRelevance, onRegister, setLoggedIn, setExecutingEvent, appActiveTab, swapBack }) { // onRegister Prop
    const {
        applySettings,
        loadSettings
    } = useContext(SettingsContext);

    const [isBusy, setIsBusy] = useState(false);

    // --- Einzelne State-Hooks für jede Einstellung ---
    const [searchLimit, setSearchLimit] = useState(100);
    const [snippetLimit, setSnippetLimit] = useState(0);
    const [oldFilesLimit, setOldFilesLimit] = useState(0);
    const [filenameExactMatchScore, setFilenameExactMatchScore] = useState(5);
    const [filenamePartialMatchScore, setFilenamePartialMatchScore] = useState(3);
    const [contentMatchScore, setContentMatchScore] = useState(1);
    const [scannerCpuCoresState, setScannerCpuCoresState] = useState(0);
    const [scannerUsableExtensionsState, setScannerUsableExtensionsState] = useState([".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"]);
    const [scanDelayState, setScanDelayState] = useState(0);
    const [snippetWindow, setSnippetWindow] = useState(0);
    const [proximityWindow, setProximityWindow] = useState(0);
    const [maxAgeDays, setMaxAgeDays] = useState(1000);
    const [sortBy, setSortBy] = useState('age');
    const [sortOrder, setSortOrder] = useState('normal');
    const [ocrExcludedDirsState, setOcrExcludedDirsState] = useState('');
    const [ocrSubfolderState, setOcrSubfolderState] = useState('');
    const [ocrPrefixState, setOcrPrefixState] = useState('');
    const [ocrOverwriteState, setOcrOverwriteState] = useState(true);
    const [ocrMaxWorkerCountState, setOcrMaxWorkerCountState] = useState(0);
    const [forceOcrState, setForceOcrState] = useState(true);
    const [skipTextState, setSkipTextState] = useState(false);
    const [redoOcrState, setRedoOcrState] = useState(false);
    const [themeName, setThemeName] = useState('default');
    const [fontType, setFontType] = useState('sans-serif');
    const [fontSize, setFontSize] = useState(1.0);
    const [checkInterval, setCheckInterval] = useState(60);
    const [activeTab, setActiveTab] = useState('general');
    const [lastActiveTab, setLastActiveTab] = useState('general');
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [maxFileSize, setMaxFileSize] = useState(1000000);
    // DeDuping Settings
    const [lengthRangeStep, setLengthRangeStep] = useState(100);
    const [minCategoryLength, setMinCategoryLength] = useState(2);
    const [snippetLengthDedupe, setSnippetLengthDedupe] = useState(30);
    const [snippetStepDedupe, setSnippetStepDedupe] = useState(1);
    const [signatureSize, setSignatureSize] = useState(300);
    const [similarityThreshold, setSimilarityThreshold] = useState(0.8);

    const tabsAdmin = [
        { id: 'general', label: 'Allgemein' },
        { id: 'search', label: 'Suche' },
        { id: 'scanner', label: 'Scanner' },
        { id: 'ocr', label: 'OCR' },
        { id: 'oldFiles', label: 'Vergessene Dateien' },
        { id: 'deduping', label: 'Entuplizierung' },
        { id: 'userSettings', label: 'Nutzereinstellungen' },
        { id: 'database', label: 'Datenbank' },
        { id: 'system', label: 'System' },
    ];
    const tabsNonAdmin = [
        { id: 'general', label: 'Allgemein' },
        { id: 'userSettings', label: 'Nutzereinstellungen' },
    ];
    const visibleTabs = isAdmin ? tabsAdmin : tabsNonAdmin;

    const handleTabClick = (tabId) => {
        setLastActiveTab(activeTab);
        setActiveTab(tabId);
    };

    // Lade die Einstellungen des Benutzers beim Mounten der Komponente
    useEffect(() => {
        const loadUserSettings = async () => {
            if (currentUser) {
                try {
                    const response = await getUserSettings(currentUser);
                    // Sicherstellen, dass response und response.settings definiert sind.
                    const fetchedSettings = response?.settings || {};

                    //Stelle sicher, dass match_score immer ein Objekt ist.
                    const safeMatchScore = fetchedSettings.match_score || {
                        filename_exact: 5,
                        filename_partial: 3,
                        content: 1,
                    };

                    const settingsToApply = {
                        search_limit: fetchedSettings.search_limit ?? 100,
                        snippet_limit: fetchedSettings.snippet_limit ?? 0,
                        old_files_limit: fetchedSettings.old_files_limit ?? 0,
                        show_relevance: fetchedSettings.show_relevance ?? false,
                        match_score: safeMatchScore,
                        scanner_cpu_cores: fetchedSettings.scanner_cpu_cores ?? 0,
                        usable_extensions: fetchedSettings.usable_extensions ?? [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"],
                        scan_delay: fetchedSettings.scan_delay ?? 0,
                        snippet_window: fetchedSettings.snippet_window ?? 40,
                        proximity_window: fetchedSettings.proximity_window ?? 20,
                        max_age_days: fetchedSettings.max_age_days ?? 1000,
                        sort_by: fetchedSettings.sort_by ?? 'age',
                        sort_order: fetchedSettings.sort_order ?? 'normal',
                        processor_excluded_folders: fetchedSettings.processor_excluded_folders ?? '',
                        subfolder: fetchedSettings.subfolder ?? '',
                        prefix: fetchedSettings.prefix ?? '',
                        overwrite: fetchedSettings.overwrite ?? true,
                        processing_cpu_cores: fetchedSettings.processing_cpu_cores ?? 0,
                        force_ocr: fetchedSettings.force_ocr ?? true,
                        skip_text: fetchedSettings.skip_text ?? false,
                        redo_ocr: fetchedSettings.redo_ocr ?? false,
                        theme_name: fetchedSettings.theme_name ?? 'default',
                        font_type: fetchedSettings.font_type ?? 'sans-serif',
                        font_size: fetchedSettings.font_size ?? 1.0,
                        check_interval: fetchedSettings.check_interval ?? 60,
                        max_file_size: fetchedSettings.max_file_size ?? 1000000,
                        length_range_step: fetchedSettings.length_range_step ?? 100,
                        min_category_length: fetchedSettings.min_actegory_length ?? 2,
                        snippet_length_dedupe: fetchedSettings.snippet_length_dedupe ?? 30,
                        snippet_step_dedupe: fetchedSettings.snippet_step_dedupe ?? 1,
                        signature_size: fetchedSettings.signature_size ?? 300,
                        similarity_treshold: fetchedSettings.similarity_treshold ?? 0.8,
                    };

                    setSearchLimit(settingsToApply.search_limit);
                    setSnippetLimit(settingsToApply.snippet_limit);
                    setOldFilesLimit(settingsToApply.old_files_limit);
                    setShowRelevance(settingsToApply.show_relevance);
                    setFilenameExactMatchScore(settingsToApply.match_score.filename_exact);
                    setFilenamePartialMatchScore(settingsToApply.match_score.filename_partial);
                    setContentMatchScore(settingsToApply.match_score.content);
                    setScannerCpuCoresState(settingsToApply.scanner_cpu_cores);
                    setScannerUsableExtensionsState(settingsToApply.usable_extensions);
                    setScanDelayState(settingsToApply.scan_delay);
                    setSnippetWindow(settingsToApply.snippet_window);
                    setProximityWindow(settingsToApply.proximity_window);
                    setMaxAgeDays(settingsToApply.max_age_days);
                    setSortBy(settingsToApply.sort_by);
                    setSortOrder(settingsToApply.sort_order);
                    setOcrExcludedDirsState(settingsToApply.processor_excluded_folders);
                    setOcrSubfolderState(settingsToApply.subfolder);
                    setOcrPrefixState(settingsToApply.prefix);
                    setOcrOverwriteState(settingsToApply.overwrite);
                    setOcrMaxWorkerCountState(settingsToApply.processing_cpu_cores);
                    setForceOcrState(settingsToApply.force_ocr);
                    setSkipTextState(settingsToApply.skip_text);
                    setRedoOcrState(settingsToApply.redo_ocr);
                    setThemeName(settingsToApply.theme_name);
                    setFontType(settingsToApply.font_type);
                    setFontSize(settingsToApply.font_size);
                    setCheckInterval(settingsToApply.check_interval);
                    setMaxFileSize(settingsToApply.max_file_size);
                    setLengthRangeStep(settingsToApply.length_range_step);
                    setMinCategoryLength(settingsToApply.min_category_length);
                    setSnippetLengthDedupe(settingsToApply.snippet_length_dedupe);
                    setSnippetStepDedupe(settingsToApply.snippet_step_dedupe);
                    setSignatureSize(settingsToApply.signature_size);
                    setSimilarityThreshold(settingsToApply.similarity_treshold);

                    applySettings(settingsToApply);

                } catch (error) {
                    toast.error(`Fehler beim Laden der Einstellungen: ${error.message || 'Unbekannter Fehler'}`);
                }
            }
        };
        loadUserSettings();
    }, [currentUser, applySettings]);

    const handleSaveSettings = async () => {
        // Zeite das Modal nicht mehr!
        setIsSaving(false);
        setIsBusy(false);

        // Erstelle die Einstellungen
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
                const response = await saveUserSettings(currentUser, settingsToSave);
                toast.success(response.message || 'Einstellungen gespeichert!');
                await loadSettings(currentUser); // Nach dem Speichern die Einstellungen neu laden, um den Context zu aktualisieren
            } catch (error) {
                toast.error(`Fehler beim Speichern der Einstellungen: ${error.message || 'Unbekannter Fehler'}`);
            }
        } else {
            toast.error("Benutzername ist nicht verfügbar. Bitte melden Sie sich an.");
        }
    };


    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
            if (!(appActiveTab === 'settings')) {
                return; // Nur Keys ausführen wenn der Nutzer sich tatsächlich in Settings aufhällt
            }

            if (isBusy === true) {
                return; // Wenn der Nutzer gerade etwas macht (wie das ändern des Passwortes), nicht überschreiben
            }

            if (event.key === 'Enter') {
                setIsSaving(true);
            }
            if (event.key === 'Escape') {
                swapBack();
            }
        }

        // Event Listener hinzufügen, wenn Komponente mountet
        document.addEventListener('keydown', handleGlobalKeyDown);

        // Event Listener entfernen, wenn Komponente unmountet
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [appActiveTab, isBusy, handleSaveSettings, swapBack]);


    const handleResetToDefaults = () => {
        // Zeige das Modal nicht mehr!
        setIsResetting(false);
        setIsBusy(false);

        // Setze den State zurück mit Standardwerten
        setSearchLimit(100);
        setSnippetLimit(0);
        setOldFilesLimit(0);
        setShowRelevance(false);
        setFilenameExactMatchScore(5);
        setFilenamePartialMatchScore(3);
        setContentMatchScore(1);
        setScannerCpuCoresState(0);
        setScannerUsableExtensionsState([".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"]);
        setScanDelayState(0);
        setSnippetWindow(40);
        setProximityWindow(20);
        setMaxAgeDays(1000);
        setSortBy('age');
        setSortOrder('normal');
        setOcrExcludedDirsState('');
        setOcrSubfolderState('');
        setOcrPrefixState('');
        setOcrOverwriteState(true);
        setOcrMaxWorkerCountState(0);
        setForceOcrState(true);
        setSkipTextState(false);
        setRedoOcrState(false);
        setThemeName('default');
        setFontType('sans-serif');
        setFontSize(1.0);
        setCheckInterval(60);
        setMaxFileSize(1000000);
        setLengthRangeStep(100);
        setMinCategoryLength(2);
        setSnippetLengthDedupe(30);
        setSnippetStepDedupe(1);
        setSignatureSize(300);
        setSimilarityThreshold(0.8);

        const defaultSettings = {
            search_limit: 100,
            snippet_limit: 0,
            old_files_limit: 1000,
            show_relevance: false,
            match_score: {
                filename_exact: 5,
                filename_partial: 3,
                content: 1,
            },
            scanner_cpu_cores: typeof navigator !== 'undefined' ? Math.max(1, navigator.hardwareConcurrency - 1) || 2 : 2,
            usable_extensions: [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"],
            scan_delay: 0,
            snippet_window: 40,
            proximity_window: 20,
            max_age_days: 1000,
            sort_by: 'age',
            sort_order: 'normal',
            processor_excluded_dirs: '',
            subfolder: '',
            prefix: '',
            overwrite: true,
            processing_cpu_cores: 0,
            force_ocr: true,
            skip_text: false,
            redo_ocr: false,
            theme_name: 'default',
            font_type: 'sans-serif',
            font_size: 1.0,
            check_interval: 60,
            max_file_size: 1000000,
            length_range_step: 100,
            min_category_length: 2,
            snippet_length_dedupe: 30,
            snippet_step_dedupe: 1,
            signature_size: 300,
            similarity_treshold: 0.8,
        };
        try {
            applySettings(defaultSettings);
            toast.warn('Alle Einstellungen wurden auf die Standardwerte zurückgesetzt.');
        } catch (error) {
            toast.error(`Fehler beim Setzen auf Standardwerte: ${error.message || 'Unbekannter Fehler'}`);
        }
    };

    useEffect(() => {
        if (currentUser) {
            loadSettings(currentUser);
        }
    }, [currentUser, loadSettings]);

    // Wird aufgerufen, wenn ein neuer Benutzer registriert wird
    useEffect(() => {
        if (onRegister) {
            const defaultSettings = {
                search_limit: 100,
                snippet_limit: 0,
                old_files_limit: 0,
                show_relevance: false,
                match_score: {
                    filename_exact: 5,
                    filename_partial: 3,
                    content: 1,
                },
                scanner_cpu_cores: typeof navigator !== 'undefined' ? Math.max(1, navigator.hardwareConcurrency - 1) || 2 : 2,
                usable_extensions: [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"],
                scan_delay: 0,
                snippet_window: 40,
                proximity_window: 20,
                max_age_days: 1000,
                sort_by: 'age',
                sort_order: 'normal',
                processor_excluded_dirs: '',
                subfolder: '',
                prefix: '',
                ocr_overwrite: true,
                processing_cpu_cores: 0,
                force_ocr: true,
                skip_text: false,
                redo_ocr: false,
                theme_name: 'default',
                font_type: 'sans-serif',
                font_size: 1.0,
                check_interval: 60,
                max_file_size: 1000000,
                length_range_step: 100,
                min_category_length: 2,
                snippet_length_dedupe: 30,
                snippet_step_dedupe: 1,
                signature_size: 300,
                similarity_treshold: 0.8,
            };
            applySettings(defaultSettings);
            // Keine Notwendigkeit, die Einstellungen hier zu speichern, es sei denn, du willst sie explizit in der DB speichern.
            toast.info('Standardeinstellungen für neuen Benutzer geladen.');
        }
    }, [onRegister, applySettings, currentUser]);

    return (
        <div className="settings-container container">
            <div className="settings-tabs">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => handleTabClick(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="settings-content">
                {activeTab === 'general' && <GeneralSettings
                    themeName={themeName}
                    setThemeName={setThemeName}
                    fontType={fontType}
                    setFontType={setFontType}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                />}
                {activeTab === 'search' && <SearchSettings
                    searchLimit={searchLimit}
                    setSearchLimit={setSearchLimit}
                    snippetLimit={snippetLimit}
                    setSnippetLimit={setSnippetLimit}
                    showRelevance={showRelevance}
                    setShowRelevance={setShowRelevance}
                    filenameExactMatchScore={filenameExactMatchScore}
                    setFilenameExactMatchScore={setFilenameExactMatchScore}
                    filenamePartialMatchScore={filenamePartialMatchScore}
                    setFilenamePartialMatchScore={setFilenamePartialMatchScore}
                    contentMatchScore={contentMatchScore}
                    setContentMatchScore={setContentMatchScore}
                    snippetWindow={snippetWindow}
                    setSnippetWindow={setSnippetWindow}
                    proximityWindow={proximityWindow}
                    setProximityWindow={setProximityWindow}
                />}
                {activeTab === 'scanner' && <ScannerSettings
                    scannerCpuCores={scannerCpuCoresState}
                    setScannerCpuCores={setScannerCpuCoresState}
                    usableExtensions={scannerUsableExtensionsState}
                    setUsableExtensions={setScannerUsableExtensionsState}
                    scanDelay={scanDelayState}
                    setScanDelay={setScanDelayState}
                />}
                {activeTab === 'ocr' && <OCRSettings
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
                />}
                {activeTab === 'oldFiles' && <OldFilesSettings
                    oldFilesLimit={oldFilesLimit}
                    setOldFilesLimit={setOldFilesLimit}
                    maxAgeDays={maxAgeDays}
                    setMaxAgeDays={setMaxAgeDays}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    sortOrder={sortOrder}
                    setSortOrder={setSortOrder}
                />}
                {activeTab === 'deduping' && <DeDupingSettings
                    lengthRangeStep={lengthRangeStep} setLengthRangeStep={setLengthRangeStep}
                    minCategoryLength={minCategoryLength} setMinCategoryLength={setMinCategoryLength}
                    snippetLengthDedupe={snippetLengthDedupe} setSnippetLengthDedupe={setSnippetLengthDedupe}
                    snippetStepDedupe={snippetLengthDedupe} setSnippetStepDedupe={setSnippetStepDedupe}
                    signatureSize={signatureSize} setSignatureSize={setSignatureSize}
                    similarityThreshold={similarityThreshold} setSimilarityThreshold={setSimilarityThreshold}
                />}
                {activeTab === 'userSettings' && <UserSettings currentUser={currentUser} setCurrentUser={setCurrentUser} isAdmin={isAdmin} onLogout={() => {
                    logoutUser(currentUser || '');
                    setLoggedIn(false);
                }}
                    swapBack={() => setActiveTab(lastActiveTab)}
                    setIsBusy={setIsBusy}
                />}
                {activeTab === 'database' && <DatabaseSettings
                    isAdmin={isAdmin}
                    maxFileSize={maxFileSize}
                    setMaxFileSize={setMaxFileSize}
                    setIsBusy={setIsBusy}
                />}
                {activeTab === 'system' && <SystemSettings
                    currentUser={currentUser}
                    checkInterval={checkInterval} setCheckInterval={setCheckInterval}
                    setExecutingEvent={setExecutingEvent}
                    setIsBusy={setIsBusy}
                    onLogout={() => {
                        logoutUser(currentUser || '');
                        setLoggedIn(false);
                    }} />}
                <div className="settings-actions">
                    <button className="save-button" onClick={() => { setIsSaving(true); setIsBusy(true); }}>Speichern</button>
                    <button className="reset-button" onClick={() => { setIsResetting(true); setIsBusy(true); }}>Zurücksetzen</button>
                </div>
            </div>
            {(isSaving || isResetting) && (
                <ConfirmModal
                    title={isSaving ? "Einstellungen Speichern" : "Einstellungen Zurücksetzen"}
                    message={isSaving ? "Sind Sie sicher, dass Sie die Einstellungen speichern möchten?" : "Sind Sie sicher, dass Sie die Einstellungen zurücksetzen möchten?"}
                    isDanger={false}
                    onConfirm={isSaving ? () => handleSaveSettings() : () => handleResetToDefaults()}
                    onCancel={isSaving ? () => { setIsSaving(false); setIsBusy(false); } : () => { setIsResetting(false); setIsBusy(false); }}
                />
            )}
        </div>
    );
}
export default Settings;
