// src/components/Modals/SendFormModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react"; // useCallback hinzugefügt, gute Praxis für Event Handler in useEffect
import * as api from "../../api/api"; // Importiere deine API-Funktionen
import type { UserPublic, FormPublic } from "../../api/api"; // Importiere Typen

// Annahme: SendModal.css wird global importiert, z.B. in App.css oder index.css
// Wenn du CSS-Module verwendest, wäre der Import hier:
// import styles from './SendModal.module.css';
// und die Klassen würden als styles.sendFormModalOverlay etc. verwendet.
// Für dieses Beispiel gehen wir von globalen Klassen aus.

interface SendFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    formToSend: { id: string; name: string } | null;
    onFormSent: (updatedForm: FormPublic) => void;
    addToast: (
        message: string,
        type?: "success" | "error" | "info" | "warning",
        duration?: number
    ) => void;
}

const SendFormModal: React.FC<SendFormModalProps> = ({
    isOpen,
    onClose,
    formToSend,
    onFormSent,
    addToast,
}) => {
    const [customers, setCustomers] = useState<UserPublic[]>([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
    const [isSending, setIsSending] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sendToAll, setSendToAll] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>("");

    useEffect(() => {
        if (isOpen && formToSend) {
            const fetchCustomers = async () => {
                setIsLoadingUsers(true);
                setError(null);
                try {
                    const fetchedCustomers = await api.getUsers(api.UserRole.KUNDE);
                    setCustomers(fetchedCustomers);
                } catch (err: any) {
                    const fetchErrorMsg =
                        err.message || "Fehler beim Laden der Kundenliste.";
                    setError(fetchErrorMsg);
                    // addToast(fetchErrorMsg, 'error'); // Fehler wird im Modal angezeigt
                    console.error("Fehler beim Laden der Kunden:", err);
                } finally {
                    setIsLoadingUsers(false);
                }
            };
            fetchCustomers();
        } else {
            // Reset state when modal is closed or no form to send
            setCustomers([]);
            setSelectedCustomerIds([]);
            setSearchTerm("");
            setSendToAll(false);
            setError(null);
        }
    }, [
        isOpen,
        formToSend
    ]);

    const handleCustomerSelectionChange = (customerId: string) => {
        setSelectedCustomerIds((prevSelected) =>
            prevSelected.includes(customerId)
                ? prevSelected.filter((id) => id !== customerId)
                : [...prevSelected, customerId]
        );
        if (sendToAll) {
            setSendToAll(false); // Uncheck "Send to All" if a specific customer is toggled
        }
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(
            (customer) =>
                customer.username.toLowerCase().includes(searchTerm) ||
                (customer.email && customer.email.toLowerCase().includes(searchTerm))
        );
    }, [customers, searchTerm]);

    const handleSendToAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setSendToAll(checked);
        if (checked) {
            setSelectedCustomerIds(filteredCustomers.map((c) => c.id));
        } else {
            setSelectedCustomerIds([]);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = event.target.value.toLowerCase();
        setSearchTerm(newSearchTerm);

        // If "Send to All" was checked, update selection based on new filter results
        // We need to ensure filteredCustomers has updated based on the *new* searchTerm.
        // A slight delay or direct re-calculation might be needed if an immediate update of selection is critical.
        // For simplicity here, we'll rely on the subsequent useEffect that handles sendToAll and filteredCustomers.
        // However, if sendToAll is true, we want to immediately reflect changes.
        if (sendToAll) {
             // Re-filter with the new search term to update selection for "send to all"
            const newlyFiltered = customers.filter( // use original customers list for this
                (customer) =>
                    customer.username.toLowerCase().includes(newSearchTerm) ||
                    (customer.email &&
                        customer.email.toLowerCase().includes(newSearchTerm))
            );
            setSelectedCustomerIds(newlyFiltered.map((c) => c.id));
        }
    };


    useEffect(() => {
        // This effect ensures that if "Send to All" is checked,
        // the selected IDs are synchronized with the *currently visible* filtered customers.
        // This is important if the search term changes while "Send to All" is active.
        if (sendToAll && isOpen) {
            setSelectedCustomerIds(filteredCustomers.map((c) => c.id));
        }
        // Do not automatically uncheck "Send to All" here if selection changes,
        // that's handled in handleCustomerSelectionChange.
    }, [filteredCustomers, sendToAll, isOpen]); // Rerun if filter/sendToAll status/modal visibility changes


    // Memoize handleSendForm to ensure the useEffect for keyboard shortcuts
    // doesn't re-register due to this function reference changing unnecessarily.
    const handleSendForm = useCallback(async () => {
        if (!formToSend || selectedCustomerIds.length === 0) {
            addToast(
                "Bitte wählen Sie mindestens einen Kunden aus oder 'An alle senden'.",
                "warning"
            );
            return;
        }
        setIsSending(true);
        setError(null);
        try {
            const updatedForm = await api.assignFormToUsers(
                formToSend.id,
                selectedCustomerIds
            );
            addToast(
                `Formular "${formToSend.name}" erfolgreich an ${selectedCustomerIds.length} Kunde(n) gesendet.`,
                "success"
            );
            onFormSent(updatedForm);
            onClose(); // Close modal on success
        } catch (err: any) {
            const sendErrorMsg = err.message || "Fehler beim Senden des Formulars.";
            setError(sendErrorMsg);
            // addToast(sendErrorMsg, 'error'); // Error is shown in modal
            console.error("Fehler beim Senden des Formulars:", err);
        } finally {
            setIsSending(false);
        }
    }, [formToSend, selectedCustomerIds, addToast, onFormSent, onClose]); // Dependencies for handleSendForm

    // Effect for Keyboard Shortcuts
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            } else if (event.key === "Enter") {
                // Prevent Enter if an input field is focused, to avoid double actions
                // or if it should have a different behavior (e.g. search on enter)
                // For this modal, there's only a search input. We want Enter to submit the modal.
                // However, we should still respect the disabled state of the send button.
                const canSend = !(isLoadingUsers || isSending || selectedCustomerIds.length === 0);
                if (canSend) {
                    // Check if the focused element is an input, button, or textarea
                    // If so, let them handle Enter, unless it's the search input and we want to submit
                    const activeElement = document.activeElement;
                    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'BUTTON' || activeElement.tagName === 'TEXTAREA')) {
                        // If it's our search input, and the user presses Enter,
                        // we could argue it should trigger the send action.
                        // For now, let's allow Enter to submit unless it's specifically another button.
                        // This logic might need refinement based on desired UX for Enter in search field.
                        // A common pattern is Enter in search does nothing globally or triggers search,
                        // but here we want it to submit the modal.
                        // So, we don't preventDefault or stopPropagation.
                    }
                    handleSendForm();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose, handleSendForm, isLoadingUsers, isSending, selectedCustomerIds.length]); // Added relevant dependencies

    if (!isOpen || !formToSend) {
        return null;
    }

    const isSendButtonDisabled = isLoadingUsers || isSending || selectedCustomerIds.length === 0;

    return (
        <div
            className={`send-form-modal-overlay ${isOpen ? "active" : ""}`}
            onClick={onClose} // Close when clicking outside
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-form-modal-title"
        >
            <div
                className="send-form-modal-content"
                onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
            >
                <h3 id="send-form-modal-title">Formular senden: {formToSend.name}</h3>

                {isLoadingUsers && (
                    <p className="send-form-modal-loading-message">Lade Kundenliste...</p>
                )}
                {error && (
                    <p className="send-form-modal-error-message">Fehler: {error}</p>
                )}

                {!isLoadingUsers && !error && customers.length > 0 && (
                    <>
                        <input
                            type="text"
                            placeholder="Kunden suchen (Name, E-Mail)..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="send-form-modal-search-input"
                            disabled={isSending} // Disable search while sending
                        />
                        <label className="send-form-modal-send-to-all-label">
                            <input
                                type="checkbox"
                                checked={sendToAll}
                                onChange={handleSendToAllChange}
                                disabled={isSending || filteredCustomers.length === 0}
                            />
                            An alle ({filteredCustomers.length}) aktuell gefilterten Kunden
                            senden
                        </label>

                        {filteredCustomers.length > 0 ? (
                            <div className="send-form-modal-user-list">
                                {filteredCustomers.map((customer) => (
                                    <div key={customer.id} className="send-form-modal-user-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomerIds.includes(customer.id)}
                                                onChange={() =>
                                                    handleCustomerSelectionChange(customer.id)
                                                }
                                                disabled={isSending || sendToAll}
                                            />
                                            {customer.username}
                                            {customer.email && (
                                                <span className="send-form-modal-user-email">
                                                    ({customer.email})
                                                </span>
                                            )}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="send-form-modal-info-text">
                                {searchTerm
                                    ? "Keine Kunden entsprechen Ihrer Suche."
                                    : "Keine Kunden zum Anzeigen vorhanden." // This case implies customers array is not empty but filter yields nothing
                                }
                            </p>
                        )}
                         <p className="send-form-modal-selection-count">
                            Ausgewählt: {selectedCustomerIds.length} Kunde(n)
                        </p>
                    </>
                )}
                {!isLoadingUsers && !error && customers.length === 0 && (
                    <p className="send-form-modal-info-text">
                        Keine Kunden im System vorhanden, die zugewiesen werden könnten.
                    </p>
                )}


                <div className="send-form-modal-actions">
                    <button
                        onClick={onClose}
                        className="button button-secondary"
                        disabled={isSending} // Disable cancel if sending (optional, but good practice)
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSendForm}
                        className="button button-primary"
                        disabled={isSendButtonDisabled}
                    >
                        {isSending
                            ? "Sende..."
                            : `An ${selectedCustomerIds.length} Kunde(n) senden`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SendFormModal;