// src/components/Forms/CustomerAssignedFormsView.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "../../api/api";
import type { FormPublic, FilledFormPublic } from "../../api/api";
import { ToastType } from "../Layout/ToastNotifications"; // Import für addToast Prop

// Typ für den Filter-Status
type FormFilterStatus = "all" | "filled" | "new";

interface CustomerAssignedFormsViewProps {
	addToast: (message: string, type?: ToastType, duration?: number) => void;
	onOpenFormToFill: (formTemplateId: string, formName: string) => void;
	currentUser: api.UserPublic | null; // currentUser wird für getMySubmissions benötigt
}

const CustomerAssignedFormsView: React.FC<CustomerAssignedFormsViewProps> = ({
	addToast,
	onOpenFormToFill,
	currentUser,
}) => {
	const [assignedFormTemplates, setAssignedFormTemplates] = useState<
		FormPublic[]
	>([]);
	const [submittedForms, setSubmittedForms] = useState<FilledFormPublic[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [filterStatus, setFilterStatus] = useState<FormFilterStatus>("all"); // Filter-State

	// Funktion zum Laden der zugewiesenen und bereits eingereichten Formulare
	const fetchData = useCallback(async () => {
		if (!currentUser) {
			setError("Benutzer nicht geladen, Daten können nicht abgerufen werden.");
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			// Paralleles Laden für bessere Performance
			const [assignedFormsResponse, submittedFormsResponse] = await Promise.all(
				[
					api.getFormsAssignedToMe(),
					api.getMySubmissions(), // API-Aufruf für eingereichte Formulare
				]
			);

			const sanitizedAssignedForms = assignedFormsResponse.map((form) => ({
				...form,
				assigned_to_user_ids: Array.isArray(form.assigned_to_user_ids)
					? form.assigned_to_user_ids
					: [],
			}));
			setAssignedFormTemplates(sanitizedAssignedForms);
			setSubmittedForms(submittedFormsResponse);
		} catch (err: any) {
			const errorMessage =
				err.message || "Fehler beim Laden Ihrer Formulardaten.";
			setError(errorMessage);
			addToast(errorMessage, "error");
			console.error("Error in CustomerAssignedFormsView fetchData:", err);
		} finally {
			setIsLoading(false);
		}
	}, [addToast, currentUser]); // currentUser als Abhängigkeit hinzugefügt

	useEffect(() => {
		fetchData();
	}, [fetchData]); // Wird jetzt durch currentUser in fetchData getriggert

	// Memoized Liste der zu anzeigenden Formulare (inkl. Status und Filterung)
	const displayedForms = useMemo(() => {
		if (!assignedFormTemplates) return [];

		const formsWithStatus = assignedFormTemplates.map((template) => {
			const isSubmitted = submittedForms.some(
				(submission) =>
					submission.form_template_id === template.id &&
					submission.submitted_by_user_id === currentUser?.id
			);
			return { ...template, isSubmitted };
		});

		if (filterStatus === "filled") {
			return formsWithStatus.filter((form) => form.isSubmitted);
		}
		if (filterStatus === "new") {
			return formsWithStatus.filter((form) => !form.isSubmitted);
		}
		return formsWithStatus; // 'all'
	}, [assignedFormTemplates, submittedForms, filterStatus, currentUser]);

	const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setFilterStatus(event.target.value as FormFilterStatus);
	};

	if (isLoading) {
		return <div className="loading-message">Lade Ihre Formulare...</div>;
	}

	if (error) {
		return (
			<div className="error-message-global forms-view-error">
				<p>{error}</p>
				<button onClick={fetchData} className="button button-primary">
					Erneut versuchen
				</button>
			</div>
		);
	}

	return (
		<div className="customer-assigned-forms-container">
			<div className="customer-assigned-forms-header">
				<h2>Meine Formulare</h2>
				<div className="form-filter-controls">
					<label htmlFor="form-status-filter">Anzeigen: </label>
					<select
						id="form-status-filter"
						value={filterStatus}
						onChange={handleFilterChange}
						className="form-filter-dropdown"
					>
						<option value="all">Alle zugewiesenen</option>
						<option value="new">Neue (noch nicht ausgefüllt)</option>
						<option value="filled">Bereits ausgefüllte</option>
					</select>
				</div>
			</div>

			{displayedForms.length === 0 ? (
				<div className="forms-list-empty customer-forms-empty">
					<p>
						{filterStatus === "all" &&
							"Ihnen wurden aktuell keine Formulare zugewiesen."}
						{filterStatus === "new" &&
							"Sie haben alle zugewiesenen Formulare bereits ausgefüllt oder es sind keine neuen vorhanden."}
						{filterStatus === "filled" &&
							"Sie haben noch keine Formulare ausgefüllt oder es wurden Ihnen keine zugewiesen."}
					</p>
				</div>
			) : (
				<ul className="forms-list customer-assigned-list">
					{displayedForms.map((form) => (
						<li
							key={form.id}
							className={`form-list-item customer-assigned-item ${
								form.isSubmitted ? "form-item-submitted" : "form-item-new"
							}`}
						>
							<div className="form-info">
								<h3 className="form-name">
									{form.name || "Unbenanntes Formular"}
								</h3>
								<p className="description">
									{form.description || "Keine Beschreibung verfügbar."}
								</p>
								<div className="form-meta-grid">
									{form.updated_at && (
										<span className="form-meta-item">
											<strong>Verfügbar seit:</strong>{" "}
											{new Date(form.updated_at).toLocaleDateString()}
										</span>
									)}
									<span className="form-meta-item">
										<strong>Status:</strong>
										<span
											className={`form-status-badge ${
												form.isSubmitted ? "status-filled" : "status-new"
											}`}
										>
											{form.isSubmitted ? "Ausgefüllt" : "Neu"}
										</span>
									</span>
								</div>
							</div>
							<div className="form-actions customer-form-actions">
								<button
									onClick={() => onOpenFormToFill(form.id, form.name)}
									className={`button ${
										form.isSubmitted ? "button-secondary" : "button-primary"
									} button-fill-form`}
								>
									{form.isSubmitted
										? "Erneut ausfüllen / Ansehen"
										: "Formular öffnen & ausfüllen"}
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

export default CustomerAssignedFormsView;
