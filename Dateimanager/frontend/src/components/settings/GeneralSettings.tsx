import React, { useCallback, useEffect } from "react";

// --- Type Definitions ---
interface GeneralSettingsProps {
  themeName: string;
  setThemeName: React.Dispatch<React.SetStateAction<string>>;
  fontType: string;
  setFontType: React.Dispatch<React.SetStateAction<string>>;
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
}

interface AvailableTheme {
  name: string;
  label: string;
}

// --- Component ---
export default function GeneralSettings({
  themeName,
  setThemeName,
  fontSize,
  setFontSize,
}: GeneralSettingsProps) {
  // --- Callback-Funktionen zum Anwenden (OHNE Speichern) ---
  const applyTheme = useCallback((theme: string) => {
    document.body.removeAttribute("data-theme");
    if (theme !== "default") {
      document.body.dataset.theme = theme;
    }
    console.log("Theme angewendet:", theme);
  }, []);

  const applyFontSizeMultiplier = useCallback((multiplier: number) => {
    if (!isNaN(multiplier)) {
      document.documentElement.style.setProperty(
        "--font-size-multiplier",
        multiplier.toString()
      );
      console.log("Font-Size-Multiplier gesetzt:", multiplier);
    }
  }, []);

  // --- Effekt zum Anwenden der Einstellungen beim Laden ---
  useEffect(() => {
    applyTheme(themeName);
    applyFontSizeMultiplier(fontSize);
  }, [themeName, fontSize, applyTheme, applyFontSizeMultiplier]);

  // --- Konfiguration für Auswahlmöglichkeiten ---
  const availableThemes: AvailableTheme[] = [
    { name: "default", label: "Standard (Hell)" },
    { name: "dark", label: "Dunkel" },
    { name: "high-contrast", label: "Hoher Kontrast (Hell)" },
  ];

  // Handler für Theme/Font Radio-Buttons und Slider
  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTheme = event.target.value;
    applyTheme(newTheme);
    setThemeName(newTheme);
  };

  const handleFontSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFontSize = parseFloat(event.target.value);
    applyFontSizeMultiplier(newFontSize);
    setFontSize(newFontSize);
  };

  return (
    <div className="settings-section general-settings">
      <h2>Allgemeine Einstellungen</h2>

      {/* Theme Auswahl */}
      <div className="setting-group">
        <h3>Theme</h3>
        <div className="theme-selector">
          {availableThemes.map((theme) => (
            <label key={theme.name}>
              <input
                type="radio"
                name="theme"
                value={theme.name}
                checked={themeName === theme.name}
                onChange={handleThemeChange}
              />
              {theme.label}
              <span className={`theme-preview ${theme.name}`}></span>
            </label>
          ))}
        </div>
      </div>

      {/* Schriftgröße Auswahl */}
      <div className="setting-group">
        <h3>Schriftgröße</h3>
        <div
          className="font-size-selector"
          style={{ display: "flex", alignItems: "center", gap: "15px" }}
        >
          <label
            htmlFor="fontSizeSlider"
            style={{ flexShrink: 0, marginBottom: 0 }}
          >
            Größe:
          </label>
          <input
            type="range"
            id="fontSizeSlider"
            min="0.8"
            max="1.4"
            step="0.05"
            value={fontSize}
            onChange={handleFontSizeChange}
            style={{ flexGrow: 1, cursor: "pointer" }}
          />
          <span
            style={{
              minWidth: "40px",
              textAlign: "right",
              fontFamily: "var(--font-mono)",
              fontWeight: "500",
            }}
          >
            {fontSize.toFixed(2)}x
          </span>
        </div>
        <p className="setting-description">
          Passt die globale Schriftgröße der Anwendung an (Standard: 1.0x).
        </p>
      </div>
    </div>
  );
}
