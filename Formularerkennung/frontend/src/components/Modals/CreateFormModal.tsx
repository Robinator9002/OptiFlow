// src/components/Modals/CreateFormModal.tsx
import React, { useEffect, PropsWithChildren } from "react";

// CSS Annahmen bleiben gleich

interface CreateFormModalProps extends PropsWithChildren {
	isOpen: boolean;
	onClose: () => void;
	onConfirm?: () => void; // Funktion für die primäre Aktion (Enter)
	title?: string;
	className?: string;
}

export const CreateFormModal: React.FC<CreateFormModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title,
	children,
	className = "",
}) => {
	// Effect to handle Escape and Enter key presses
	useEffect(() => {
		if (!isOpen) return; // Nur ausführen, wenn Modal offen ist

		const handleKeyDown = (e: KeyboardEvent) => {
			// Escape-Taste schließt das Modal (ruft onClose auf)
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
				// Kein return hier nötig, da Enter nicht gleichzeitig Escape ist
			}

			// Enter-Taste: Löst die primäre Aktion aus, WENN onConfirm definiert ist
			// *** Vereinfachte Logik: Keine Prüfung des fokussierten Elements ***
			if (e.key === "Enter" && onConfirm) {
				e.preventDefault(); // Verhindert Standardaktionen wie Formular-Submit
				onConfirm(); // Rufe die übergebene Bestätigungsfunktion auf
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		// Cleanup: Event Listener entfernen
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose, onConfirm]); // Abhängigkeiten des Effekts

	// Render nothing if the modal is not open
	if (!isOpen) {
		return null;
	}

	// Render the modal structure (unverändert)
	return (
		<div
			className={`modal-overlay ${isOpen ? "active" : ""}`}
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? "create-form-modal-title" : undefined}
		>
			<div
				className={`modal-content ${className}`}
				onClick={(e) => e.stopPropagation()}
			>
				{title && (
					<div className="modal-header">
						<h2 id="create-form-modal-title">{title}</h2>
					</div>
				)}
				<div className="modal-body">{children}</div>
			</div>
		</div>
	);
};
