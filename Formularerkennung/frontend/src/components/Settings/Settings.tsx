// src/components/Settings/Settings.tsx
import React, { useState, useEffect, useCallback } from "react";
import * as api from "../../api/api"; // Pfad zu deiner api.ts Datei
import type {
	UserPublic,
	UserSettings as UserSettingsData,
	UserSettingsUpdatePayload,
} from "../../api/api";
import GeneralSettingsTab from "./SettingComponents/GeneralSettings";
import UserAccountSettingsTab from "./SettingComponents/UserAccountSettings";
// import './Settings.css'; // CSS-Datei für Styling

// Definiere die Typen für die Props, die von App.tsx kommen
interface SettingsProps {
	currentUser: UserPublic | null;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
	showConfirmModal: (config: {
		title?: string;
		message: string;
		onConfirm: () => void;
		onCancel?: () => void;
		confirmText?: string;
		cancelText?: string;
		isDanger?: boolean;
	}) => void;
	setCurrentUser: (user: UserPublic | null) => void;
	onLogout: () => void;
	// NEU: Props von App.tsx für vorab geladene Einstellungen und Callbacks
	initialUserSettings: UserSettingsData | null;
	onApplyVisualSettings: (settings?: UserSettingsData | null) => void;
	onSettingsUpdate: (updatedSettings: UserSettingsData) => void;
}

type ActiveSettingsTab = "general" | "userAccount";

// Standardwerte, falls keine Einstellungen geladen werden können oder für Reset
const DEFAULT_THEME = "default";
const DEFAULT_FONT_SIZE_MULTIPLIER = 1.0;

const Settings: React.FC<SettingsProps> = ({
	currentUser,
	addToast,
	showConfirmModal,
	setCurrentUser,
	onLogout,
	initialUserSettings, // Neuer Prop
	onApplyVisualSettings, // Neuer Prop
	onSettingsUpdate, // Neuer Prop
}) => {
	const [activeTab, setActiveTab] = useState<ActiveSettingsTab>("general");

	// isLoading und error sind jetzt primär für Speicheraktionen relevant,
	// da das initiale Laden in App.tsx passiert.
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null); // Fehler für Speicheraktionen

	// States für *geänderte, aber noch nicht gespeicherte* allgemeine Einstellungen
	// Werden mit den initialUserSettings initialisiert.
	const [pendingTheme, setPendingTheme] = useState<string>(
		initialUserSettings?.theme ?? DEFAULT_THEME
	);
	const [pendingFontSizeMultiplier, setPendingFontSizeMultiplier] =
		useState<number>(
			initialUserSettings?.font_size_multiplier ?? DEFAULT_FONT_SIZE_MULTIPLIER
		);

	// Effekt, um pendingStates zu aktualisieren, wenn sich initialUserSettings von App.tsx ändern
	// (z.B. nach dem allerersten Laden in App.tsx oder wenn sie extern aktualisiert würden)
	useEffect(() => {
		setPendingTheme(initialUserSettings?.theme ?? DEFAULT_THEME);
		setPendingFontSizeMultiplier(
			initialUserSettings?.font_size_multiplier ?? DEFAULT_FONT_SIZE_MULTIPLIER
		);
		// Die visuellen Einstellungen wurden bereits in App.tsx angewendet.
		// Hier ist kein erneuter Aufruf von onApplyVisualSettings nötig, es sei denn,
		// es gäbe einen Fall, wo initialUserSettings sich ändern, *nachdem* Settings gemountet wurde
		// und App.tsx die visuellen Settings nicht neu angewendet hätte.
		// Zur Sicherheit könnte man es hier tun, aber es sollte durch App.tsx abgedeckt sein.
		// onApplyVisualSettings(initialUserSettings);
	}, [
		initialUserSettings /*, onApplyVisualSettings // onApplyVisualSettings ist stabil */,
	]);

	const handleTabChange = (tabId: ActiveSettingsTab) => {
		setActiveTab(tabId);
	};

	// Handler für Änderungen in den allgemeinen Einstellungen (von GeneralSettingsTab)
	const handleGeneralSettingChange = useCallback(
		(settingKey: "theme" | "fontSize", value: string | number) => {
			let newTheme = pendingTheme;
			let newFontSize = pendingFontSizeMultiplier;

			if (settingKey === "theme" && typeof value === "string") {
				newTheme = value;
				setPendingTheme(value);
			} else if (settingKey === "fontSize" && typeof value === "number") {
				newFontSize = value;
				setPendingFontSizeMultiplier(value);
			}
			// Rufe onApplyVisualSettings auf, das von App.tsx kommt, um die Live-Vorschau global zu steuern
			onApplyVisualSettings({
				theme: newTheme,
				font_size_multiplier: newFontSize,
			});
		},
		[pendingTheme, pendingFontSizeMultiplier, onApplyVisualSettings]
	);

	const handleResetGeneralSettingsToDefaults = useCallback(() => {
		setPendingTheme(DEFAULT_THEME);
		setPendingFontSizeMultiplier(DEFAULT_FONT_SIZE_MULTIPLIER);
		// Wende die Standardeinstellungen auch visuell an (Live-Vorschau)
		onApplyVisualSettings({
			theme: DEFAULT_THEME,
			font_size_multiplier: DEFAULT_FONT_SIZE_MULTIPLIER,
		});
		addToast(
			"Allgemeine Einstellungen (Vorschau) auf Standard zurückgesetzt. Klicken Sie auf 'Speichern', um die Änderungen zu übernehmen.",
			"info",
			5000
		);
	}, [onApplyVisualSettings, addToast]);

	const handleSaveGeneralSettings = useCallback(async () => {
		let changesMade = false;
		const currentLoadedTheme = initialUserSettings?.theme ?? DEFAULT_THEME;
		const currentLoadedFontSize =
			initialUserSettings?.font_size_multiplier ?? DEFAULT_FONT_SIZE_MULTIPLIER;

		if (pendingTheme !== currentLoadedTheme) changesMade = true;
		if (pendingFontSizeMultiplier !== currentLoadedFontSize) changesMade = true;

		if (!changesMade) {
			addToast("Keine Änderungen zum Speichern vorhanden.", "info");
			return;
		}

		setIsLoading(true);
		setError(null);
		try {
			const payload: UserSettingsUpdatePayload = {};
			if (pendingTheme !== currentLoadedTheme) {
				payload.theme = pendingTheme;
			}
			if (pendingFontSizeMultiplier !== currentLoadedFontSize) {
				payload.font_size_multiplier = pendingFontSizeMultiplier;
			}

			// Nur speichern, wenn es tatsächlich etwas zu senden gibt, das sich geändert hat
			if (Object.keys(payload).length > 0) {
				const updatedSettings = await api.updateMyUserSettings(payload);
				// Informiere App.tsx über die erfolgreiche Aktualisierung
				onSettingsUpdate(updatedSettings);
				// Aktualisiere pending states mit den *gespeicherten* Werten
				setPendingTheme(updatedSettings.theme ?? DEFAULT_THEME);
				setPendingFontSizeMultiplier(
					updatedSettings.font_size_multiplier ?? DEFAULT_FONT_SIZE_MULTIPLIER
				);
				addToast(
					"Allgemeine Einstellungen erfolgreich gespeichert!",
					"success"
				);
			} else {
				addToast(
					"Keine Änderungen zum Speichern festgestellt (Werte sind wie serverseitig).",
					"info"
				);
			}
		} catch (err: any) {
			const errorMessage =
				err.message || "Fehler beim Speichern der allgemeinen Einstellungen.";
			setError(errorMessage); // Fehler im UI anzeigen (optional)
			addToast(errorMessage, "error");
			// Bei Fehler die pending States auf die zuletzt *geladenen* (oder Default) Werte zurücksetzen
			// und die visuelle Darstellung ebenfalls zurücksetzen.
			setPendingTheme(initialUserSettings?.theme ?? DEFAULT_THEME);
			setPendingFontSizeMultiplier(
				initialUserSettings?.font_size_multiplier ??
					DEFAULT_FONT_SIZE_MULTIPLIER
			);
			onApplyVisualSettings(initialUserSettings); // Wende die ursprünglichen/Default-Einstellungen wieder an
		} finally {
			setIsLoading(false);
		}
	}, [
		addToast,
		pendingTheme,
		pendingFontSizeMultiplier,
		initialUserSettings,
		onSettingsUpdate,
		onApplyVisualSettings,
	]);

	// Keyboard shortcut für Speichern der allgemeinen Einstellungen
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "s") {
				if (activeTab === "general") {
					event.preventDefault();
					handleSaveGeneralSettings();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [activeTab, handleSaveGeneralSettings]);

	// Da das initiale Laden jetzt in App.tsx passiert, ist hier keine primäre Ladeanzeige mehr nötig,
	// es sei denn, initialUserSettings ist initial null und wird erst später von App.tsx gefüllt.
	// Für den Moment gehen wir davon aus, dass App.tsx initialUserSettings übergibt, sobald verfügbar.
	// if (isLoading && !initialUserSettings && activeTab === 'general') {
	//     return <div className="settings-loading">Lade Einstellungen...</div>;
	// }
	// if (error && !initialUserSettings && activeTab === 'general') {
	//     return <div className="settings-error">Fehler: {error}</div>;
	// }

	if (!currentUser) {
		// Sollte nicht passieren, da Settings nur für eingeloggte User angezeigt wird
		return (
			<div className="settings-error">
				Benutzer nicht geladen. Bitte neu anmelden.
			</div>
		);
	}

	return (
		<div className="settings-container">
			<header className="settings-header">
				<h1>Einstellungen</h1>
			</header>
			<nav className="settings-tab-nav">
				<button
					className={`settings-tab-button ${
						activeTab === "general" ? "active" : ""
					}`}
					onClick={() => handleTabChange("general")}
					aria-selected={activeTab === "general"}
				>
					Allgemein
				</button>
				<button
					className={`settings-tab-button ${
						activeTab === "userAccount" ? "active" : ""
					}`}
					onClick={() => handleTabChange("userAccount")}
					aria-selected={activeTab === "userAccount"}
				>
					Nutzereinstellungen
				</button>
			</nav>

			<main className="settings-content">
				{activeTab === "general" && (
					<GeneralSettingsTab
						currentTheme={pendingTheme} // Verwende immer pending für die UI
						currentFontSizeMultiplier={pendingFontSizeMultiplier}
						onThemeChange={(newTheme) =>
							handleGeneralSettingChange("theme", newTheme)
						}
						onFontSizeChange={(newMultiplier) =>
							handleGeneralSettingChange("fontSize", newMultiplier)
						}
						showConfirmModal={showConfirmModal}
						onResetToDefaults={handleResetGeneralSettingsToDefaults}
					/>
				)}
				{activeTab === "userAccount" && (
					<UserAccountSettingsTab
						currentUser={currentUser}
						addToast={addToast}
						showConfirmModal={showConfirmModal}
						setCurrentUserGlobal={setCurrentUser}
						onLogout={onLogout}
					/>
				)}

				{activeTab === "general" && (
					<div className="settings-actions-footer">
						<button
							onClick={handleSaveGeneralSettings}
							className="button button-primary"
							disabled={isLoading}
							title="Allgemeine Einstellungen speichern (Strg+S)"
						>
							{isLoading
								? "Speichere..."
								: "Allgemeine Einstellungen speichern"}
						</button>
					</div>
				)}
			</main>
		</div>
	);
};

export default Settings;
