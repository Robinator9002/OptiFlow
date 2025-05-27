import React, { createContext, useState, useEffect, useCallback, use } from 'react';
import { getUserSettings } from '../api/api.tsx'; // Pfad anpassen

const ALL_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"];

const SettingsContext = createContext({
    settings: {},
    applySettings: (loadedSettings) => { },
    loadSettings: (currentUser) => { },
    isReady: false,
    scannerUsableExtensions: ALL_EXTENSIONS,
    setScannerUsableExtensions: (extensions) => { },
    scannerExcludedDirs: '',
    setScannerExcludedDirs: (dirs) => { },
    ocrExcludedDirs: '',
    setOcrExcludedDirs: (dirs) => { },
    ocrSubfolder: '',
    setOcrSubfolder: (folder) => { },
    ocrPrefix: '',
    setOcrPrefix: (prefix) => { },
    ocrOverwrite: false,
    setOcrOverwrite: (overwrite) => { },
    ocrMaxWorkerCount: 0,
    setOcrMaxWorkerCount: (count) => { },
    maxAgeDays: 1000,
    setMaxAgeDays: (maxAgeDays) => { },
});

const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({});
    const [isReady, setIsReady] = useState(false);

    // Scanner Settings States
    const [scannerUsableExtensions, setScannerUsableExtensions] = useState(ALL_EXTENSIONS);
    // OCR Settings States
    const [ocrExcludedDirs, setOcrExcludedDirs] = useState('');
    const [ocrSubfolder, setOcrSubfolder] = useState('');
    const [ocrPrefix, setOcrPrefix] = useState('');
    const [ocrOverwrite, setOcrOverwrite] = useState(false);
    const [ocrMaxWorkerCount, setOcrMaxWorkerCount] = useState(0);
    const [maxAgeDays, setMaxAgeDays] = useState(1000);

    const applySettings = useCallback((loadedSettings) => {
        if (!isReady) return;

        if (loadedSettings.theme_name) {
            document.body.removeAttribute('data-theme');
            if (loadedSettings.theme_name !== 'default') {
                document.body.dataset.theme = loadedSettings.theme_name;
            }
        }
        if (loadedSettings.font_type) {
            document.body.dataset.font = loadedSettings.font_type;
        }
        if (loadedSettings.font_size) {
            const numMultiplier = parseFloat(loadedSettings.font_size);
            if (!isNaN(numMultiplier)) {
                document.documentElement.style.setProperty('--font-size-multiplier', numMultiplier);
            }
        }

        // statt loadedSettings.scanner_usable_extensions:
        if (loadedSettings.usable_extensions) {
            setScannerUsableExtensions(loadedSettings.usable_extensions);
        }

        // OCR‑Mapping:
        if (loadedSettings.processor_excluded_folders) {
            setOcrExcludedDirs(loadedSettings.processor_excluded_folders);
        }
        if (loadedSettings.subfolder !== undefined) {
            setOcrSubfolder(loadedSettings.subfolder);
        }
        if (loadedSettings.prefix !== undefined) {
            setOcrPrefix(loadedSettings.prefix);
        }
        if (loadedSettings.overwrite !== undefined) {
            setOcrOverwrite(loadedSettings.overwrite);
        }
        if (loadedSettings.processing_cpu_cores !== undefined) {
            setOcrMaxWorkerCount(loadedSettings.processing_cpu_cores);
        }
        if (loadedSettings.max_age_days !== undefined) {
            setMaxAgeDays(loadedSettings.max_age_days);
        }


        setSettings(loadedSettings);
    }, [isReady]);

    const loadSettings = useCallback(async (currentUser) => {
        if (currentUser) {
            try {
                const response = await getUserSettings(currentUser);
                if (response?.settings) {
                    applySettings(response.settings);
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            }
        }
        setIsReady(true);
    }, [applySettings]);

    useEffect(() => {
        const storedUser = localStorage.getItem('lastUsername');
        if (storedUser) {
            loadSettings(storedUser);
        } else {
            setIsReady(true);
        }
    }, [loadSettings]);

    const contextValue = {
        settings,
        applySettings,
        loadSettings,
        isReady,
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
    };

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};

export { SettingsContext, SettingsProvider };
