import React, { createContext, useState, useCallback, useEffect } from "react";
import { getUserSettings, type Settings as ApiSettings } from "../api/api";

// NEU: Ein zentrales Objekt für alle Standardeinstellungen.
// Dies ist jetzt die einzige Quelle der Wahrheit für die Defaults.
export const DEFAULT_SETTINGS: ApiSettings = {
    theme_name: "default",
    font_size: 1.0,
    search_limit: 100,
    snippet_limit: 5,
    old_files_limit: 50,
    show_relevance: true,
    match_score: {
        filename_exact: 5,
        filename_partial: 3,
        content: 1,
    },
    scanner_cpu_cores: 0,
    usable_extensions: [".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".py", ".pdf", ".docx"],
    ignored_dirs: ['.venv', 'venv', 'node_modules', 'build', 'dist', 'release', '__pycache__', '.git', '$RECYCLE.BIN', 'System Volume Information'],
    scan_delay: 0,
    snippet_window: 40,
    proximity_window: 20,
    max_age_days: 1000,
    sort_by: "age",
    sort_order: "normal",
    processor_excluded_folders: "",
    subfolder: "OCR",
    prefix: "",
    overwrite: false,
    ocr_processing: {
        ocr_force: true,
        ocr_skip_text_layer: false,
        ocr_redo_text_layer: false,
        ocr_language: "deu",
        ocr_image_dpi: 300,
        ocr_optimize_level: 1,
        ocr_clean_images: true,
        ocr_tesseract_config: "--oem 1 --psm 3",
    },
    check_interval: 60,
    max_file_size: 1000000,
    length_range_step: 100,
    min_category_length: 2,
    snippet_length: 30,
    snippet_step: 1,
    signature_size: 300,
    similarity_threshold: 0.8,
};

// Typdefinition für den Kontext-Wert
interface SettingsContextType {
    settings: ApiSettings;
    defaultSettings: ApiSettings;
    applySettings: (loadedSettings: ApiSettings) => void;
    loadSettings: (currentUser: string) => Promise<void>;
    isReady: boolean;
    scannerUsableExtensions: string[];
    setScannerUsableExtensions: React.Dispatch<React.SetStateAction<string[]>>;
    scannerIgnoredDirs: string[];
    setScannerIgnoredDirs: React.Dispatch<React.SetStateAction<string[]>>;
    ocrExcludedDirs: string;
    setOcrExcludedDirs: React.Dispatch<React.SetStateAction<string>>;
    ocrSubfolder: string;
    setOcrSubfolder: React.Dispatch<React.SetStateAction<string>>;
    ocrPrefix: string;
    setOcrPrefix: React.Dispatch<React.SetStateAction<string>>;
    ocrOverwrite: boolean;
    setOcrOverwrite: React.Dispatch<React.SetStateAction<boolean>>;
    ocrMaxWorkerCount: number | null;
    setOcrMaxWorkerCount: React.Dispatch<React.SetStateAction<number | null>>;
    maxAgeDays: number;
    setMaxAgeDays: React.Dispatch<React.SetStateAction<number>>;
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
    minCategoryLength: number;
    setMinCategoryLength: React.Dispatch<React.SetStateAction<number>>;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(
    undefined
);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<ApiSettings>(DEFAULT_SETTINGS);
    const [isReady, setIsReady] = useState(false);

    // Initialisiere die einzelnen States ebenfalls aus den zentralen Defaults
    const [scannerUsableExtensions, setScannerUsableExtensions] = useState(DEFAULT_SETTINGS.usable_extensions ?? []);
    const [scannerIgnoredDirs, setScannerIgnoredDirs] = useState(DEFAULT_SETTINGS.ignored_dirs ?? []);
    const [ocrExcludedDirs, setOcrExcludedDirs] = useState(DEFAULT_SETTINGS.processor_excluded_folders ?? "");
    const [ocrSubfolder, setOcrSubfolder] = useState(DEFAULT_SETTINGS.subfolder ?? "");
    const [ocrPrefix, setOcrPrefix] = useState(DEFAULT_SETTINGS.prefix ?? "");
    const [ocrOverwrite, setOcrOverwrite] = useState(DEFAULT_SETTINGS.overwrite ?? false);
    const [ocrMaxWorkerCount, setOcrMaxWorkerCount] = useState<number | null>(DEFAULT_SETTINGS.scanner_cpu_cores ?? 0);
    const [maxAgeDays, setMaxAgeDays] = useState(DEFAULT_SETTINGS.max_age_days ?? 1000);
    const [forceOcr, setForceOcr] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_force ?? true);
    const [skipText, setSkipText] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_skip_text_layer ?? false);
    const [redoOcr, setRedoOcr] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_redo_text_layer ?? false);
    const [ocrLanguage, setOcrLanguage] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_language ?? "deu");
    const [ocrImageDpi, setOcrImageDpi] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_image_dpi ?? 300);
    const [ocrOptimizeLevel, setOcrOptimizeLevel] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_optimize_level ?? 1);
    const [ocrCleanImages, setOcrCleanImages] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_clean_images ?? true);
    const [ocrTesseractConfig, setOcrTesseractConfig] = useState(DEFAULT_SETTINGS.ocr_processing?.ocr_tesseract_config ?? "--oem 1 --psm 3");
    const [minCategoryLength, setMinCategoryLength] = useState(DEFAULT_SETTINGS.min_category_length ?? 2);


    const applySettings = useCallback((loadedSettings: ApiSettings) => {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
        setSettings(mergedSettings);

        if (mergedSettings.theme_name) {
            document.body.dataset.theme = mergedSettings.theme_name;
        }
        if (mergedSettings.font_size) {
            document.documentElement.style.setProperty("--font-size-multiplier", String(mergedSettings.font_size));
        }

        setScannerUsableExtensions(mergedSettings.usable_extensions ?? DEFAULT_SETTINGS.usable_extensions!);
        setScannerIgnoredDirs(mergedSettings.ignored_dirs ?? DEFAULT_SETTINGS.ignored_dirs!);
        setOcrExcludedDirs(mergedSettings.processor_excluded_folders ?? DEFAULT_SETTINGS.processor_excluded_folders!);
        setOcrSubfolder(mergedSettings.subfolder ?? DEFAULT_SETTINGS.subfolder!);
        setOcrPrefix(mergedSettings.prefix ?? DEFAULT_SETTINGS.prefix!);
        setOcrOverwrite(mergedSettings.overwrite ?? DEFAULT_SETTINGS.overwrite!);
        setOcrMaxWorkerCount(mergedSettings.scanner_cpu_cores ?? DEFAULT_SETTINGS.scanner_cpu_cores!);
        setMaxAgeDays(mergedSettings.max_age_days ?? DEFAULT_SETTINGS.max_age_days!);
        
        const ocr = mergedSettings.ocr_processing;
        const defaultOcr = DEFAULT_SETTINGS.ocr_processing;
        setForceOcr(ocr?.ocr_force ?? defaultOcr!.ocr_force!);
        setSkipText(ocr?.ocr_skip_text_layer ?? defaultOcr!.ocr_skip_text_layer!);
        setRedoOcr(ocr?.ocr_redo_text_layer ?? defaultOcr!.ocr_redo_text_layer!);
        setOcrLanguage(ocr?.ocr_language ?? defaultOcr!.ocr_language!);
        setOcrImageDpi(ocr?.ocr_image_dpi ?? defaultOcr!.ocr_image_dpi!);
        setOcrOptimizeLevel(ocr?.ocr_optimize_level ?? defaultOcr!.ocr_optimize_level!);
        setOcrCleanImages(ocr?.ocr_clean_images ?? defaultOcr!.ocr_clean_images!);
        setOcrTesseractConfig(ocr?.ocr_tesseract_config ?? defaultOcr!.ocr_tesseract_config!);
        
        setMinCategoryLength(mergedSettings.min_category_length ?? DEFAULT_SETTINGS.min_category_length!);
    }, []);

    const loadSettings = useCallback(
        async (currentUser: string) => {
            if (currentUser) {
                try {
                    const response = await getUserSettings(currentUser);
                    applySettings(response?.settings || {}); // Wende geladene über Defaults an
                } catch (error) {
                    console.error("Failed to load settings, applying defaults:", error);
                    applySettings({}); // Wende nur Defaults an
                }
            } else {
                 applySettings({}); // Wende nur Defaults an
            }
            setIsReady(true);
        },
        [applySettings]
    );
    
    useEffect(() => {
        const storedUser = localStorage.getItem("lastUsername");
        if (storedUser) {
            loadSettings(storedUser);
        } else {
            setIsReady(true);
            applySettings({});
        }
    }, [loadSettings, applySettings]);

    const contextValue = {
        settings,
        defaultSettings: DEFAULT_SETTINGS,
        applySettings,
        loadSettings,
        isReady,
        scannerUsableExtensions, setScannerUsableExtensions,
        scannerIgnoredDirs, setScannerIgnoredDirs,
        ocrExcludedDirs, setOcrExcludedDirs,
        ocrSubfolder, setOcrSubfolder,
        ocrPrefix, setOcrPrefix,
        ocrOverwrite, setOcrOverwrite,
        ocrMaxWorkerCount, setOcrMaxWorkerCount,
        maxAgeDays, setMaxAgeDays,
        forceOcr, setForceOcr,
        skipText, setSkipText,
        redoOcr, setRedoOcr,
        ocrLanguage, setOcrLanguage,
        ocrImageDpi, setOcrImageDpi,
        ocrOptimizeLevel, setOcrOptimizeLevel,
        ocrCleanImages, setOcrCleanImages,
        ocrTesseractConfig, setOcrTesseractConfig,
        minCategoryLength, setMinCategoryLength
    };

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};
