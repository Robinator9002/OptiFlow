// src/components/Forms/StaffReceivedFormsView.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "../../api/api"; // API import
import type {
	FilledFormPublic,
	FormPublic,
	UserPublic,
	FormElementBase,
} from "../../api/api"; // Typen erweitert
import { ToastType } from "../Layout/ToastNotifications"; // Für addToast Prop

interface StaffReceivedFormsViewProps {
	addToast: (message: string, type?: ToastType, duration?: number) => void;
	currentUser: api.UserPublic | null;
	//  Callback, um die Detailansicht einer Einreichung zu öffnen
	onViewSubmissionDetails: (submission: EnrichedSubmission) => void;
	onDeleteSubmission: (submission: EnrichedSubmission) => void;
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

// Interface für die kombinierte Ansicht von Einreichung und Template/User-Details
// Wird jetzt auch von SubmissionViewer verwendet, daher exportieren
export interface EnrichedSubmission extends FilledFormPublic {
	formName?: string;
	formVersion?: number;
	submittedByUsername?: string;
	formElements?: FormElementBase[]; // Elemente des Original-Templates für die Detailansicht
}

const StaffReceivedFormsView: React.FC<StaffReceivedFormsViewProps> = ({
	addToast,
	currentUser,
	onViewSubmissionDetails,
	onDeleteSubmission, // Prop für das Löschen der Submission
	showConfirmModal, // Prop für das ConfirmModal
}) => {
	const [allSubmissions, setAllSubmissions] = useState<FilledFormPublic[]>([]);
	const [formTemplates, setFormTemplates] = useState<FormPublic[]>([]);
	const [users, setUsers] = useState<UserPublic[]>([]);

	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [filterByFormTemplateId, setFilterByFormTemplateId] =
		useState<string>("");
	const [filterByCustomerId, setFilterByCustomerId] = useState<string>("");
	const [searchTerm, setSearchTerm] = useState<string>(""); // Für Freitextsuche

	// Funktion zum Laden aller notwendigen Daten
	const fetchData = useCallback(async () => {
		if (!currentUser) {
			setError("Benutzerinformationen nicht verfügbar.");
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			let submissionsPromise: Promise<FilledFormPublic[]>;
			// Admins sehen alles, Mitarbeiter könnten eine gefilterte Ansicht bekommen
			if (currentUser.role === api.UserRole.ADMIN) {
				submissionsPromise = api.getAllFilledForms();
			} else if (currentUser.role === api.UserRole.MITARBEITER) {
				// Für Mitarbeiter laden wir vorerst auch alle.
				// Später könnte hier eine spezifischere API-Route oder Filterung nach Relevanz erfolgen.
				submissionsPromise = api.getAllFilledForms();
			} else {
				// Sollte nicht passieren, da diese Komponente nur für Staff-Rollen ist
				addToast("Unzureichende Berechtigungen für diese Ansicht.", "error");
				setIsLoading(false);
				return;
			}

			const [submissions, templates, allUsers] = await Promise.all([
				submissionsPromise,
				api.getForms(), // Alle Formular-Templates für Namen/Versionen
				api.getUsers(), // Alle User für Namen
			]);

			// Neueste Einreichungen zuerst
			setAllSubmissions(
				submissions.sort(
					(a, b) =>
						new Date(b.submitted_at).getTime() -
						new Date(a.submitted_at).getTime()
				)
			);
			setFormTemplates(templates);
			setUsers(allUsers);
		} catch (err: any) {
			const errorMessage =
				err.message || "Fehler beim Laden der eingegangenen Formulare.";
			setError(errorMessage);
			addToast(errorMessage, "error");
		} finally {
			setIsLoading(false);
		}
	}, [addToast, currentUser]);

	useEffect(() => {
		fetchData();
	}, [fetchData]); // fetchData ist useCallback, also nur neu ausführen, wenn sich Abhängigkeiten ändern

	// Anreichern der Submission-Daten und Anwendung der Filter
	const displayedSubmissions = useMemo((): EnrichedSubmission[] => {
		return allSubmissions
			.map((submission) => {
				const template = formTemplates.find(
					(t) => t.id === submission.form_template_id
				);
				const user = users.find(
					(u) => u.id === submission.submitted_by_user_id
				);
				return {
					...submission,
					formName: template?.name || "Unbekanntes Formular",
					formVersion: template?.version,
					submittedByUsername: user?.username || "Unbekannter Benutzer",
					formElements: template?.elements, // Elemente für die Detailansicht mitgeben
				};
			})
			.filter((submission) => {
				// Filter nach Formular-Template ID
				if (
					filterByFormTemplateId &&
					submission.form_template_id !== filterByFormTemplateId
				) {
					return false;
				}
				// Filter nach Kunden ID
				if (
					filterByCustomerId &&
					submission.submitted_by_user_id !== filterByCustomerId
				) {
					return false;
				}
				// Freitextsuche
				if (searchTerm) {
					const lowerSearchTerm = searchTerm.toLowerCase();
					const nameMatch = submission.formName
						?.toLowerCase()
						.includes(lowerSearchTerm);
					const userMatch = submission.submittedByUsername
						?.toLowerCase()
						.includes(lowerSearchTerm);
					// Man könnte auch nach Inhalten der Entries suchen, wäre aber aufwendiger
					return nameMatch || userMatch;
				}
				return true;
			});
	}, [
		allSubmissions,
		formTemplates,
		users,
		filterByFormTemplateId,
		filterByCustomerId,
		searchTerm,
	]);

	// Eindeutige Formular-Templates und Kunden für die Filter-Dropdowns extrahieren
	const uniqueFormTemplatesForFilter = useMemo(() => {
		const templatesMap = new Map<string, { id: string; name: string }>();
		formTemplates.forEach((template) => {
			// Gehe über alle bekannten Templates
			if (!templatesMap.has(template.id)) {
				templatesMap.set(template.id, { id: template.id, name: template.name });
			}
		});
		return Array.from(templatesMap.values()).sort((a, b) =>
			a.name.localeCompare(b.name)
		);
	}, [formTemplates]);

	const uniqueCustomersForFilter = useMemo(() => {
		const customersMap = new Map<string, { id: string; username: string }>();
		users.forEach((user) => {
			// Gehe über alle bekannten User
			if (user.role === api.UserRole.KUNDE && !customersMap.has(user.id)) {
				// Nur Kunden als Filteroption
				customersMap.set(user.id, { id: user.id, username: user.username });
			}
		});
		return Array.from(customersMap.values()).sort((a, b) =>
			a.username.localeCompare(b.username)
		);
	}, [users]);

	// Aufruf zum Löschen einer Submission
	const handleDeleteSubmission = (submission: EnrichedSubmission) => {
		showConfirmModal({
			title: "Löschen bestätigen",
			message: `Möchten Sie den Formular-Eingang "${submission.formName}" von dem Kunden "${submission.submittedByUsername}" wirklich Löschen?`,
			isDanger: true, // Das Löschen ist wirklich gefährlich
			confirmText: "Löschen",
			cancelText: "Abbrechen",
			onConfirm: async () => {
				await onDeleteSubmission(submission);
				fetchData();
			}, // Ruft die eigentliche Submit-Logik auf
			onCancel: fetchData,
		});
	};

	if (isLoading) {
		return (
			<div className="loading-message staff-view-loading">
				Lade eingegangene Formulare...
			</div>
		);
	}

	if (error) {
		return (
			<div className="error-message-global staff-view-error">
				<p>{error}</p>
				<button onClick={fetchData} className="button button-primary">
					Erneut versuchen
				</button>
			</div>
		);
	}

	return (
		<div className="staff-received-forms-container">
			<div className="staff-received-forms-header">
				<h2>Eingegangene Formulare</h2>
				<div className="staff-form-filters">
					<input
						type="text"
						placeholder="Suche (Formular, Kunde)..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="form-search-input"
						aria-label="Suche in Einreichungen"
					/>
					<div className="filter-group">
						<label htmlFor="template-filter-staff">Formular:</label>
						<select
							id="template-filter-staff"
							value={filterByFormTemplateId}
							onChange={(e) => setFilterByFormTemplateId(e.target.value)}
							className="form-filter-dropdown"
							aria-label="Filter nach Formular-Template"
						>
							<option value="">Alle Formulare</option>
							{uniqueFormTemplatesForFilter.map((template) => (
								<option key={template.id} value={template.id}>
									{template.name}
								</option>
							))}
						</select>
					</div>
					<div className="filter-group">
						<label htmlFor="customer-filter-staff">Kunde:</label>
						<select
							id="customer-filter-staff"
							value={filterByCustomerId}
							onChange={(e) => setFilterByCustomerId(e.target.value)}
							className="form-filter-dropdown"
							aria-label="Filter nach Kunde"
						>
							<option value="">Alle Kunden</option>
							{uniqueCustomersForFilter.map((customer) => (
								<option key={customer.id} value={customer.id}>
									{customer.username}
								</option>
							))}
						</select>
					</div>
					<button
						onClick={() => {
							setFilterByFormTemplateId("");
							setFilterByCustomerId("");
							setSearchTerm("");
						}}
						className="button button-secondary button-small button-clear-filters"
						title="Alle Filter zurücksetzen"
					>
						Filter löschen
					</button>
				</div>
			</div>

			{displayedSubmissions.length === 0 ? (
				<div className="forms-list-empty staff-forms-empty">
					<p>
						{filterByFormTemplateId || filterByCustomerId || searchTerm
							? "Keine eingegangenen Formulare entsprechen Ihren Filterkriterien."
							: "Es sind noch keine Formulare von Kunden eingegangen."}
					</p>
				</div>
			) : (
				<div className="submitted-forms-table-container">
					<table className="submitted-forms-table">
						<thead>
							<tr>
								<th className="col-form-name">Formularname</th>
								<th className="col-version">Version</th>
								<th className="col-submitted-by">Eingereicht von</th>
								<th className="col-submitted-at">Eingereicht am</th>
								<th className="col-actions">Aktionen</th>
							</tr>
						</thead>
						<tbody>
							{displayedSubmissions.map((submission) => (
								<tr key={submission.id} className="submission-row">
									<td data-label="Formularname">{submission.formName}</td>
									<td data-label="Version" className="cell-center">
										{submission.formVersion || "N/A"}
									</td>
									<td data-label="Eingereicht von">
										{submission.submittedByUsername}
									</td>
									<td data-label="Eingereicht am">
										{new Date(submission.submitted_at).toLocaleString("de-DE")}
									</td>
									<td data-label="Aktionen" className="cell-actions">
										<button
											onClick={() => onViewSubmissionDetails(submission)} // Ruft die Prop auf
											className="button button-primary button-small button-view" // Umbenannt von button-details
											title="Ausgefüllte Daten dieser Einreichung ansehen"
										>
											Anzeigen
										</button>
										<button
											onClick={() => handleDeleteSubmission(submission)} // Ruft die Prop auf
											className="button button-primary button-small button-view remove-button" // Umbenannt von button-details
											style={{ marginLeft: "0.5rem" }}
											title="Ausgefüllte Daten dieser Einreichung ansehen"
										>
											Löschen
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

export default StaffReceivedFormsView;
