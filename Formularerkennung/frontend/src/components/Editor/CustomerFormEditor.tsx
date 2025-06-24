// src/components/Editor/CustomerFormEditor.tsx
import React, { useState, useEffect } from "react";
import * as api from "../../api/api";
import type {
	FormPublic,
	FormElementBase,
	FormDataEntry,
	FilledFormPublic,
} from "../../api/api";
import { UserRole as ApiUserRole } from "../../api/api";
import { ToastType } from "../Layout/ToastNotifications"; // Korrekter Import für ToastType

// Props für die Komponente
interface CustomerFormEditorProps {
	formTemplateId: string;
	formName: string;
	currentUser: api.UserPublic | null;
	onFormSubmitted: (submittedFormData: FilledFormPublic) => void;
	onCloseEditor: () => void;
	addToast: (message: string, type?: ToastType, duration?: number) => void;
	//  showConfirmModal Prop von App.tsx
	showConfirmModal: (config: {
		title?: string;
		message: string;
		onConfirm: () => void;
		onCancel?: () => void;
		confirmText?: string;
		cancelText?: string;
		isDanger?: boolean;
	}) => void;
}

const CustomerFormEditor: React.FC<CustomerFormEditorProps> = ({
	formTemplateId,
	formName,
	currentUser,
	onFormSubmitted,
	onCloseEditor,
	addToast,
	showConfirmModal, // NEUE Prop
}) => {
	const [formTemplate, setFormTemplate] = useState<FormPublic | null>(null);
	const [formData, setFormData] = useState<Record<string, any>>({});
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [isConfirming, setIsConfirming] = useState<boolean>(false);

	useEffect(() => {
		const fetchFormTemplate = async () => {
			if (!formTemplateId) {
				setError("Keine Formular-ID zum Laden vorhanden.");
				addToast("Fehler: Keine Formular-ID angegeben.", "error");
				setIsLoading(false);
				return;
			}
			setIsLoading(true);
			setError(null);
			try {
				const template = await api.getForm(formTemplateId);
				if (template) {
					setFormTemplate(template);
					const initialData: Record<string, any> = {};
					template.elements.forEach((el) => {
						if (el.type === "input") {
							initialData[el.id] = el.properties?.defaultValue || "";
						}
					});
					setFormData(initialData);
				} else {
					const notFoundError = `Formular-Template mit ID ${formTemplateId} nicht gefunden.`;
					setError(notFoundError);
					addToast(notFoundError, "error");
				}
			} catch (err: any) {
				const fetchErrorMsg =
					err.message || "Fehler beim Laden des Formular-Templates.";
				setError(fetchErrorMsg);
				addToast(fetchErrorMsg, "error");
			} finally {
				setIsLoading(false);
			}
		};
		fetchFormTemplate();
	}, [formTemplateId, addToast]);

	const handleInputChange = (elementId: string, value: any) => {
		setFormData((prevData) => ({
			...prevData,
			[elementId]: value,
		}));
	};

	const performSubmit = async () => {
		if (!formTemplate || !currentUser) return; // Sollte durch vorherige Checks abgedeckt sein

		setIsSubmitting(true);
		setError(null);
		const entries: FormDataEntry[] = formTemplate.elements
			.filter((el) => el.type === "input")
			.map((el) => ({
				element_id: el.id,
				value: formData[el.id] || "",
			}));
		const submissionPayload: api.FilledFormCreatePayload = {
			form_template_id: formTemplate.id,
			entries: entries,
		};
		try {
			const submittedFormResponse = await api.submitFilledForm(
				submissionPayload
			);
			addToast("Formular erfolgreich eingereicht!", "success");
			onFormSubmitted(submittedFormResponse);
		} catch (err: any) {
			const submitErrorMsg =
				err.message || "Fehler beim Einreichen des Formulars.";
			setError(submitErrorMsg);
			addToast(submitErrorMsg, "error");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmitWithConfirmation = () => {
		if (!formTemplate) {
			addToast("Formular-Template ist nicht geladen.", "error");
			return;
		}
		if (!currentUser || currentUser.role !== ApiUserRole.KUNDE) {
			addToast(
				"Aktion nicht erlaubt. Nur Kunden können Formulare einreichen.",
				"error"
			);
			return;
		}

		// Überprüfen, ob alle Felder ausgefüllt sind (optional, aber gute UX)
		// Diese Logik ist rudimentär und müsste ggf. Pflichtfelder im Template berücksichtigen
		const allInputsFilled = formTemplate.elements
			.filter((el) => el.type === "input" && el.properties?.required) // Angenommen, es gibt ein 'required' Property
			.every((el) => formData[el.id] && String(formData[el.id]).trim() !== "");

		if (
			!allInputsFilled &&
			formTemplate.elements.some(
				(el) => el.type === "input" && el.properties?.required
			)
		) {
			// addToast("Bitte füllen Sie alle Pflichtfelder aus.", "warning");
			// return;
			// Für jetzt erlauben wir das Senden, auch wenn nicht alle Felder ausgefüllt sind,
			// aber die Bestätigung ist trotzdem sinnvoll.
		}

		setIsConfirming(true);
		showConfirmModal({
			title: "Einreichung bestätigen",
			message: `Möchten Sie das Formular "${formName}" wirklich absenden? Bereits eingereichte Versionen dieses Formulars werden überschrieben.`,
			confirmText: "Absenden",
			cancelText: "Abbrechen",
			isDanger: false, // Keine "gefährliche" Aktion im Sinne von Löschen
			onConfirm: () => {performSubmit(); setIsConfirming(false);}, // Ruft die eigentliche Submit-Logik auf
			onCancel: () => {setIsConfirming(false)},
		});
	};

	const handleCanceling = () => {
		setIsConfirming(true);
		showConfirmModal({
			title: "Abbrechen bestätigen",
			message: `Möchten Sie das Bearbeiten des Formulares Abbrechen?.`,
			confirmText: "Abbrechen",
			cancelText: "Weiterausfüllen",
			isDanger: true, // Gefahr wegen abbrechen
			onConfirm: () => {
				onCloseEditor();
				setIsConfirming(false);
			}, // Schließt den Editor
			onCancel: () => setIsConfirming(false), // Erlaubt den ESC Key wieder
		});
	};

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Enter") {
				if (!isSubmitting && !isConfirming) {
					event.preventDefault();
					handleSubmitWithConfirmation();
				}	
			}
			if (event.key === "Escape") {
				if (!isSubmitting && !isConfirming) {
					event.preventDefault();
					handleCanceling();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onCloseEditor, handleSubmitWithConfirmation, isSubmitting]);

	const renderFormElement = (element: FormElementBase): React.ReactNode => {
		const baseStyle: React.CSSProperties = {
			position: "absolute",
			left: `${element.position.x}px`,
			top: `${element.position.y}px`,
			width: `${element.size.width}px`,
			height: `${element.size.height}px`,
			boxSizing: "border-box",
			fontSize: `${element.properties.fontSize || 16}px`,
			fontWeight: element.properties.fontWeight || "normal",
			fontStyle: element.properties.fontStyle || "normal",
			pointerEvents: "auto",
		};
		const textContainerStyle: React.CSSProperties = {
			display: "flex",
			alignItems: element.properties.textAlignVertical || "flex-start",
			justifyContent: element.properties.textAlignHorizontal || "left",
			textAlign: element.properties.textAlignHorizontal || "left",
			padding: "2px",
			width: "100%",
			height: "100%",
			overflow: "hidden",
			whiteSpace: "pre-wrap",
		};
		switch (element.type) {
			case "text":
				return (
					<div style={baseStyle} className="form-view-element form-view-text">
						<div style={textContainerStyle}>
							{element.properties.content || ""}
						</div>
					</div>
				);
			case "input":
				const { labelPosition = "top", textAlignHorizontal } =
					element.properties;
				const inputWrapperStyle: React.CSSProperties = {
					...baseStyle,
					display: "flex",
					padding: "5px",
				};
				const finalLabelStyle: React.CSSProperties = {
					display: "block",
					whiteSpace: "nowrap",
					flexShrink: 0,
					userSelect: "none",
				};
				const finalInputFieldStyle: React.CSSProperties = {
					fontSize: "inherit",
					fontWeight: "inherit",
					fontStyle: "inherit",
					padding: "6px 8px",
					border: "1px solid #ccc",
					borderRadius: "4px",
					textAlign: textAlignHorizontal || "left",
					boxSizing: "border-box",
					width: "100%",
				};
				if (labelPosition === "top") {
					inputWrapperStyle.flexDirection = "column";
					inputWrapperStyle.alignItems = "stretch";
					finalLabelStyle.marginBottom = "4px";
				} else if (labelPosition.startsWith("left")) {
					inputWrapperStyle.flexDirection = "row";
					inputWrapperStyle.alignItems =
						labelPosition === "left-center" ? "center" : "flex-start";
					finalLabelStyle.marginRight = "8px";
					finalInputFieldStyle.flexGrow = 1;
				} else if (labelPosition.startsWith("right")) {
					inputWrapperStyle.flexDirection = "row";
					inputWrapperStyle.alignItems =
						labelPosition === "right-center" ? "center" : "flex-start";
					finalLabelStyle.order = 2;
					finalLabelStyle.marginLeft = "8px";
					finalInputFieldStyle.order = 1;
					finalInputFieldStyle.flexGrow = 1;
				}
				return (
					<div
						style={inputWrapperStyle}
						className="form-view-element form-view-input-wrapper"
					>
						{element.properties.label && (
							<label
								style={finalLabelStyle}
								htmlFor={element.id}
								className="form-element-label"
							>
								{element.properties.label}
							</label>
						)}
						<input
							id={element.id}
							type={element.properties.inputType || "text"}
							placeholder={element.properties.placeholder || ""}
							value={formData[element.id] || ""}
							onChange={(e) => handleInputChange(element.id, e.target.value)}
							style={finalInputFieldStyle}
							className="form-element-input-field"
							disabled={isSubmitting}
						/>
					</div>
				);
			case "image":
				return (
					<div style={baseStyle} className="form-view-element form-view-image">
						<img
							src={
								element.properties.src ||
								"https://placehold.co/100x100/e0e0e0/999999?text=Bild"
							}
							alt={element.properties.alt || "Bild"}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								borderRadius:
									element.properties.imageShape === "circle" ? "50%" : "0px",
							}}
							onError={(e) =>
								(e.currentTarget.src =
									"https://placehold.co/100x100/ff0000/ffffff?text=Ladefehler")
							}
						/>
					</div>
				);
			case "line":
				return (
					<div
						style={{
							...baseStyle,
							backgroundColor: element.properties.color || "#000000",
						}}
						className="form-view-element form-view-line"
					/>
				);
			default:
				return (
					<div
						style={baseStyle}
						className={`form-view-element form-view-unknown form-view-${element.type}`}
					>
						<span style={textContainerStyle}>
							(Unbekanntes Element: {element.type})
						</span>
					</div>
				);
		}
	};

	if (isLoading) {
		return (
			<div className="customer-form-editor-container">
				<div className="customer-form-editor-header">
					<h2>Formular ausfüllen: {formName}</h2>
				</div>
				<div className="customer-editor-loading">
					Lade Formular zum Ausfüllen...
				</div>
			</div>
		);
	}
	if (error && !formTemplate && !isSubmitting) {
		return (
			<div className="customer-form-editor-container">
				<div className="customer-form-editor-header">
					<h2>Fehler</h2>
				</div>
				<div className="customer-editor-error">
					<p>{error}</p>
					<button onClick={onCloseEditor} className="button">
						Zurück zur Übersicht
					</button>
				</div>
			</div>
		);
	}
	if (!formTemplate) {
		return (
			<div className="customer-form-editor-container">
				<div className="customer-form-editor-header">
					<h2>Fehler</h2>
				</div>
				<div className="customer-editor-no-template">
					Formular konnte nicht geladen werden. Bitte versuchen Sie es später
					erneut oder kontaktieren Sie den Support.
					<button
						onClick={onCloseEditor}
						className="button"
						style={{ marginTop: "15px" }}
					>
						Zurück zur Übersicht
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="customer-form-editor-container">
			<div className="customer-form-editor-header">
				<h2>Formular ausfüllen: {formName}</h2>
				<p className="form-meta">
					Version {formTemplate.version}
					{formTemplate.description && ` - ${formTemplate.description}`}
				</p>
			</div>
			<div className="customer-form-editor-main-content">
				<div className="customer-form-canvas-wrapper">
					<div className="customer-form-canvas">
						{formTemplate.elements.map((element) => (
							<React.Fragment key={element.id}>
								{renderFormElement(element)}
							</React.Fragment>
						))}
					</div>
				</div>
				<aside className="customer-form-editor-sidebar">
					<div>
						<h4>Formular-Details</h4>
						<div className="sidebar-form-info">
							<p>
								<strong>Name:</strong> {formName}
							</p>
							<p>
								<strong>Version:</strong> {formTemplate.version}
							</p>
							{formTemplate.description && (
								<p>
									<strong>Beschreibung:</strong> {formTemplate.description}
								</p>
							)}
							<p>
								<strong>Anzahl Elemente:</strong> {formTemplate.elements.length}
							</p>
						</div>
					</div>
					{error && isSubmitting && (
						<p className="error-message-local customer-editor-submit-error">
							{error}
						</p>
					)}
					<div className="customer-form-editor-actions">
						<button
							onClick={handleSubmitWithConfirmation} // Geändert zu handleSubmitWithConfirmation
							className="button button-primary"
							disabled={isSubmitting || isLoading}
						>
							{isSubmitting ? "Sende Formulardaten..." : "Formular absenden"}
						</button>
						<button
							onClick={handleCanceling}
							className="button button-secondary"
							disabled={isSubmitting}
						>
							Abbrechen
						</button>
					</div>
				</aside>
			</div>
		</div>
	);
};

export default CustomerFormEditor;
