// src/components/Modals/ConfirmModal.tsx
import React, { useEffect } from "react";
// CSS wird global importiert, z.B. in App.css über @import "../style/Layout/ConfirmModal.css";

interface ConfirmModalProps {
	isOpen: boolean;
	title?: string;
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
	confirmText?: string;
	cancelText?: string;
	isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
	isOpen,
	title,
	message,
	onConfirm,
	onCancel,
	confirmText = "Bestätigen",
	cancelText = "Abbrechen",
	isDanger = false,
}) => {
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				onConfirm();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onConfirm, onCancel]);

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className={`modal-overlay confirm-modal-overlay ${
				isOpen ? "active" : ""
			}`}
			onClick={onCancel} // Klick auf Overlay schließt Modal
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? "confirm-modal-title" : undefined}
			aria-describedby="confirm-modal-message"
		>
			<div
				className={`modal-content confirm-modal-content ${
					isDanger ? "modal-danger" : ""
				}`}
				onClick={(e) => e.stopPropagation()}
			>
				{title && <h3 id="confirm-modal-title">{title}</h3>}
				<p id="confirm-modal-message">{message}</p>
				<div className="confirm-modal-actions">
					<button
						className="button cancel-action-button" // Spezifische Klasse für Styling
						onClick={onCancel}
					>
						{cancelText}
					</button>
					<button
						className={`button confirm-action-button ${
							isDanger ? "button-danger" : "button-primary"
						}`}
						onClick={onConfirm}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};
