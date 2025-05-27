// src/components/Modals/SaveFormModal.tsx
// (Pfad könnte auch src/components/Editor/SaveFormModal.tsx sein, je nach deiner Struktur)
import React, { useState, useEffect, useCallback } from "react"; // useCallback hinzugefügt
import type { FormPublic } from "../../api/api";

interface SaveFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (details: {
		name: string;
		description?: string;
		version: number;
	}) => void;
	initialData?: Partial<Pick<FormPublic, "name" | "description" | "version">>;
	isUpdating: boolean;
}

const SaveFormModal: React.FC<SaveFormModalProps> = ({
	isOpen,
	onClose,
	onSave,
	initialData,
	isUpdating,
}) => {
	// State für die Formularfelder
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [version, setVersion] = useState(1);
	// State für Validierungsfehler (optional, aber gut für UX)
	const [nameError, setNameError] = useState<string | null>(null);

	// Effekt zum Initialisieren der Felder, wenn das Modal geöffnet wird
	useEffect(() => {
		if (isOpen) {
			if (initialData) {
				setName(initialData.name || "Unbenanntes Formular");
				setDescription(initialData.description || "");
				setVersion(initialData.version || 1);
			} else {
				// Standardwerte für ein neues Formular
				setName("Unbenanntes Formular");
				setDescription("");
				setVersion(1);
			}
			setNameError(null); // Fehler zurücksetzen beim Öffnen
		}
	}, [initialData, isOpen]); // Abhängig von initialData und isOpen

	// Funktion zur Validierung (einfaches Beispiel)
	const validateForm = useCallback((): boolean => {
		let isValid = true;
		if (!name.trim()) {
			setNameError("Formularname darf nicht leer sein.");
			isValid = false;
		} else {
			setNameError(null);
		}
		// Version wird durch type="number" und min="1" im Input grundlegend validiert
		return isValid;
	}, [name]); // Abhängig vom Namen

	// Handler für das Absenden des Formulars (Button-Klick oder Enter im Formular)
	const handleSubmit = useCallback(
		(e?: React.FormEvent) => {
			// Event ist optional für direkten Aufruf
			if (e) e.preventDefault(); // Verhindert Neuladen der Seite bei echtem Form-Submit
			if (validateForm()) {
				onSave({ name, description, version: Number(version) });
			}
		},
		[onSave, name, description, version, validateForm] // Abhängigkeiten für useCallback
	);

	// Effekt für Tastatur-Handler (Escape und Enter)
	useEffect(() => {
		if (!isOpen) return; // Nur wenn Modal offen ist

		const handleKeyDown = (e: KeyboardEvent) => {
			// Escape schließt das Modal
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
			// Enter löst Speichern aus, außer in der Textarea
			else if (e.key === "Enter") {
				const targetElement = e.target as HTMLElement;
				// Verhindere Speichern, wenn Enter in der Textarea gedrückt wird
				if (targetElement?.nodeName !== "TEXTAREA") {
					e.preventDefault(); // Verhindert Standard-Enter-Verhalten
					// Rufe den Submit-Handler auf, der auch die Validierung enthält
					handleSubmit();
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		// Cleanup
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose, handleSubmit]); // Abhängig von isOpen, onClose und handleSubmit

	// Rendere nichts, wenn das Modal geschlossen ist
	if (!isOpen) {
		return null;
	}

	// Rendere das Modal
	return (
		// Overlay zum Schließen bei Klick daneben
		<div className="modal-overlay save-form-modal-overlay" onClick={onClose}>
			{/* Inhalt des Modals, Klick hier stoppt Propagation */}
			<div
				className="modal-content save-form-modal-content"
				onClick={(e) => e.stopPropagation()}
			>
				<h2>Formular {isUpdating ? "aktualisieren" : "speichern"}</h2>
				{/* Formular für die Eingabefelder */}
				<form onSubmit={handleSubmit}>
					{/* Feld für Formularnamen */}
					<div className="form-group">
						{" "}
						{/* Wrapper für Styling */}
						<label htmlFor="formNameModal">Formularname:</label>
						<input
							type="text"
							id="formNameModal"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (nameError) validateForm(); // Fehler live entfernen, wenn korrigiert
							}}
							required // HTML5 Validierung
							aria-describedby={nameError ? "name-error-msg" : undefined} // Für Screenreader
							aria-invalid={!!nameError} // Für Screenreader
						/>
						{/* Fehlermeldung für Namen */}
						{nameError && (
							<p id="name-error-msg" className="error-message">
								{nameError}
							</p>
						)}
					</div>
					{/* Feld für Beschreibung */}
					<div className="form-group">
						<label htmlFor="formDescriptionModal">
							Beschreibung (optional):
						</label>
						<textarea
							id="formDescriptionModal"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3} // Beispiel für Höhe
						/>
					</div>
					{/* Feld für Version */}
					<div className="form-group">
						<label htmlFor="formVersionModal">Version:</label>
						<input
							type="number"
							id="formVersionModal"
							value={version}
							onChange={(e) => setVersion(parseInt(e.target.value, 10) || 1)}
							min="1" // Mindestwert
							required // HTML5 Validierung
						/>
					</div>
					{/* Aktionsbuttons im Modal */}
					<div className="modal-actions">
						<button
							type="button" // Wichtig: Verhindert versehentliches Absenden durch Enter
							onClick={onClose}
							className="button button-secondary cancel-action-button" // Klasse für Styling/Enter-Logik
						>
							Abbrechen
						</button>
						<button
							type="submit" // Löst onSubmit des Formulars aus
							className="button button-primary confirm-action-button" // Klasse für Styling
							// Optional: Deaktivieren, wenn Name leer ist (zusätzlich zur required-Validierung)
							// disabled={!name.trim()}
						>
							{isUpdating ? "Aktualisieren" : "Speichern"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default SaveFormModal;
