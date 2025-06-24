// src/components/Forms/FormsList.tsx
import React, { useState, useEffect, useCallback } from "react";
import * as api from "../../api/api";
import type { FormPublic } from "../../api/api";
import SendFormModal from "../Modals/SendFormModal";
//  Importiere ein einfaches Modal (oder baue es direkt hier)
// Annahme: Es existiert eine generische Modal-Komponente unter diesem Pfad
import { CreateFormModal } from "../Modals/CreateFormModal";

// Typdefinitionen für Props
type ShowConfirmModalFn = (config: {
	title?: string;
	message: string;
	onConfirm: () => void;
	onCancel?: () => void;
	confirmText?: string;
	cancelText?: string;
	isDanger?: boolean;
}) => void;
type AddToastFn = (
	message: string,
	type?: "success" | "error" | "info" | "warning",
	duration?: number
) => void;

interface FormsListProps {
	onEditForm: (form: FormPublic) => void;
	// navigateToNewForm kann jetzt optional eine templateId annehmen und ist potenziell async
	navigateToNewForm: (templateId?: string) => Promise<void> | void;
	showConfirmModal: ShowConfirmModalFn;
	addToast: AddToastFn;
}

const FormsListComponent: React.FC<FormsListProps> = ({
	onEditForm,
	navigateToNewForm, // Wird jetzt verwendet
	showConfirmModal,
	addToast,
}) => {
	// State für die Liste der Formulare
	const [forms, setForms] = useState<FormPublic[]>([]);
	// State für den Ladezustand der Liste
	const [isLoading, setIsLoading] = useState<boolean>(true);
	// State für Fehlermeldungen beim Laden
	const [error, setError] = useState<string | null>(null);

	// State für das Senden-Modal
	const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
	const [formToSendDetails, setFormToSendDetails] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [isPreparingSend, setIsPreparingSend] = useState<boolean>(false);

	//  State für das Template-Auswahl-Modal
	const [isTemplateModalOpen, setIsTemplateModalOpen] =
		useState<boolean>(false);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
	//  Ladezustand für die Navigation zum Editor
	const [isNavigating, setIsNavigating] = useState<boolean>(false);

	// Funktion zum Laden der Formulare
	const fetchForms = useCallback(async () => {
		setIsNavigating(false); // Navigations-Ladezustand bei jedem Neuladen zurücksetzen
		setIsLoading(true);
		setError(null);
		try {
			const fetchedForms = await api.getForms();
			// Sicherstellen, dass assigned_to_user_ids immer ein Array ist
			const sanitizedForms = fetchedForms.map((form) => ({
				...form,
				assigned_to_user_ids: Array.isArray(form.assigned_to_user_ids)
					? form.assigned_to_user_ids
					: [],
			}));
			// Sortiere Formulare alphabetisch nach Namen für die Dropdown-Auswahl
			setForms(sanitizedForms.sort((a, b) => a.name.localeCompare(b.name)));
		} catch (err: any) {
			const errorMessage = err.message || "Fehler beim Laden der Formulare.";
			setError(errorMessage);
			addToast(errorMessage, "error");
			console.error("Fehler beim Laden der Formulare:", err);
		} finally {
			setIsLoading(false);
		}
	}, [addToast]); // addToast als Abhängigkeit

	// Effekt zum initialen Laden der Formulare
	useEffect(() => {
		fetchForms();
	}, [fetchForms]); // fetchForms ist useCallback, Abhängigkeiten sind dort definiert

	// Funktion zum Löschen eines Formulars (unverändert)
	const handleDeleteForm = (formId: string, formName: string) => {
		showConfirmModal({
			title: "Löschen bestätigen",
			message: `Möchten Sie das Formular "${
				formName || "Unbenanntes Formular"
			}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
			confirmText: "Löschen",
			cancelText: "Abbrechen",
			isDanger: true,
			onConfirm: async () => {
				setIsLoading(true);
				try {
					await api.deleteForm(formId);
					// Aktualisiere den State, indem das gelöschte Formular entfernt wird
					setForms((prevForms) =>
						prevForms.filter((form) => form.id !== formId)
					);
					addToast(
						`Formular "${
							formName || "Unbenanntes Formular"
						}" erfolgreich gelöscht.`,
						"warning"
					);
				} catch (err: any) {
					const deleteErrorMsg =
						err.message || "Fehler beim Löschen des Formulars.";
					addToast(deleteErrorMsg, "error");
					console.error("Fehler beim Löschen des Formulars:", err);
				} finally {
					setIsLoading(false);
				}
			},
		});
	};

	// Funktion zum Öffnen des SendFormModals (unverändert)
	const handleOpenSendModal = (form: FormPublic) => {
		if (!form || !form.id || !form.name) {
			addToast("Formulardaten unvollständig zum Senden.", "error");
			return;
		}
		setFormToSendDetails({ id: form.id, name: form.name });
		setIsSendModalOpen(true);
		setIsPreparingSend(false);
	};

	// Funktion zum Schließen des SendFormModals (unverändert)
	const handleCloseSendModal = () => {
		setIsSendModalOpen(false);
		setFormToSendDetails(null);
	};

	// Callback für erfolgreiches Senden aus dem Modal (unverändert)
	const handleFormSentSuccessfully = (updatedFormFromApi: FormPublic) => {
		setForms((prevForms) =>
			prevForms.map((form) =>
				form.id === updatedFormFromApi.id
					? {
							...form,
							assigned_to_user_ids: updatedFormFromApi.assigned_to_user_ids,
					  }
					: form
			)
		);
		// Toast wird im Modal angezeigt
	};

	//  Handler zum Öffnen des Template-Auswahl-Modals
	const handleOpenTemplateModal = () => {
		setSelectedTemplateId(""); // Auswahl zurücksetzen
		setIsTemplateModalOpen(true); // Modal öffnen
	};

	//  Handler zum Schließen des Template-Auswahl-Modals
	const handleCloseTemplateModal = () => {
		setIsTemplateModalOpen(false);
	};

	//  Handler zum Starten des Editors (entweder leer oder mit Template)
	const handleStartNewForm = async () => {
		setIsNavigating(true); // Ladezustand für Navigation aktivieren
		try {
			// Rufe die (potenziell asynchrone) Funktion aus App.tsx auf
			// Übergibt die ausgewählte ID oder undefined, wenn keine ausgewählt wurde
			await navigateToNewForm(selectedTemplateId || undefined);
			// Das Modal muss hier nicht geschlossen werden, da die Navigation in App.tsx
			// den Tab wechselt und diese Komponente ggf. unmounted wird.
		} catch (e) {
			// Fehler wurde bereits in App.tsx mit Toast behandelt (Annahme)
			console.error("Fehler beim Navigieren zum neuen Formular:", e);
			// Ladezustand nur zurücksetzen, wenn ein Fehler auftrat und das Modal noch offen ist
			if (isTemplateModalOpen) {
				setIsNavigating(false);
			}
		}
		// 'finally' wird nicht benötigt, da isNavigating bei Erfolg durch Unmount/Neuladen zurückgesetzt wird
	};

	// --- Rendering ---

	// Ladezustand für die gesamte Liste
	if (isLoading && forms.length === 0) {
		return <div className="loading-message">Lade Formulare...</div>;
	}

	// Fehlerzustand für die gesamte Liste
	if (error && forms.length === 0) {
		return (
			<div className="error-message-global">
				<p>{error}</p>
				<button onClick={fetchForms} className="button">
					Erneut versuchen
				</button>
			</div>
		);
	}

	return (
		<div className="forms-list-container">
			{/* Header der Liste */}
			<div className="customer-assigned-forms-header">
				<h2>Formularübersicht</h2>
				{/* Button öffnet jetzt das Template-Auswahl-Modal */}
				<button
					onClick={handleOpenTemplateModal} // Geänderter Klick-Handler
					className="button button-primary forms-list-actions button-new-form"
					disabled={isLoading || isNavigating} // Deaktivieren während Laden oder Navigation
				>
					{isNavigating ? "Lade Editor..." : "+ Neues Formular erstellen"}
				</button>
			</div>

			{/* Anzeige, wenn keine Formulare vorhanden sind */}
			{forms.length === 0 && !isLoading ? (
				<div className="forms-list-empty">
					<p>Keine Formulare vorhanden.</p>
					<button
						onClick={handleOpenTemplateModal} // Öffnet ebenfalls das Modal
						className="button button-primary"
						disabled={isNavigating}
					>
						Jetzt Ihr erstes Formular erstellen!
					</button>
				</div>
			) : (
				/* Liste der Formulare */
				<ul className="forms-list">
					{forms.map((form) => (
						<li key={form.id} className="form-list-item">
							{/* Formularinformationen */}
							<div className="form-info">
								<h3
									onClick={() => onEditForm(form)}
									title={`Formular "${form.name}" bearbeiten`}
									className="form-name-clickable"
								>
									{form.name || "Unbenanntes Formular"}
								</h3>
								<p className="description">
									{form.description || "Keine Beschreibung verfügbar."}
								</p>
								{/* Metadaten des Formulars */}
								<div className="form-meta-grid">
									<span className="form-meta-item">
										<strong>Version:</strong> {form.version}
									</span>
									<span className="form-meta-item">
										<strong>Elemente:</strong> {form.elements.length}
									</span>
									<span className="form-meta-item">
										<strong>Gesendet an:</strong>{" "}
										{form.assigned_to_user_ids?.length || 0} Kunde(n)
									</span>
									<span className="form-meta-item">
										<strong>ID:</strong>{" "}
										<span className="form-id-value" title={form.id}>
											{form.id.substring(0, 8)}...
										</span>
									</span>
									{form.created_at && (
										<span className="form-meta-item">
											<strong>Erstellt:</strong>{" "}
											{new Date(form.created_at).toLocaleDateString()}
										</span>
									)}
									{form.updated_at && form.updated_at !== form.created_at && (
										<span className="form-meta-item">
											<strong>Aktualisiert:</strong>{" "}
											{new Date(form.updated_at).toLocaleDateString()}
										</span>
									)}
								</div>
							</div>
							{/* Aktionen für jedes Formular */}
							<div className="form-actions">
								<button
									onClick={() => onEditForm(form)}
									className="button button-primary"
									disabled={isLoading || isPreparingSend}
								>
									Bearbeiten
								</button>
								<button
									onClick={() => {
										setIsPreparingSend(true);
										handleOpenSendModal(form);
									}}
									className="button button-secondary"
									disabled={isLoading || isPreparingSend}
								>
									{isPreparingSend && formToSendDetails?.id === form.id
										? "Öffne..."
										: "Senden..."}
								</button>
								<button
									onClick={() => handleDeleteForm(form.id, form.name)}
									className="button button-danger"
									disabled={isLoading || isPreparingSend}
								>
									Löschen
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			{ /* Template-Auswahl-Modal */}
			<CreateFormModal // Verwendung der angenommenen Modal-Komponente
				isOpen={isTemplateModalOpen}
				onConfirm={handleStartNewForm}
				onClose={handleCloseTemplateModal}
				title="Neues Formular erstellen"
			>
				<div className="template-selection-modal-content">
					<p>
						Möchten Sie mit einem leeren Formular beginnen oder ein bestehendes
						Formular als Vorlage verwenden?
					</p>
					{/* Optionen im Modal */}
					<div className="template-selection-options">
						<div className="form-group">
							{" "}
							{/* Styling-Wrapper */}
							<label htmlFor="template-select">
								Vorlage auswählen (optional):
							</label>
							{/* Dropdown zur Auswahl eines Templates */}
							<select
								id="template-select"
								value={selectedTemplateId}
								onChange={(e) => setSelectedTemplateId(e.target.value)}
								className="form-select" // Beispiel CSS-Klasse
								disabled={isNavigating} // Deaktivieren während Navigation
							>
								<option value="">-- Leeres Formular --</option>
								{/* Optionen aus der geladenen Formularliste */}
								{forms.map((form) => (
									<option key={form.id} value={form.id}>
										{form.name} (v{form.version})
									</option>
								))}
							</select>
						</div>
					</div>
					{/* Aktionen im Modal */}
					<div className="modal-actions">
						<button
							onClick={handleStartNewForm} // Startet den Prozess
							className="button button-primary"
							disabled={isNavigating} // Deaktivieren während Navigation
						>
							{isNavigating // Dynamischer Button-Text
								? "Starte..."
								: selectedTemplateId // Text basierend auf Auswahl
								? "Vorlage verwenden"
								: "Leeres Formular erstellen"}
						</button>
						<button
							onClick={handleCloseTemplateModal} // Schließt das Modal
							className="button"
							disabled={isNavigating} // Deaktivieren während Navigation
						>
							Abbrechen
						</button>
					</div>
				</div>
			</CreateFormModal>

			{/* SendFormModal (unverändert) */}
			{formToSendDetails && (
				<SendFormModal
					isOpen={isSendModalOpen}
					onClose={handleCloseSendModal}
					formToSend={formToSendDetails}
					onFormSent={handleFormSentSuccessfully}
					addToast={addToast}
				/>
			)}
		</div>
	);
};
export default FormsListComponent;
