import React from "react";

interface HelpProps {
    onClose: () => void;
}

// TypeScript-Definition für die Preload-API
declare global {
    interface Window {
        electron: {
            openDocs: () => Promise<void>;
        }
    }
}

export const Help: React.FC<HelpProps> = ({ onClose }) => {

    const handleOpenDocs = () => {
        if (window.electron) {
            window.electron.openDocs();
        } else {
            console.error("Electron API not found. Is preload.js configured correctly?");
        }
    };

    return (
        <div className="help-modal-overlay">
            <div className="help-modal-content">
                <div className="help-modal-header">
                    <h2>Hilfe & Tastenkürzel</h2>
                    <button
                        onClick={onClose}
                        className="close-help-button"
                        title="Schließen (Escape)"
                    >
                        &times;
                    </button>
                </div>
                <div className="help-modal-body">
                    <section>
                        <h3>Allgemeine Tastenkürzel</h3>
                        <ul>
                            <li>
                                <strong>Enter:</strong> Universal für Bestätigen
                                (z.B. in Dialogen, Suche starten). In den
                                Einstellungen: Speichern.
                            </li>
                            <li>
                                <strong>Escape:</strong> Universal für Abbrechen
                                oder Schließen (z.B. dieses Hilfe-Fenster,
                                Modals). In den Einstellungen: Verlassen ohne
                                Speichern. In der Dateisuche: Aktive
                                Snippet-Auswahl aufheben/Suche zurücksetzen.
                            </li>
                            <li>
                                <strong>F1:</strong> Zeigt dieses Hilfe-Fenster
                                an.
                            </li>
                            <li>
                                <strong>
                                    Pfeil Runter (↓) / Pfeil Hoch (↑):
                                </strong>{" "}
                                Springt zum nächsten / vorherigen Suchergebnis
                                (Snippets in der Dateisuche).
                            </li>
                            <li>
                                <strong>Strg + 1:</strong> Öffnet den Tab "Suche
                                & Vorschau".
                            </li>
                            <li>
                                <strong>Strg + 2:</strong> Öffnet den Tab
                                "Entduplizierung" (Admin).
                            </li>
                            <li>
                                <strong>Strg + 3:</strong> Öffnet den Tab
                                "Vergessene Dateien" (Admin).
                            </li>
                            <li>
                                <strong>Strg + 4:</strong> Öffnet den Tab "Index
                                & Scanner" (Admin).
                            </li>
                            <li>
                                <strong>Strg + 5:</strong> Öffnet den Tab "PDF
                                zu OCR" (Admin).
                            </li>
                            <li>
                                <strong>Tab / Shift + Tab:</strong> Wechselt zum
                                nächsten / vorherigen Tab in der
                                Hauptnavigation.
                            </li>
                            <li>
                                <strong>Strg + , (Komma):</strong> Öffnet direkt
                                die Einstellungen.
                            </li>
                        </ul>
                    </section>
                    <section>
                        <h3>Tab-Beschreibungen</h3>
                        <dl>
                            <dt>Suche & Vorschau</dt>
                            <dd>
                                Durchsuchen Sie Ihren Datei-Index, lassen Sie
                                sich Inhalte anzeigen und verwalten Sie
                                Suchergebnisse.
                            </dd>
                            <dt>Entduplizierung (Admin)</dt>
                            <dd>
                                Finden und verwalten Sie doppelte Dateien in
                                Ihrem Index.
                            </dd>
                            <dt>Vergessene Dateien (Admin)</dt>
                            <dd>
                                Spüren Sie Dateien auf, die seit langer Zeit
                                nicht mehr verändert wurden.
                            </dd>
                            <dt>Index & Scanner (Admin)</dt>
                            <dd>
                                Verwalten Sie den Datei-Index, starten Sie Scans
                                und konfigurieren Sie den Scanner.
                            </dd>
                            <dt>PDF zu OCR (Admin)</dt>
                            <dd>
                                Führen Sie Texterkennung (OCR) für PDF-Dateien
                                im Index durch.
                            </dd>
                            <dt>Einstellungen</dt>
                            <dd>
                                Passen Sie die Anwendungseinstellungen an,
                                verwalten Sie Ihr Konto und das
                                Erscheinungsbild.
                            </dd>
                        </dl>
                    </section>
                </div>
                <div className="help-modal-footer">
                    {/* NEUER BUTTON */}
                    <button onClick={handleOpenDocs} className="secondary-action-button">
                        Vollständige Dokumentation öffnen
                    </button>
                    <button onClick={onClose} className="action-button">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};
