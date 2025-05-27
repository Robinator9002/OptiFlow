// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as apiFunctions from "./api/api";
import {
	api as axiosInstance,
	UserRole as ApiUserRole,
	UserPublic,
	UserSettings,
} from "./api/api";
import type { FormPublic, FilledFormPublic } from "./api/api";

// Komponenten
import LoginComponent from "./components/Auth/Login";
import RegisterComponent from "./components/Auth/Register";
import FormEditorContainer from "./components/Editor/FormEditorContainer";
import FormsListComponent from "./components/Forms/FormsList";
import FilledFormsComponent from "./components/Forms/FilledForms";
import SettingsComponent from "./components/Settings/Settings"; // Name beibehalten wie in deinem Upload
import NavbarTop from "./components/Layout/Navbar";
import { ConfirmModal } from "./components/Modals/ConfirmModal";
import {
	ToastProvider,
	useToast,
} from "./components/Layout/ToastNotifications";
import CustomerFormEditor from "./components/Editor/CustomerFormEditor";
import SubmissionViewer from "./components/Editor/SubmissionViewer";
import type { EnrichedSubmission } from "./components/Forms/StaffReceivedFormsView";

import "./App.css"; // Enthält global.css und Settings.css Importe (Annahme)

export type TabKey =
	| "newForm"
	| "formsList"
	| "filledForms"
	| "settings"
	| "fillAssignedForm"
	| "viewSubmissionDetail";

const APP_VERSION = "0.10.1 Presentation Ready";

interface ConfirmModalState {
	isOpen: boolean;
	title?: string;
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
	confirmText?: string;
	cancelText?: string;
	isDanger?: boolean;
}

interface FormToFillDetails {
	id: string;
	name: string;
}

type AuthView = "login" | "register";

// Standardwerte für visuelle Einstellungen
const DEFAULT_THEME = "default";
const DEFAULT_FONT_SIZE_MULTIPLIER = 1.0;

const AppContent: React.FC = () => {
	const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
	const [currentUser, setCurrentUser] = useState<UserPublic | null>(null);
	const [authError, setAuthError] = useState<string | null>(null);
	const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
	const [currentAuthView, setCurrentAuthView] = useState<AuthView>("login");

	const [activeTab, setActiveTab] = useState<TabKey>("formsList");
	const [formToEdit, setFormToEdit] = useState<FormPublic | null>(null);
	const [formToFill, setFormToFill] = useState<FormToFillDetails | null>(null);
	const [submissionToView, setSubmissionToView] =
		useState<EnrichedSubmission | null>(null);
	const [editorInstanceKey, setEditorInstanceKey] =
		useState<string>("initial-editor-key");

	const [isLoading, setIsLoading] = useState<boolean>(false); // Genereller Ladezustand
	const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>(
		{ isOpen: false, message: "", onConfirm: () => {}, onCancel: () => {} }
	);

	// NEU: State für die geladenen Benutzereinstellungen
	const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

	const { addToast } = useToast();
	const showConfirmModal = useCallback(
		/* ... unverändert ... */
		(
			config: Omit<ConfirmModalState, "isOpen" | "onCancel"> & {
				onCancel?: () => void;
			}
		) => {
			setConfirmModalState({
				isOpen: true,
				title: config.title,
				message: config.message,
				confirmText: config.confirmText,
				cancelText: config.cancelText,
				isDanger: config.isDanger,
				onConfirm: () => {
					config.onConfirm();
					setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
				},
				onCancel: () => {
					if (config.onCancel) config.onCancel();
					setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
				},
			});
		},
		[]
	);

	// NEU: Funktion zum Anwenden der visuellen Einstellungen
	const applyVisualSettings = useCallback((settings?: UserSettings | null) => {
		const themeToApply = settings?.theme ?? DEFAULT_THEME;
		const fontSizeToApply =
			settings?.font_size_multiplier ?? DEFAULT_FONT_SIZE_MULTIPLIER;

		document.body.setAttribute(
			"data-theme",
			themeToApply === "default" ? "" : themeToApply
		);
		document.documentElement.style.setProperty(
			"--font-size-multiplier",
			fontSizeToApply.toString()
		);
		console.log(
			`[App.tsx] Visual settings applied: Theme=${themeToApply}, FontMultiplier=${fontSizeToApply}`
		);
	}, []);

	const checkLoginStatus = useCallback(async () => {
		setIsLoadingAuth(true);
		setAuthError(null); // Auth-Fehler zurücksetzen
		const token = localStorage.getItem("authToken");
		if (token) {
			if (!axiosInstance.defaults.headers.common["Authorization"]) {
				axiosInstance.defaults.headers.common[
					"Authorization"
				] = `Bearer ${token}`;
			}
			try {
				const userFromServer = await apiFunctions.getCurrentUser(); // Holt User-Daten vom Server
				if (userFromServer) {
					setCurrentUser(userFromServer);
					setIsLoggedIn(true);
					setActiveTab(
						userFromServer.role === ApiUserRole.KUNDE
							? "filledForms"
							: "formsList"
					);

					// NEU: Benutzereinstellungen laden und anwenden, nachdem der Benutzer geladen wurde
					try {
						const settings = await apiFunctions.getMyUserSettings();
						setUserSettings(settings);
						applyVisualSettings(settings);
					} catch (settingsError: any) {
						console.error(
							"Fehler beim Laden der Benutzereinstellungen nach Login:",
							settingsError
						);
						addToast(
							"Fehler beim Laden der Benutzereinstellungen. Standardwerte werden verwendet.",
							"warning"
						);
						applyVisualSettings(); // Wende Standardwerte an
					}
				} else {
					apiFunctions.logoutUser();
					setIsLoggedIn(false);
					setCurrentUser(null);
					setCurrentAuthView("login");
					applyVisualSettings(); // Wende Standardwerte an, wenn kein User
				}
			} catch (e) {
				apiFunctions.logoutUser();
				setIsLoggedIn(false);
				setCurrentUser(null);
				setCurrentAuthView("login");
				applyVisualSettings();
			}
		} else {
			apiFunctions.logoutUser();
			setIsLoggedIn(false);
			setCurrentUser(null);
			setCurrentAuthView("login");
			applyVisualSettings(); // Wende Standardwerte an, wenn kein Token
		}
		setIsLoadingAuth(false);
	}, [addToast, applyVisualSettings]); // applyVisualSettings als Abhängigkeit

	useEffect(() => {
		checkLoginStatus();
	}, [checkLoginStatus]);

	// Effekt, um Einstellungen neu zu laden und anzuwenden, wenn sich currentUser ändert
	// (z.B. nach E-Mail/Username-Änderung und erneutem Login)
	// Dieser Effekt ist vielleicht redundant, wenn checkLoginStatus schon alles abdeckt,
	// aber zur Sicherheit, falls currentUser anderweitig aktualisiert wird.
	useEffect(() => {
		const loadAndApplySettingsForCurrentUser = async () => {
			if (isLoggedIn && currentUser) {
				console.log(
					"[App.tsx] currentUser changed or isLoggedIn, attempting to load/apply settings."
				);
				try {
					const settings = await apiFunctions.getMyUserSettings();
					setUserSettings(settings);
					applyVisualSettings(settings);
				} catch (settingsError: any) {
					console.error(
						"Fehler beim Laden der Benutzereinstellungen bei User-Wechsel:",
						settingsError
					);
					addToast(
						"Fehler beim Laden der Benutzereinstellungen. Standardwerte werden verwendet.",
						"warning"
					);
					applyVisualSettings();
				}
			} else if (!isLoggedIn) {
				// Wenn ausgeloggt, Standardeinstellungen anwenden
				applyVisualSettings();
			}
		};
		loadAndApplySettingsForCurrentUser();
	}, [isLoggedIn, currentUser, addToast, applyVisualSettings]); // Abhängig von isLoggedIn und currentUser

	const availableTabs = useMemo((): TabKey[] => {
		/* ... unverändert ... */
		if (!currentUser) return [];
		const baseTabs: TabKey[] = ["settings"];

		switch (currentUser.role) {
			case ApiUserRole.ADMIN:
				return ["formsList", "newForm", "filledForms", ...baseTabs];
			case ApiUserRole.MITARBEITER:
				return ["formsList", "newForm", "filledForms", ...baseTabs];
			case ApiUserRole.KUNDE:
				return ["filledForms", ...baseTabs];
			default:
				return baseTabs;
		}
	}, [currentUser]);

	useEffect(() => {
		/* ... Tab-Management unverändert ... */
		if (isLoggedIn && currentUser && availableTabs.length > 0) {
			const isCurrentTabValidForRole = availableTabs.includes(activeTab);
			const isContextTab =
				activeTab === "fillAssignedForm" ||
				activeTab === "viewSubmissionDetail";

			if (!isCurrentTabValidForRole && !isContextTab) {
				const fallbackTab =
					currentUser.role === ApiUserRole.KUNDE ? "filledForms" : "formsList";
				setActiveTab(fallbackTab);
			} else if (activeTab === "fillAssignedForm" && !formToFill) {
				setActiveTab("filledForms");
			} else if (activeTab === "viewSubmissionDetail" && !submissionToView) {
				setActiveTab("filledForms");
			}
		} else if (!isLoggedIn) {
			// Handled by currentAuthView
		}
	}, [
		currentUser,
		activeTab,
		availableTabs,
		formToFill,
		submissionToView,
		isLoggedIn,
	]);

	const handleLoginSuccess = async (userWithRole: UserPublic) => {
		// async gemacht
		setCurrentUser(userWithRole);
		setIsLoggedIn(true);
		setAuthError(null);
		setCurrentAuthView("login");
		const initialTab =
			userWithRole.role === ApiUserRole.KUNDE ? "filledForms" : "formsList";
		setActiveTab(initialTab);
		addToast(`Willkommen zurück, ${userWithRole.username}!`, "success");

		// NEU: Einstellungen direkt nach Login laden und anwenden
		try {
			const settings = await apiFunctions.getMyUserSettings();
			setUserSettings(settings);
			applyVisualSettings(settings);
		} catch (settingsError: any) {
			console.error(
				"Fehler beim Laden der Benutzereinstellungen direkt nach Login:",
				settingsError
			);
			addToast(
				"Fehler beim Laden Ihrer persönlichen Einstellungen. Standardansicht wird verwendet.",
				"warning"
			);
			applyVisualSettings(); // Wende Standardwerte an
		}
	};
	const handleLogout = () => {
		showConfirmModal({
			title: "Abmelden bestätigen",
			message: "Möchten Sie sich wirklich abmelden?",
			confirmText: "Abmelden",
			isDanger: true,
			onConfirm: () => {
				apiFunctions.logoutUser();
				setCurrentUser(null);
				setIsLoggedIn(false);
				setFormToEdit(null);
				setFormToFill(null);
				setSubmissionToView(null);
				setCurrentAuthView("login");
				setUserSettings(null); // Benutzereinstellungen zurücksetzen
				applyVisualSettings(); // Standard-Theme/Schriftgröße anwenden
				addToast("Erfolgreich abgemeldet.", "info");
			},
		});
	};

	// Alle anderen Handler-Funktionen (handleTabChange, handleEditForm, etc.) bleiben unverändert
	const handleTabChange = (tab: TabKey) => {
		/* ... unverändert ... */
		if (activeTab === "newForm" && tab !== "newForm") setFormToEdit(null);
		if (activeTab === "fillAssignedForm" && tab !== "fillAssignedForm")
			setFormToFill(null);
		if (activeTab === "viewSubmissionDetail" && tab !== "viewSubmissionDetail")
			setSubmissionToView(null);
		setActiveTab(tab);
	};
	const handleEditForm = (form: FormPublic) => {
		/* ... unverändert ... */
		setFormToEdit(form);
		setEditorInstanceKey(`edit-${form.id}-${Date.now()}`);
		setActiveTab("newForm");
	};
	const navigateToNewFormTab = useCallback(
		async (templateId?: string) => {
			/* ... unverändert ... */
			setIsLoading(true);
			setFormToEdit(null);
			const newKey = `editor_new_${templateId || "empty"}_${Date.now()}`;
			setEditorInstanceKey(newKey);
			setActiveTab("newForm");

			if (templateId) {
				try {
					addToast("Lade Vorlage...", "info", 1500);
					const templateForm = await apiFunctions.getForm(templateId);
					if (templateForm) {
						const newFormInitialState: FormPublic = {
							id: "",
							name: `Kopie von ${templateForm.name}`,
							description: templateForm.description || "",
							version: 1,
							elements: JSON.parse(JSON.stringify(templateForm.elements || [])),
							created_at: undefined,
							updated_at: undefined,
							created_by_id: undefined,
							assigned_to_user_ids: [],
						};
						setFormToEdit(newFormInitialState);
						addToast(
							`Vorlage "${templateForm.name}" erfolgreich geladen.`,
							"success"
						);
					} else {
						addToast(
							`Vorlage mit ID ${templateId} nicht gefunden. Starte leeres Formular.`,
							"error"
						);
					}
				} catch (err: any) {
					addToast(
						`Fehler beim Laden der Vorlage: ${err.message || err}`,
						"error"
					);
					setActiveTab("formsList");
				} finally {
					setIsLoading(false);
				}
			} else {
				setFormToEdit(null);
				setIsLoading(false);
				addToast("Starte neues leeres Formular.", "info");
			}
		},
		[addToast]
	);
	const handleFormActionSuccess = (
		message: string,
		updatedForm?: FormPublic
	) => {
		/* ... unverändert ... */
		addToast(message, "success");
		if (updatedForm && updatedForm.id) {
			setFormToEdit(updatedForm);
			setEditorInstanceKey(`edit-${updatedForm.id}-${Date.now()}`);
			setActiveTab("newForm");
		} else {
			setFormToEdit(null);
			setActiveTab(
				currentUser?.role === ApiUserRole.KUNDE ? "filledForms" : "formsList"
			);
		}
	};
	const handleRegistrationSuccess = (newUser: apiFunctions.UserPublic) => {
		/* ... unverändert ... */
		addToast(
			`Benutzer "${newUser.username}" (${newUser.role}) erfolgreich registriert!`,
			"success"
		);
		setCurrentAuthView("login");
	};
	const handleOpenFormToFill = (formTemplateId: string, formName: string) => {
		/* ... unverändert ... */
		setFormToFill({ id: formTemplateId, name: formName });
		setActiveTab("fillAssignedForm");
	};
	const handleCustomerFormSubmitted = (submittedFormData: FilledFormPublic) => {
		/* ... unverändert ... */
		addToast("Formular erfolgreich eingereicht!", "success");
		setFormToFill(null);
		setActiveTab("filledForms");
	};
	const handleOpenSubmissionViewer = (submission: EnrichedSubmission) => {
		/* ... unverändert ... */
		setSubmissionToView(submission);
		setActiveTab("viewSubmissionDetail");
	};
	const handleCloseSubmissionViewerTab = () => {
		/* ... unverändert ... */
		setSubmissionToView(null);
		setActiveTab("filledForms");
	};
	const handleDeleteSubmission = useCallback(
		async (submission: EnrichedSubmission): Promise<void> => {
			/* ... unverändert ... */
			if (!currentUser || currentUser.role !== ApiUserRole.ADMIN) {
				const errorMsg = "Unzureichende Berechtigungen für diese Aktion.";
				addToast(errorMsg, "error");
				throw new Error(errorMsg);
			}
			if (!submission || !submission.id) {
				const errorMsg = "Der Formular-Eintrag konnte nicht gefunden werden!";
				addToast(errorMsg, "error");
				throw new Error(errorMsg);
			}
			try {
				const response = await apiFunctions.removeFilledForm(submission.id);
				if (!response.found) {
					addToast(`Fehler beim Löschen: ${response.message}`, "error");
					throw new Error(
						response.message || "Fehler beim Löschen auf dem Server."
					);
				}
				addToast(
					`Formular "${submission.formName}" wurde gelöscht!`,
					"warning"
				);
			} catch (err: any) {
				addToast(
					`Ein Fehler ist beim Löschen aufgetreten: ${err.message || err}`,
					"error"
				);
				throw err;
			}
		},
		[currentUser, addToast]
	);

	if (isLoadingAuth) {
		/* ... unverändert ... */
		return (
			<div className="loading-message app-loading-screen">
				Authentifizierung wird geprüft...
			</div>
		);
	}

	if (!isLoggedIn || !currentUser) {
		/* ... unverändert ... */
		if (currentAuthView === "register") {
			return (
				<RegisterComponent
					onRegistrationSuccess={handleRegistrationSuccess}
					addToast={addToast}
					onSwitchToLogin={() => setCurrentAuthView("login")}
				/>
			);
		}
		return (
			<LoginComponent
				onLoginSuccess={handleLoginSuccess}
				setAuthError={(msg) => {
					setAuthError(msg);
					if (msg) addToast(msg, "error");
				}}
				authError={authError}
				onSwitchToRegister={() => setCurrentAuthView("register")}
			/>
		);
	}

	const renderActiveTabContent = () => {
		if (!currentUser) return null; // Sollte nicht passieren, wenn isLoggedIn

		// Sichtbarkeitslogik für Tabs (nur für eingeloggte User)
		// Die Settings-Komponente wird jetzt immer gerendert (außerhalb des switch),
		// aber ihre Sichtbarkeit wird durch CSS gesteuert, basierend auf activeTab.
		// Dies ist nicht ideal für Performance, wenn Settings komplex wird.
		// Eine bessere Lösung wäre, die Settings-Daten in App.tsx zu halten und per Prop weiterzugeben.
		// Für den Moment, um das "Preload" zu erreichen, behalten wir es so bei,
		// aber die Settings-Komponente selbst wird nur angezeigt, wenn activeTab === 'settings'.

		const isSettingsTabActive = activeTab === "settings";

		return (
			<>
				{/* Die Settings-Komponente wird immer gerendert, wenn eingeloggt,
				    damit ihr useEffect zum Laden der Einstellungen frühzeitig ausgeführt werden kann.
				    Ihre tatsächliche Anzeige wird durch CSS oder eine interne Logik gesteuert.
				    Hier wird sie nur angezeigt, wenn der Tab aktiv ist.
				    Die Props für userSettings und applyVisualSettings werden von App.tsx verwaltet.
				*/}
				<div style={{ display: isSettingsTabActive ? "block" : "none" }}>
					<SettingsComponent // Name beibehalten
						currentUser={currentUser}
						addToast={addToast}
						showConfirmModal={showConfirmModal}
						setCurrentUser={setCurrentUser}
						onLogout={handleLogout}
						// NEU: Übergebe die geladenen Einstellungen und die apply-Funktion
						initialUserSettings={userSettings}
						onApplyVisualSettings={applyVisualSettings}
						// onSettingsUpdate wird benötigt, um userSettings in App.tsx zu aktualisieren
						onSettingsUpdate={(updatedSettings) => {
							setUserSettings(updatedSettings);
							applyVisualSettings(updatedSettings); // Direkt anwenden
						}}
					/>
				</div>

				{/* Die anderen Tabs werden nur gerendert, wenn sie aktiv sind */}
				{activeTab === "newForm" &&
					(currentUser.role === ApiUserRole.KUNDE ? (
						<div className="placeholder-component access-denied">
							<h2>Zugriff verweigert</h2>
							<p>Kunden können keine Formulare erstellen.</p>
						</div>
					) : (
						<FormEditorContainer
							key={editorInstanceKey}
							initialForm={formToEdit}
							onFormSaved={handleFormActionSuccess}
							onEditorClosed={() => {
								setFormToEdit(null);
								setActiveTab("formsList");
							}}
							showConfirmModal={showConfirmModal}
							addToast={addToast}
						/>
					))}
				{activeTab === "formsList" &&
					(currentUser.role === ApiUserRole.KUNDE ? (
						<div className="placeholder-component access-denied">
							<h2>Zugriff verweigert</h2>
							<p>Diese Ansicht ist nicht für Kunden.</p>
						</div>
					) : (
						<FormsListComponent
							onEditForm={handleEditForm}
							navigateToNewForm={navigateToNewFormTab}
							showConfirmModal={showConfirmModal}
							addToast={addToast}
						/>
					))}
				{activeTab === "filledForms" && (
					<FilledFormsComponent
						currentUser={currentUser}
						userRole={currentUser.role}
						addToast={addToast}
						onOpenFormToFill={handleOpenFormToFill}
						onViewSubmissionDetails={handleOpenSubmissionViewer}
						onDeleteSubmission={handleDeleteSubmission}
						showConfirmModal={showConfirmModal}
					/>
				)}
				{activeTab === "fillAssignedForm" &&
					(currentUser.role !== ApiUserRole.KUNDE || !formToFill ? (
						(addToast(
							"Kein Formular zum Ausfüllen ausgewählt oder Zugriff verweigert.",
							"warning"
						),
						setActiveTab("filledForms"),
						null)
					) : (
						<CustomerFormEditor
							formTemplateId={formToFill.id}
							formName={formToFill.name}
							currentUser={currentUser}
							onFormSubmitted={handleCustomerFormSubmitted}
							onCloseEditor={() => {
								setFormToFill(null);
								setActiveTab("filledForms");
							}}
							addToast={addToast}
							showConfirmModal={showConfirmModal}
						/>
					))}
				{activeTab === "viewSubmissionDetail" &&
					((currentUser.role !== ApiUserRole.ADMIN &&
						currentUser.role !== ApiUserRole.MITARBEITER) ||
					!submissionToView ? (
						(addToast(
							"Keine Einreichung zum Anzeigen ausgewählt oder Zugriff verweigert.",
							"warning"
						),
						setActiveTab("filledForms"),
						null)
					) : (
						<SubmissionViewer
							submission={submissionToView}
							onCloseViewer={handleCloseSubmissionViewerTab}
						/>
					))}
				{/* Fallback, falls kein spezifischer Tab passt (sollte durch Logik oben abgedeckt sein) */}
				{![
					"newForm",
					"formsList",
					"filledForms",
					"settings",
					"fillAssignedForm",
					"viewSubmissionDetail",
				].includes(activeTab) &&
					(console.warn(
						`Unbekannter aktiver Tab im Switch: ${activeTab}. Wechsle zum Standard.`
					),
					currentUser.role === ApiUserRole.KUNDE
						? setActiveTab("filledForms")
						: setActiveTab("formsList"),
					(<div className="loading-message">Lade Standardansicht...</div>))}
			</>
		);
	};

	return (
		<div className="app-shell">
			{isLoading && (
				<div className="loading-overlay">
					<div>Lade...</div>
				</div>
			)}
			<header className="app-header">
				<div>
					<span className="app-title">Formular Manager</span>{" "}
					<span className="app-title-version">v{APP_VERSION}</span>
				</div>
			</header>
			{isLoggedIn && currentUser && (
				<NavbarTop
					activeTab={activeTab}
					onTabChange={handleTabChange}
					currentUser={currentUser}
					onLogout={handleLogout}
					availableTabs={availableTabs.filter(
						(tab) =>
							tab !== "newForm" &&
							tab !== "fillAssignedForm" &&
							tab !== "viewSubmissionDetail"
					)}
				/>
			)}
			<main className="app-content-area">
				{isLoggedIn && currentUser ? (
					renderActiveTabContent()
				) : currentAuthView === "register" ? (
					<RegisterComponent
						onRegistrationSuccess={handleRegistrationSuccess}
						addToast={addToast}
						onSwitchToLogin={() => setCurrentAuthView("login")}
					/>
				) : (
					<LoginComponent
						onLoginSuccess={handleLoginSuccess}
						setAuthError={setAuthError}
						authError={authError}
						onSwitchToRegister={() => setCurrentAuthView("register")}
					/>
				)}
			</main>
			<ConfirmModal
				isOpen={confirmModalState.isOpen}
				title={confirmModalState.title}
				message={confirmModalState.message}
				onConfirm={confirmModalState.onConfirm}
				onCancel={confirmModalState.onCancel}
				confirmText={confirmModalState.confirmText}
				cancelText={confirmModalState.cancelText}
				isDanger={confirmModalState.isDanger}
			/>
		</div>
	);
};

const App: React.FC = () => {
	return (
		<ToastProvider>
			<AppContent />
		</ToastProvider>
	);
};
export default App;
