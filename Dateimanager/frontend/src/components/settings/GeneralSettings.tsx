import React, { useCallback, useEffect } from "react";

// --- Type Definitions ---
interface GeneralSettingsProps {
    themeName: string;
    setThemeName: React.Dispatch<React.SetStateAction<string>>;
    fontSize: number;
    setFontSize: React.Dispatch<React.SetStateAction<number>>;
}

interface AvailableTheme {
    name: "default" | "dark" | "high-contrast";
    label: string;
}

// --- Component ---
export default function GeneralSettings({
    themeName,
    setThemeName,
    fontSize,
    setFontSize,
}: GeneralSettingsProps) {
    // Wendet das ausgewählte Theme auf das `body`-Element an.
    const applyTheme = useCallback((theme: string) => {
        // Entfernt zuerst alle vorherigen Theme-Attribute
        document.body.removeAttribute("data-theme");
        // Setzt das neue Theme, außer es ist das Standard-Theme
        if (theme !== "default") {
            document.body.dataset.theme = theme;
        }
    }, []);

    // Wendet den Multiplikator für die Schriftgröße auf das `html`-Element an.
    const applyFontSizeMultiplier = useCallback((multiplier: number) => {
        if (!isNaN(multiplier)) {
            document.documentElement.style.setProperty(
                "--font-size-multiplier",
                multiplier.toString()
            );
        }
    }, []);

    // Effekt, der die visuellen Einstellungen beim Laden der Komponente anwendet.
    useEffect(() => {
        applyTheme(themeName);
        applyFontSizeMultiplier(fontSize);
    }, [themeName, fontSize, applyTheme, applyFontSizeMultiplier]);

    // Verfügbare Themes für die Auswahl
    const availableThemes: AvailableTheme[] = [
        { name: "default", label: "Standard (Hell)" },
        { name: "dark", label: "Dunkel" },
        { name: "high-contrast", label: "Hoher Kontrast" },
    ];

    // Handler für die Änderung des Themes
    const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newTheme = event.target.value;
        applyTheme(newTheme);
        setThemeName(newTheme);
    };

    // Handler für die Änderung der Schriftgröße
    const handleFontSizeChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const newFontSize = parseFloat(event.target.value);
        applyFontSizeMultiplier(newFontSize);
        setFontSize(newFontSize);
    };

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>Allgemein</h2>
            </div>

            {/* Theme Auswahl */}
            <div className="setting-group">
                <h3>Erscheinungsbild</h3>
                <div className="theme-selector">
                    <div className="theme-options">
                        {availableThemes.map((theme) => (
                            <label key={theme.name} className="radio-label">
                                <input
                                    type="radio"
                                    name="theme"
                                    value={theme.name}
                                    checked={themeName === theme.name}
                                    onChange={handleThemeChange}
                                />
                                {theme.label}
                                <span
                                    className={`theme-preview ${theme.name}`}
                                ></span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Schriftgröße Auswahl */}
            <div className="setting-group">
                <h3>Barrierefreiheit</h3>
                <div className="font-size-selector">
                    <div className="font-size-controls">
                        <label htmlFor="fontSizeSlider" className="radio-label">
                            Schriftgröße
                        </label>
                        <input
                            type="range"
                            id="fontSizeSlider"
                            min="0.8"
                            max="1.4"
                            step="0.05"
                            value={fontSize}
                            onChange={handleFontSizeChange}
                        />
                        <span className="font-size-value">
                            {fontSize.toFixed(2)}x
                        </span>
                    </div>
                    <p className="setting-description">
                        Passt die globale Schriftgröße der Anwendung an
                        (Standard: 1.00x).
                    </p>
                </div>
            </div>
        </div>
    );
}
