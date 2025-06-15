import { useState, useEffect, useContext, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import myAppIcon from "/icon.png";
import FileManagement from "./components/FileManagement.tsx";
import DeDuping from "./components/DeDuping.tsx";
import OldFiles from "./components/OldFiles.tsx";
import IndexManagement from "./components/IndexManagement.tsx";
import PDFProcessor from "./components/OCRProcessor.tsx";
import Login from "./components/Login.tsx";
import Settings from "./components/Settings.tsx";
import { Help } from "./components/Help.tsx";
import {
    getScannerConfig,
    autoLogin,
    getUserAdminStatus,
    logoutUser,
    getFileInfo,
} from "./api/api.tsx";
import {
    SettingsContext,
    SettingsProvider,
} from "./context/SettingsContext.tsx";
import { ConfirmModal } from "./components/ConfirmModal.tsx";
import ScannerConfig from "./components/ScannerConfig.tsx";

// Definieren der Tab-Reihenfolge für die Navigation
const TAB_ORDER = ["search", "dedupe", "old-files", "scanner", "pdf-to-ocr"];
const SETTINGS_TAB_ID = "settings";

// Die AppContent-Komponente enthält die gesamte UI und Logik der Anwendung.
// Sie kann den SettingsContext verwenden, weil sie vom SettingsProvider umgeben ist.
function AppContent() {
    // Beziehe den Kontext, der vom Provider oben bereitgestellt wird.
    const settingsContext = useContext(SettingsContext);

    // Lokale UI-Zustände
    const [activeTab, setActiveTab] = useState("search");
    const [lastActiveTab, setLastActiveTab] = useState("search");
    const [configs, setConfigs] = useState<any | null>(null);
    const [scanningFiles, setScanningFiles] = useState(false);
    const [loadingIndex, setLoadingIndex] = useState(false);
    const [actualizingIndex, setActualizingIndex] = useState(false);
    const [searchingFiles, setSearchingFiles] = useState(false);
    const [processingPDF, setProcessingPDF] = useState(false);
    const [findingOldFiles, setFindingOldFiles] = useState(false);
    const [executingEvent, setExecutingEvent] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [selectedFile, setSelectedFile] = useState<any | null>(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // showRelevance wird jetzt direkt aus dem Context bezogen.
    // Der lokale State dafür ist nicht mehr nötig.
    const [showRelevance, setShowRelevance] = useState(false);

    // Sicherstellen, dass der Kontext geladen ist, bevor auf ihn zugegriffen wird.
    if (!settingsContext) {
        return (
            <div className="spinner-container overlay">
                <div className="spinner" />
            </div>
        );
    }
    const { loadSettings, settings, isReady } = settingsContext;

    const appContainerRef = useRef<HTMLDivElement>(null);

    // Diese Logik bleibt, da sie den Anwendungsstatus (Admin, Passwort-Reset) steuert.
    useEffect(() => {
        async function fetchUserStatus() {
            if (currentUser) {
                try {
                    const adminStatus = await getUserAdminStatus(currentUser);
                    setIsAdmin(adminStatus.isAdmin);
                } catch (error) {
                    console.error(
                        "Fehler beim Abrufen des Benutzerstatus:",
                        error
                    );
                    toast.error("Fehler beim Abrufen des Benutzerstatus.");
                }
            }
        }
        fetchUserStatus();

        async function fetchConfig() {
            if (activeTab === "scanner" && isAdmin) {
                try {
                    const configData = await getScannerConfig();
                    setConfigs(configData.config);
                } catch (error) {
                    console.error(
                        "Fehler beim Laden der Scanner-Konfiguration:",
                        error
                    );
                    toast.error("Fehler beim Laden der Scanner-Konfiguration.");
                }
            }
        }
        if (loggedIn) {
            fetchConfig();
        }
    }, [currentUser, activeTab, loggedIn, isAdmin]);

    // Die Auto-Login-Logik ist vereinfacht. Sie prüft nur den Benutzer
    // und überlässt das Laden der Einstellungen dem Context.
    useEffect(() => {
        async function checkAutoLogin() {
            const storedUsername = localStorage.getItem("lastUsername");
            if (storedUsername && isReady) {
                try {
                    await autoLogin(storedUsername);
                    setLoggedIn(true);
                    setCurrentUser(storedUsername);
                    // Der `SettingsProvider` hat die Einstellungen bereits geladen.
                    // Wir müssen es hier nicht erneut tun.
                    toast.success(`Willkommen zurück, ${storedUsername}!`);
                } catch (error) {
                    console.error("Auto-Login fehlgeschlagen:", error);
                    localStorage.removeItem("lastUsername");
                    setLoggedIn(false);
                    setCurrentUser(null);
                }
            }
        }
        // Wir warten, bis der Context bereit ist, bevor wir den Auto-Login versuchen.
        if (isReady) {
            checkAutoLogin();
        }
    }, [isReady]); // Abhängigkeit von isReady stellt sicher, dass wir nicht zu früh starten.

    const handleLoginSuccess = async (username: string) => {
        localStorage.setItem("lastUsername", username);
        setLoggedIn(true);
        setCurrentUser(username);
        // Nach erfolgreichem Login laden wir die Einstellungen explizit über den Context.
        await loadSettings(username);
        toast.success(`Der Nutzer ${username} wurde erfolgreich angemeldet.`);
    };

    const onFileSelected = async (file_path: string) => {
        try {
            const file = await getFileInfo(file_path);
            setSelectedFile(file);
            setActiveTab("search");
        } catch (err: any) {
            toast.error(`Fehler beim Wählen der Datei: ${err.message || err}`);
            console.error(err);
        }
    };

    const handleLogout = () => {
        try {
            if (currentUser) logoutUser(currentUser);
            localStorage.removeItem("lastUsername");
            setLoggedIn(false);
            setCurrentUser(null);
            setIsAdmin(false);
            setConfirmLogout(false);
            setActiveTab("search");
            toast.warn(`Die Abmeldung war erfolgreich.`);
        } catch (error: any) {
            console.error("Fehler beim Abmelden:", error);
            toast.error(`Fehler beim Abmelden: ${error.message || error}`);
        }
    };

    const handleTabChange = (tab: string) => {
        if (
            !isAdmin &&
            (tab === "scanner" ||
                tab === "pdf-to-ocr" ||
                tab === "old-files" ||
                tab === "dedupe"
            )
        ) {
            toast.warn("Diese Funktion ist für Administratoren reserviert.");
            return;
        }
        setSelectedFile(null);
        if (activeTab !== SETTINGS_TAB_ID && tab === SETTINGS_TAB_ID) {
            setLastActiveTab(activeTab);
        }
        setActiveTab(tab);
    };

    const swapBack = () => {
        const targetTab =
            lastActiveTab && lastActiveTab !== SETTINGS_TAB_ID
                ? lastActiveTab
                : "search";
        setActiveTab(targetTab);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const targetElement = event.target as HTMLElement;
            const isInputFocused =
                targetElement.tagName === "INPUT" ||
                targetElement.tagName === "TEXTAREA" ||
                targetElement.isContentEditable;

            if (showHelpModal) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    setShowHelpModal(false);
                }
                return;
            }

            if (confirmLogout) {
                return;
            }

            if (event.key === "F1") {
                event.preventDefault();
                setShowHelpModal(true);
                return;
            }

            if (event.ctrlKey && event.key === ",") {
                event.preventDefault();
                handleTabChange(SETTINGS_TAB_ID);
                return;
            }

            if (isInputFocused) {
                if (event.key === "Tab" && !event.ctrlKey && !event.shiftKey)
                    return;
                if (event.ctrlKey && event.key === "Tab") return;
                if (
                    event.ctrlKey &&
                    !(
                        parseInt(event.key) >= 1 &&
                        parseInt(event.key) <= TAB_ORDER.length
                    )
                )
                    return;
            }

            if (
                event.ctrlKey &&
                parseInt(event.key) >= 1 &&
                parseInt(event.key) <= TAB_ORDER.length
            ) {
                event.preventDefault();
                const tabIndex = parseInt(event.key) - 1;
                if (TAB_ORDER[tabIndex]) {
                    handleTabChange(TAB_ORDER[tabIndex]);
                }
                return;
            }

            if (event.key === "Tab" && (event.ctrlKey || !isInputFocused)) {
                event.preventDefault();
                const currentIndex = TAB_ORDER.indexOf(activeTab);
                let nextIndex;
                if (event.shiftKey || event.ctrlKey) {
                    nextIndex =
                        currentIndex <= 0
                            ? TAB_ORDER.length - 1
                            : currentIndex - 1;
                } else {
                    nextIndex =
                        currentIndex >= TAB_ORDER.length - 1
                            ? 0
                            : currentIndex + 1;
                }

                let guard = 0;
                let originalNextIndex = nextIndex;
                do {
                    if (
                        isAdmin ||
                        ![
                            "dedupe",
                            "old-files",
                            "scanner",
                            "pdf-to-ocr",
                        ].includes(TAB_ORDER[nextIndex])
                    ) {
                        break;
                    }
                    if (event.shiftKey || event.ctrlKey) {
                        nextIndex =
                            nextIndex <= 0
                                ? TAB_ORDER.length - 1
                                : nextIndex - 1;
                    } else {
                        nextIndex =
                            nextIndex >= TAB_ORDER.length - 1
                                ? 0
                                : nextIndex + 1;
                    }
                    guard++;
                } while (
                    guard < TAB_ORDER.length &&
                    nextIndex !== originalNextIndex
                );

                if (guard < TAB_ORDER.length) {
                    handleTabChange(TAB_ORDER[nextIndex]);
                }
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [activeTab, isAdmin, showHelpModal, confirmLogout]);

    if (!loggedIn) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    // Die `Settings`-Komponente erhält nun die `showRelevance`-Werte aus den geladenen Einstellungen.
    return (
        <>
            <div className="app-container" ref={appContainerRef} tabIndex={-1}>
                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    aria-label="Benachrichtigungsbereich"
                />
                <header>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: "0.05rem",
                        }}
                    >
                        <img
                            src={myAppIcon}
                            alt="App Icon"
                            width="45"
                            height="45"
                        />
                        <h1>OptiFlow Dateimanager</h1>
                    </div>
                    <div className="user-container">
                        {currentUser && <p>Angemeldet als: {currentUser}</p>}
                        <div className="user-container-buttons">
                            <button
                                className={`tab ${
                                    activeTab === SETTINGS_TAB_ID
                                        ? "active"
                                        : ""
                                } settings-tab-button`}
                                onClick={() => handleTabChange(SETTINGS_TAB_ID)}
                                data-tab={SETTINGS_TAB_ID}
                                disabled={!currentUser}
                                title="Einstellungen öffnen (Strg + ,)"
                            >
                                ⚙️ Einstellungen
                            </button>
                            <button
                                onClick={() => setConfirmLogout(true)}
                                title="Abmelden"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </header>

                <div className="tabs">
                    {/* ... (Tab-Rendering bleibt gleich) ... */}
                    {TAB_ORDER.map((tabId) => {
                        let tabLabel = "";
                        let isDisabled =
                            !isAdmin &&
                            [
                                "dedupe",
                                "old-files",
                                "scanner",
                                "pdf-to-ocr",
                            ].includes(tabId);
                        switch (tabId) {
                            case "search":
                                tabLabel = "Suche & Vorschau";
                                break;
                            case "dedupe":
                                tabLabel = "Entduplizierung";
                                break;
                            case "old-files":
                                tabLabel = "Alte Dateien";
                                break;
                            case "scanner":
                                tabLabel = "Index & Scanner";
                                break;
                            case "pdf-to-ocr":
                                tabLabel = "PDF zu OCR";
                                break;
                            default:
                                tabLabel = tabId;
                        }
                        return (
                            <button
                                key={tabId}
                                className={`tab ${
                                    activeTab === tabId ? "active" : ""
                                }`}
                                onClick={() => handleTabChange(tabId)}
                                data-tab={tabId}
                                disabled={isDisabled}
                                style={{
                                    cursor: isDisabled
                                        ? "not-allowed"
                                        : "pointer",
                                }}
                                title={tabLabel}
                            >
                                {tabLabel}
                            </button>
                        );
                    })}
                    <button
                        className={`tab ${showHelpModal ? "active" : ""}`}
                        onClick={() => setShowHelpModal(true)}
                        title="Hilfe anzeigen (F1)"
                    >
                        ❔ Hilfe
                    </button>
                </div>
                {activeTab === "search" && (
                    <div className="tab-content search-tab">
                        <FileManagement
                            searchingFiles={searchingFiles}
                            setSearchingFiles={setSearchingFiles}
                            selectedFile={selectedFile}
                            setSelectedFile={setSelectedFile}
                            showRelevance={showRelevance}
                            isAdmin={isAdmin}
                        />
                    </div>
                )}

                {activeTab === "dedupe" && isAdmin && (
                    <div className="tab-content">
                        <DeDuping onFileSelected={onFileSelected} />
                    </div>
                )}

                {activeTab === "old-files" && isAdmin && (
                    <div className="tab-content old-files-tab">
                        <OldFiles
                            setFindingOldFiles={setFindingOldFiles}
                            onFileSelected={onFileSelected}
                            oldFilesLimit={configs?.old_files_limit ?? 100}
                            sortBy={configs?.sort_by ?? "age"}
                            sortOrder={configs?.sort_order ?? "desc"}
                        />
                    </div>
                )}

                {activeTab === "scanner" && isAdmin && (
                    <div className="tab-content scanner-tab">
                        <IndexManagement
                            setScanningFiles={setScanningFiles}
                            setActualizingIndex={setActualizingIndex}
                            setLoadingIndex={setLoadingIndex}
                        />
                        <ScannerConfig
                            configs={configs}
                            setConfigs={setConfigs}
                        />
                    </div>
                )}

                {activeTab === "pdf-to-ocr" && isAdmin && (
                    <div className="tab-content pdf-to-ocr-tab">
                        <PDFProcessor setProcessingPDF={setProcessingPDF} />
                    </div>
                )}

                <div
                    className="tab-content"
                    style={{
                        display:
                            activeTab === SETTINGS_TAB_ID ? "block" : "none",
                    }}
                >
                    <Settings
                        currentUser={currentUser}
                        setCurrentUser={setCurrentUser}
                        isAdmin={isAdmin}
                        showRelevance={settings.show_relevance ?? false}
                        setShowRelevance={(value) => {
                            // Um `setShowRelevance` zu implementieren, müssten wir den Context erweitern.
                            // Vorerst verwenden wir den lokalen State.
                            setShowRelevance(value);
                        }}
                        setLoggedIn={setLoggedIn}
                        setExecutingEvent={setExecutingEvent}
                        appActiveTab={activeTab}
                        swapBack={swapBack}
                    />
                </div>
            </div>

            {confirmLogout && (
                <ConfirmModal
                    title="Logout Bestätigen"
                    message="Möchten Sie sich wirklich abmelden?"
                    isDanger={false}
                    onConfirm={handleLogout}
                    onCancel={() => setConfirmLogout(false)}
                />
            )}

            {(scanningFiles ||
                actualizingIndex ||
                loadingIndex ||
                searchingFiles ||
                findingOldFiles ||
                processingPDF ||
                executingEvent) && (
                <div className="spinner-container overlay">
                    <p>{/* ... (Spinner-Text bleibt gleich) ... */}</p>
                    <div className="spinner" />
                </div>
            )}

            {showHelpModal && <Help onClose={() => setShowHelpModal(false)} />}
        </>
    );
}

// Die neue App-Wurzelkomponente. Ihre einzige Aufgabe ist es, den Provider zu rendern.
function App() {
    return (
        <SettingsProvider>
            <AppContent />
        </SettingsProvider>
    );
}

export default App;
