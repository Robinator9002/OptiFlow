import { useState, useEffect, useCallback, useContext, useRef } from "react";
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
import { ChangePassword } from "./components/settings/ChangePassword.tsx";
import { Help } from "./components/Help.tsx";
import {
	getScannerConfig,
	autoLogin,
	getUserAdminStatus,
	getResetPasswordStatus,
	getUserSettings,
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

function App() {
	const [activeTab, setActiveTab] = useState("search");
	const [lastActiveTab, setLastActiveTab] = useState("search");
	const [configs, setConfigs] = useState<any | null>(null); // Typ ggf. genauer definieren
	const [scanningFiles, setScanningFiles] = useState(false);
	const [loadingIndex, setLoadingIndex] = useState(false);
	const [actualizingIndex, setActualizingIndex] = useState(false);
	const [searchingFiles, setSearchingFiles] = useState(false);
	const [processingPDF, setProcessingPDF] = useState(false);
	const [findingOldFiles, setFindingOldFiles] = useState(false);
	const [executingEvent, setExecutingEvent] = useState(false);
	const [loggedIn, setLoggedIn] = useState(false);
	const [autoLoginUser, setAutoLoginUser] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [resetPassword, setResetPassword] = useState(false);
	const [confirmLogout, setConfirmLogout] = useState(false);
	const [selectedFile, setSelectedFile] = useState<any | null>(null); // Typ ggf. anpassen
	const [showRelevance, setShowRelevance] = useState(false);
	const [showHelpModal, setShowHelpModal] = useState(false); // State für Hilfe-Modal

	const { applySettings, isReady } = useContext(SettingsContext);

	const appContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		async function fetchAdminStatus() {
			if (autoLoginUser) {
				try {
					const adminStatus = await getUserAdminStatus(autoLoginUser);
					setIsAdmin(adminStatus.isAdmin);
				} catch (error) {
					console.error("Fehler beim Abrufen des Admin-Status:", error);
					toast.error("Fehler beim Abrufen des Admin-Status.");
				}
			}
		}
		fetchAdminStatus();

		async function fetchResetPassword() {
			if (autoLoginUser) {
				try {
					const resetPasswordStatus = await getResetPasswordStatus(
						autoLoginUser
					);
					setResetPassword(resetPasswordStatus.passwordReset);
				} catch (error) {
					console.error(
						"Fehler beim Abrufen des Passwort-Reset-Status:",
						error
					);
					toast.error("Fehler beim Abrufen des Passwort-Reset-Status.");
				}
			}
		}
		fetchResetPassword();

		async function fetchConfig() {
			if (activeTab === "scanner" && isAdmin) {
				try {
					const configData = await getScannerConfig();
					setConfigs(configData.config);
				} catch (error) {
					console.error("Fehler beim Laden der Scanner-Konfiguration:", error);
					toast.error("Fehler beim Laden der Scanner-Konfiguration.");
				}
			}
		}
		if (loggedIn) {
			fetchConfig();
		}
	}, [autoLoginUser, activeTab, loggedIn, isAdmin]);

	const loadAndApplySettings = useCallback(
		async (username: string) => {
			if (!isReady) {
				console.warn(
					"SettingsContext noch nicht bereit für loadAndApplySettings."
				);
				// Optional: Kurze Wartezeit und erneuter Versuch oder andere Logik
				setTimeout(() => loadAndApplySettings(username), 200);
				return;
			}
			try {
				const response = await getUserSettings(username);
				if (response?.settings) {
					applySettings(response.settings);
				} else {
					console.warn(
						"Keine Einstellungen vom Server erhalten, Standardeinstellungen werden verwendet."
					);
				}
			} catch (error) {
				console.error("Fehler beim Laden der Benutzereinstellungen:", error);
				toast.error(
					"Fehler beim Laden der Benutzereinstellungen. Standardeinstellungen werden verwendet."
				);
			}
		},
		[applySettings, isReady]
	);

	useEffect(() => {
		async function checkAutoLogin() {
			const storedUsername = localStorage.getItem("lastUsername");
			if (storedUsername) {
				try {
					await autoLogin(storedUsername);
					setLoggedIn(true);
					setAutoLoginUser(storedUsername);
					if (isReady) {
						// Direkt laden, wenn Context bereit ist
						loadAndApplySettings(storedUsername);
						// Toast hier, da Auto-Login erfolgreich und Einstellungen geladen werden (oder wurden)
						toast.success(
							`Der Nutzer ${storedUsername} wurde automatisch angemeldet.`
						);
					}
					// Falls isReady noch nicht true ist, wird loadAndApplySettings durch den useCallback getriggert,
					// sobald isReady sich ändert (siehe Abhängigkeiten von loadAndApplySettings).
				} catch (error) {
					console.error("Auto-Login fehlgeschlagen:", error);
					localStorage.removeItem("lastUsername");
					setLoggedIn(false);
					setAutoLoginUser(null);
				}
			}
		}
		checkAutoLogin();
	}, [isReady, loadAndApplySettings]); // loadAndApplySettings hat isReady als Abhängigkeit

	const handleLoginSuccess = async (username: string) => {
		localStorage.setItem("lastUsername", username);
		setLoggedIn(true);
		setAutoLoginUser(username);
		if (isReady) {
			await loadAndApplySettings(username);
			toast.success(`Der Nutzer ${username} wurde erfolgreich angemeldet.`);
		} else {
			// Fallback, falls isReady beim Login noch nicht true war
			const waitForReadyLogin = async () => {
				if (isReady) {
					await loadAndApplySettings(username);
					toast.success(`Der Nutzer ${username} wurde erfolgreich angemeldet.`);
				} else {
					setTimeout(waitForReadyLogin, 100);
				}
			};
			waitForReadyLogin();
		}
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
			if (autoLoginUser) logoutUser(autoLoginUser);
			localStorage.removeItem("lastUsername");
			setLoggedIn(false);
			setAutoLoginUser(null);
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
				tab === "dedupe")
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

			if (confirmLogout || resetPassword) {
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

			// Die folgenden globalen Shortcuts nicht ausführen, wenn ein Input fokussiert ist,
			// außer es sind explizit erlaubte Kombinationen (z.B. Browser-Shortcuts)
			if (isInputFocused) {
				// Erlaube normales Tab-Verhalten in Inputs
				if (event.key === "Tab" && !event.ctrlKey && !event.shiftKey) return;
				// Erlaube Browser Strg+Tab / Strg+Shift+Tab
				if (event.ctrlKey && event.key === "Tab") return;
				// Für andere Ctrl-Shortcuts in Inputs, die nicht hier behandelt werden: return
				if (
					event.ctrlKey &&
					!(parseInt(event.key) >= 1 && parseInt(event.key) <= TAB_ORDER.length)
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
				// Ctrl+Tab oder Tab außerhalb von Inputs
				event.preventDefault();
				const currentIndex = TAB_ORDER.indexOf(activeTab);
				let nextIndex;
				if (event.shiftKey || event.ctrlKey) {
					nextIndex =
						currentIndex <= 0 ? TAB_ORDER.length - 1 : currentIndex - 1;
				} else {
					nextIndex =
						currentIndex >= TAB_ORDER.length - 1 ? 0 : currentIndex + 1;
				}

				let guard = 0;
				let originalNextIndex = nextIndex; // Um Endlosschleife bei nur Admin-Tabs zu erkennen
				do {
					if (
						isAdmin ||
						!["dedupe", "old-files", "scanner", "pdf-to-ocr"].includes(
							TAB_ORDER[nextIndex]
						)
					) {
						break; // Gültiger Tab gefunden
					}
					// Nächsten Tab versuchen
					if (event.shiftKey || event.ctrlKey) {
						nextIndex = nextIndex <= 0 ? TAB_ORDER.length - 1 : nextIndex - 1;
					} else {
						nextIndex = nextIndex >= TAB_ORDER.length - 1 ? 0 : nextIndex + 1;
					}
					guard++;
				} while (guard < TAB_ORDER.length && nextIndex !== originalNextIndex);

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
	}, [
		activeTab,
		isAdmin,
		handleTabChange,
		showHelpModal,
		confirmLogout,
		resetPassword,
	]);

	if (!loggedIn) {
		return <Login onLoginSuccess={handleLoginSuccess} />;
	}

	return (
		<SettingsProvider>
			{" "}
			{/* SettingsProvider umschließt den gesamten App-Inhalt */}
			<>
				{resetPassword && autoLoginUser && (
					<div className="app-container overlay">
						<ChangePassword
							currentUser={autoLoginUser}
							password={""}
							onLogout={() => {
								setResetPassword(false);
							}}
							onCancel={() => {
								if (autoLoginUser) logoutUser(autoLoginUser);
								handleLogout();
								setResetPassword(false);
							}}
						/>
					</div>
				)}

				<div className="app-container" ref={appContainerRef} tabIndex={-1}>
					<ToastContainer
						position="top-right"
						autoClose={3000}
						hideProgressBar={false}
						aria-label="Benachrichtigungsbereich"
					/>
					<header>
						<div style={{ display:"flex", flexDirection:"row", gap:"0.05rem"}}>
						<img src={myAppIcon} alt="App Icon" width="45" height="45" />
						<h1>OptiFlow Dateimanager</h1>
						</div>
						<div className="user-container">
							{autoLoginUser && <p>Angemeldet als: {autoLoginUser}</p>}
							<div className="user-container-buttons">
								<button
									className={`tab ${
										activeTab === SETTINGS_TAB_ID ? "active" : ""
									} settings-tab-button`}
									onClick={() => handleTabChange(SETTINGS_TAB_ID)}
									data-tab={SETTINGS_TAB_ID}
									disabled={!autoLoginUser}
									title="Einstellungen öffnen (Strg + ,)"
								>
									⚙️ Einstellungen
								</button>
								<button onClick={() => setConfirmLogout(true)} title="Abmelden">
									Logout
								</button>
							</div>
						</div>
					</header>

					<div className="tabs">
						{TAB_ORDER.map((tabId) => {
							let tabLabel = "";
							let isDisabled =
								!isAdmin &&
								["dedupe", "old-files", "scanner", "pdf-to-ocr"].includes(
									tabId
								);
							switch (tabId) {
								case "search":
									tabLabel = "Suche & Vorschau";
									break;
								case "dedupe":
									tabLabel = "Entduplizierung";
									break;
								case "old-files":
									tabLabel = "Vergessene Dateien";
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
									className={`tab ${activeTab === tabId ? "active" : ""}`}
									onClick={() => handleTabChange(tabId)}
									data-tab={tabId}
									disabled={isDisabled}
									style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}
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
						<div className="tab-content dedupe-tab">
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
							<ScannerConfig configs={configs} setConfigs={setConfigs} />
						</div>
					)}

					{activeTab === "pdf-to-ocr" && isAdmin && (
						<div className="tab-content pdf-to-ocr-tab">
							<PDFProcessor setProcessingPDF={setProcessingPDF} />
						</div>
					)}

					<div
						className="tab-content settings-tab"
						style={{
							display: activeTab === SETTINGS_TAB_ID ? "block" : "none",
						}}
					>
						<Settings
							currentUser={autoLoginUser}
							setCurrentUser={setAutoLoginUser}
							isAdmin={isAdmin}
							showRelevance={showRelevance}
							setShowRelevance={setShowRelevance}
							setLoggedIn={setLoggedIn}
							setExecutingEvent={setExecutingEvent}
							appActiveTab={activeTab}
							swapBack={swapBack}
							onRegister={null}
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
						<p>
							{scanningFiles
								? "Scannen..."
								: actualizingIndex
								? "Aktualisieren..."
								: loadingIndex
								? "Laden..."
								: searchingFiles || findingOldFiles
								? "Suchen..."
								: processingPDF
								? "Verarbeiten..."
								: executingEvent
								? "Event wird ausgeführt..."
								: "Laden..."}
						</p>
						<div className="spinner" />
					</div>
				)}

				{showHelpModal && <Help onClose={() => setShowHelpModal(false)} />}
			</>
		</SettingsProvider>
	);
}

export default App;
