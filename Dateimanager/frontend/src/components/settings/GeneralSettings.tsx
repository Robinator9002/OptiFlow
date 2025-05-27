import React, { useCallback, useEffect } from 'react';

export default function GeneralSettings({
    themeName,
    setThemeName,
    fontType,
    setFontType,
    fontSize,
    setFontSize
}) {
    // --- Callback-Funktionen zum Anwenden (OHNE Speichern) ---
    const applyTheme = useCallback((themeName) => {
        document.body.removeAttribute('data-theme');
        if (themeName !== 'default') {
            document.body.dataset.theme = themeName;
        }
        console.log("Theme angewendet:", themeName);
    }, []);

    const applyFont = useCallback((fontVarName) => {
        document.body.dataset.font = fontVarName;
        console.log("Font-Attribut gesetzt:", fontVarName);
    }, []);

    const applyFontSizeMultiplier = useCallback((multiplier) => {
        const numMultiplier = parseFloat(multiplier);
        if (!isNaN(numMultiplier)) {
            document.documentElement.style.setProperty('--font-size-multiplier', numMultiplier.toString());
            console.log("Font-Size-Multiplier gesetzt:", numMultiplier);
        }
    }, []);

    // --- Effekt zum Anwenden der Einstellungen beim Laden ---
    useEffect(() => {
        applyTheme(themeName);
        applyFont(fontType);
        applyFontSizeMultiplier(fontSize);
    }, [themeName, fontType, fontSize, applyTheme, applyFont, applyFontSizeMultiplier]);

    // --- Konfiguration für Auswahlmöglichkeiten ---
    const availableThemes = [
        { name: 'default', label: 'Standard (Hell)' },
        { name: 'dark', label: 'Dunkel' },
        { name: 'high-contrast', label: 'Hoher Kontrast (Hell)' },
    ];

    const availableFonts = [
        { name: 'sans-serif', label: 'Sans-Serif', cssVar: 'var(--font-sans)' },
        { name: 'serif', label: 'Serif', cssVar: 'var(--font-serif)' },
        { name: 'monospace', label: 'Monospace', cssVar: 'var(--font-mono)' }
    ];

    // Handler für Theme/Font Radio-Buttons und Slider
    const handleThemeChange = (event) => {
        const newTheme = event.target.value;
        applyTheme(newTheme);
        setThemeName(newTheme);
    };

    const handleFontChange = (event) => {
        const newFont = event.target.value;
        applyFont(newFont);
        setFontType(newFont);
    };

    const handleFontSizeChange = (event) => {
        const newFontSize = event.target.value;
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
                    {availableThemes.map(theme => (
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
                <div className="font-size-selector" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <label htmlFor="fontSizeSlider" style={{ flexShrink: 0, marginBottom: 0 }}>Größe:</label>
                    <input
                        type="range"
                        id="fontSizeSlider"
                        min="0.8"
                        max="1.4"
                        step="0.05"
                        value={fontSize}
                        onChange={handleFontSizeChange}
                        style={{ flexGrow: 1, cursor: 'pointer' }}
                    />
                    <span style={{ minWidth: '40px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '500' }}>
                        {parseFloat(fontSize)}x
                    </span>
                </div>
                <p className="setting-description">
                    Passt die globale Schriftgröße der Anwendung an (Standard: 1.0x).
                </p>
            </div>
        </div>
    );
}
