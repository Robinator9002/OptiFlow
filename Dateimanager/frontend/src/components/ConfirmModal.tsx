import React, { useEffect } from 'react';

export const ConfirmModal = ({ title, message, onConfirm, onCancel, isDanger }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
            if (e.key === 'Escape') {
                // Für Escape wollen wir immer abbrechen
                e.preventDefault();
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onConfirm, onCancel]);

    return (
        <div className="modal-overlay overlay">
            <div className={`modal-content ${isDanger ? 'modal-danger' : ''}`}> {/* Optional: Klasse für rote Farbe */}
                {title && <h3>{title}</h3>}
                <p>{message}</p>
                <button className="confirm" onClick={onConfirm}>Ja</button>
                <button className="disfirm" onClick={onCancel}>Nein</button>
            </div>
        </div>
    );
};
