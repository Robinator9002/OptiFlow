import React, { useEffect } from "react";

// --- Type Definitions ---
interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDanger?: boolean;
}

// --- Component ---
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    onConfirm,
    onCancel,
    isDanger,
}) => {
    useEffect(() => {
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
    }, [onConfirm, onCancel]);

    return (
        <div className="modal-overlay overlay">
            <div className={`modal-content ${isDanger ? "modal-danger" : ""}`}>
                {title && <h3>{title}</h3>}
                <p>{message}</p>
                <div className="modal-buttons">
                    <button className="confirm" onClick={onConfirm}>
                        Ja
                    </button>
                    <button className="disfirm" onClick={onCancel}>
                        Nein
                    </button>
                </div>
            </div>
        </div>
    );
};
