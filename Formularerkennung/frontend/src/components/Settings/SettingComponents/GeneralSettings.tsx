// src/components/Settings/SettingComponents/GeneralSettings.tsx
import React from "react";

interface GeneralSettingsTabProps {
	currentTheme: string;
	currentFontSizeMultiplier: number;
	onThemeChange: (newTheme: string) => void;
	onFontSizeChange: (newMultiplier: number) => void;
	showConfirmModal: (config: {
		title?: string;
		message: string;
		onConfirm: () => void;
		onCancel?: () => void;
		confirmText?: string;
		cancelText?: string;
		isDanger?: boolean;
	}) => void;
	onResetToDefaults: () => void;
}

// Theme-Optionen erweitert um "High Contrast"
const availableThemes = [
	{ name: "default", label: "Standard (Hell)" },
	{ name: "dark", label: "Dunkel (Grau)" },
	{ name: "high-contrast", label: "Hoher Kontrast (Hell)" }, // NEUE Option
];

const DEFAULT_THEME = "default"; // Wird von Settings.tsx als Referenz genutzt
const DEFAULT_FONT_SIZE_MULTIPLIER = 1.0;

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
	currentTheme,
	currentFontSizeMultiplier,
	onThemeChange,
	onFontSizeChange,
	showConfirmModal,
	onResetToDefaults,
}) => {
	const handleResetClick = () => {
		showConfirmModal({
			title: "Allgemeine Einstellungen zurücksetzen",
			message:
				"Möchten Sie das Theme und die Schriftgröße wirklich auf die Standardwerte zurücksetzen? Ihre aktuellen, nicht gespeicherten Änderungen in diesem Tab gehen dabei verloren.",
			confirmText: "Ja, zurücksetzen",
			cancelText: "Abbrechen",
			isDanger: true,
			onConfirm: () => {
				onResetToDefaults();
			},
		});
	};

	return (
		<div className="settings-tab-content general-settings-tab">
			<h2>Allgemeine Einstellungen</h2>
			<p
				className="setting-description"
				style={{ marginBottom: "var(--spacing-lg)" }}
			>
				Passen Sie hier das Erscheinungsbild der Anwendung an. Die Änderungen
				werden sofort als Vorschau angezeigt und können mit Strg+S (Cmd+S) oder
				dem Button am Ende der Seite gespeichert werden.
			</p>

			{/* Theme Auswahl */}
			<div className="setting-group">
				<h3>Theme</h3>
				<div className="theme-selector setting-options-group">
					{availableThemes.map(
						(
							theme // Nutzt jetzt die erweiterte Liste
						) => (
							<label
								key={theme.name}
								className="radio-label"
								title={`Theme ${theme.label} auswählen`}
							>
								<input
									type="radio"
									name="theme"
									value={theme.name}
									checked={currentTheme === theme.name}
									onChange={(e) => onThemeChange(e.target.value)}
								/>
								<span className="radio-custom"></span>
								{theme.label}
							</label>
						)
					)}
				</div>
				<p className="setting-description">
					Wählen Sie das gewünschte Farbschema für die Benutzeroberfläche.
				</p>
			</div>

			{/* Schriftgröße Auswahl */}
			<div className="setting-group">
				<h3>Schriftgröße</h3>
				<div
					className="font-size-selector setting-options-group"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--spacing-md)",
					}}
				>
					<label
						htmlFor="fontSizeSlider"
						style={{ flexShrink: 0, marginBottom: 0 }}
						className="font-size-slider-label"
					>
						Multiplikator:
					</label>
					<input
						type="range"
						id="fontSizeSlider"
						min="0.8"
						max="1.5"
						step="0.05"
						value={currentFontSizeMultiplier}
						onChange={(e) => onFontSizeChange(parseFloat(e.target.value))}
						style={{
							flexGrow: 1,
							cursor: "pointer",
							accentColor: "var(--primary-color)",
						}}
						title={`Aktueller Schriftgrößen-Multiplikator: ${currentFontSizeMultiplier.toFixed(
							2
						)}x`}
					/>
					<span
						className="font-size-value-display"
						style={{
							minWidth: "45px",
							textAlign: "right",
							fontFamily: "var(--font-mono)",
							fontWeight: "500",
						}}
					>
						{currentFontSizeMultiplier.toFixed(2)}x
					</span>
				</div>
				<p className="setting-description">
					Passt die globale Schriftgröße der Anwendung an (Standard:{" "}
					{DEFAULT_FONT_SIZE_MULTIPLIER.toFixed(2)}x).
				</p>
			</div>

			{/* Button zum Zurücksetzen der allgemeinen Einstellungen */}
			<div className="setting-group reset-general-settings-group">
				<h3>Auf Standard zurücksetzen</h3>
				<p className="setting-description">
					Setzt Theme und Schriftgröße in der Vorschau auf die Standardwerte
					zurück. Vergessen Sie nicht, die Änderungen anschließend zu speichern,
					wenn Sie diese behalten möchten.
				</p>
				<button
					onClick={handleResetClick}
					className="button button-secondary button-danger"
					style={{ marginTop: "var(--spacing-sm)" }}
					title="Setzt Theme und Schriftgröße auf Standardwerte zurück (Vorschau)"
				>
					Vorschau zurücksetzen
				</button>
			</div>
		</div>
	);
};

export default GeneralSettingsTab;
