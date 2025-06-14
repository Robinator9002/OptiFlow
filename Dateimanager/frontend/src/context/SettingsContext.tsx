import React, { createContext, useState, useCallback, useEffect } from "react";
import { getUserSettings, type Settings as ApiSettings } from "../api/api"; // Pfad anpassen

// Ein vollständiger Satz an Standardwerten, falls keine Einstellungen geladen werden können
const DEFAULT_SETTINGS: ApiSettings = {
    theme_name: "default",
    font_type: "sans-serif",
    font_size: 1.0,
    usable_extensions: [
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
    ],
    processor_excluded_folders: "",
    subfolder: "",
    prefix: "",
    overwrite: false,
    scanner_cpu_cores: 0, // Bezieht sich auf den OCR-Prozessor in diesem Kontext
    max_age_days: 1000,
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
};

// Typdefinition für den Kontext-Wert für bessere Autovervollständigung und Sicherheit
interface SettingsContextType {
    settings: ApiSettings;
    applySettings: (loadedSettings: ApiSettings) => void;
    loadSettings: (currentUser: string) => Promise<void>;
    isReady: boolean;
    // Alle Einstellungs-States werden nun hier zentral verwaltet
    scannerUsableExtensions: string[];
    setScannerUsableExtensions: React.Dispatch<React.SetStateAction<string[]>>;
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
    // NEU: Hinzugefügte OCR-spezifische States
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

const SettingsContext = createContext<SettingsContextType | undefined>(
    undefined
);

const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<ApiSettings>(DEFAULT_SETTINGS);
    const [isReady, setIsReady] = useState(false);

    // Scanner Settings States
    const [scannerUsableExtensions, setScannerUsableExtensions] = useState(
        DEFAULT_SETTINGS.usable_extensions ?? []
    );
    // OCR Settings States
    const [ocrExcludedDirs, setOcrExcludedDirs] = useState(
        DEFAULT_SETTINGS.processor_excluded_folders ?? ""
    );
    const [ocrSubfolder, setOcrSubfolder] = useState(
        DEFAULT_SETTINGS.subfolder ?? ""
    );
    const [ocrPrefix, setOcrPrefix] = useState(DEFAULT_SETTINGS.prefix ?? "");
    const [ocrOverwrite, setOcrOverwrite] = useState(
        DEFAULT_SETTINGS.overwrite ?? false
    );
    // HINWEIS: `scanner_cpu_cores` aus dem Backend-Modell wird hier für die `max_workers` des OCR-Prozessors verwendet.
    const [ocrMaxWorkerCount, setOcrMaxWorkerCount] = useState<number | null>(
        DEFAULT_SETTINGS.scanner_cpu_cores ?? 0
    );
    const [maxAgeDays, setMaxAgeDays] = useState(
        DEFAULT_SETTINGS.max_age_days ?? 1000
    );

    // --- NEU: Alle detaillierten OCR-Einstellungen als State ---
    const [forceOcr, setForceOcr] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_force ?? true
    );
    const [skipText, setSkipText] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_skip_text_layer ?? false
    );
    const [redoOcr, setRedoOcr] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_redo_text_layer ?? false
    );
    const [ocrLanguage, setOcrLanguage] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_language ?? "deu"
    );
    const [ocrImageDpi, setOcrImageDpi] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_image_dpi ?? 300
    );
    const [ocrOptimizeLevel, setOcrOptimizeLevel] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_optimize_level ?? 1
    );
    const [ocrCleanImages, setOcrCleanImages] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_clean_images ?? true
    );
    const [ocrTesseractConfig, setOcrTesseractConfig] = useState(
        DEFAULT_SETTINGS.ocr_processing?.ocr_tesseract_config ??
            "--oem 1 --psm 3"
    );
    const [minCategoryLength, setMinCategoryLength] = useState(
        settings.min_category_length ?? 2
    );

    const applySettings = useCallback((loadedSettings: ApiSettings) => {
        // Theme und Font direkt anwenden
        if (loadedSettings.theme_name) {
            document.body.removeAttribute("data-theme");
            if (loadedSettings.theme_name !== "default") {
                document.body.dataset.theme = loadedSettings.theme_name;
            }
        }
        if (loadedSettings.font_type) {
            document.body.dataset.font = loadedSettings.font_type;
        }
        if (loadedSettings.font_size) {
            const numMultiplier = parseFloat(String(loadedSettings.font_size));
            if (!isNaN(numMultiplier)) {
                document.documentElement.style.setProperty(
                    "--font-size-multiplier",
                    String(numMultiplier)
                );
            }
        }

        // States aus den geladenen Einstellungen befüllen
        setScannerUsableExtensions(
            loadedSettings.usable_extensions ??
                DEFAULT_SETTINGS.usable_extensions ??
                []
        );
        setOcrExcludedDirs(
            loadedSettings.processor_excluded_folders ??
                DEFAULT_SETTINGS.processor_excluded_folders ??
                ""
        );
        setOcrSubfolder(
            loadedSettings.subfolder ?? DEFAULT_SETTINGS.subfolder ?? ""
        );
        setOcrPrefix(loadedSettings.prefix ?? DEFAULT_SETTINGS.prefix ?? "");
        setOcrOverwrite(
            loadedSettings.overwrite ?? DEFAULT_SETTINGS.overwrite ?? false
        );
        setOcrMaxWorkerCount(
            loadedSettings.scanner_cpu_cores ??
                DEFAULT_SETTINGS.scanner_cpu_cores ??
                0
        );
        setMaxAgeDays(
            loadedSettings.max_age_days ?? DEFAULT_SETTINGS.max_age_days ?? 1000
        );

        // --- NEU: Detailliertes OCR-Mapping ---
        const ocr = loadedSettings.ocr_processing;
        const defaultOcr = DEFAULT_SETTINGS.ocr_processing;
        setForceOcr(ocr?.ocr_force ?? defaultOcr?.ocr_force ?? true);
        setSkipText(
            ocr?.ocr_skip_text_layer ?? defaultOcr?.ocr_skip_text_layer ?? false
        );
        setRedoOcr(
            ocr?.ocr_redo_text_layer ?? defaultOcr?.ocr_redo_text_layer ?? false
        );
        setOcrLanguage(ocr?.ocr_language ?? defaultOcr?.ocr_language ?? "deu");
        setOcrImageDpi(ocr?.ocr_image_dpi ?? defaultOcr?.ocr_image_dpi ?? 300);
        setOcrOptimizeLevel(
            ocr?.ocr_optimize_level ?? defaultOcr?.ocr_optimize_level ?? 1
        );
        setOcrCleanImages(
            ocr?.ocr_clean_images ?? defaultOcr?.ocr_clean_images ?? true
        );
        setOcrTesseractConfig(
            ocr?.ocr_tesseract_config ??
                defaultOcr?.ocr_tesseract_config ??
                "--oem 1 --psm 3"
        );
        setMinCategoryLength(
            loadedSettings.min_category_length ?? 2
        );

        setSettings(loadedSettings);
    }, []);

    const loadSettings = useCallback(
        async (currentUser: string) => {
            if (currentUser) {
                try {
                    const response = await getUserSettings(currentUser);
                    if (response?.settings) {
                        applySettings(response.settings);
                    }
                } catch (error) {
                    console.error("Failed to load settings:", error);
                    applySettings(DEFAULT_SETTINGS); // Fallback auf Defaults bei Fehler
                }
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
            setIsReady(true); // App ist auch "bereit", wenn kein Nutzer angemeldet ist
            applySettings(DEFAULT_SETTINGS); // Wende Standardeinstellungen an
        }
    }, [loadSettings, applySettings]);

    const contextValue: SettingsContextType = {
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
    };

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};

export { SettingsContext, SettingsProvider };
