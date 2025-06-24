// src/components/Forms/FilledForms.tsx
import React from "react";
import { UserRole as ApiUserRole, UserPublic } from "../../api/api";
import CustomerAssignedFormsView from "./CustomerAssignedFormsView";
import StaffReceivedFormsView from "./StaffReceivedFormsView";
import type { EnrichedSubmission } from "./StaffReceivedFormsView"; // Importiere den Typ für die Prop

interface FilledFormsProps {
	currentUser: UserPublic | null;
	userRole: ApiUserRole;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
	onOpenFormToFill: (formTemplateId: string, formName: string) => void;
	//  Callback für die Detailansicht einer Einreichung
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

const FilledFormsComponent: React.FC<FilledFormsProps> = ({
	currentUser,
	userRole,
	addToast,
	onOpenFormToFill,
	onViewSubmissionDetails,
	onDeleteSubmission, // Für das Löschen
	showConfirmModal, // Das Confirm Modal
}) => {
	if (userRole === ApiUserRole.KUNDE) {
		return (
			<CustomerAssignedFormsView
				currentUser={currentUser}
				addToast={addToast}
				onOpenFormToFill={onOpenFormToFill}
			/>
		);
	}

	if (userRole === ApiUserRole.MITARBEITER || userRole === ApiUserRole.ADMIN) {
		return (
			<StaffReceivedFormsView
				currentUser={currentUser}
				addToast={addToast}
				onViewSubmissionDetails={onViewSubmissionDetails}
				onDeleteSubmission={onDeleteSubmission} // Prop weitergeben
				showConfirmModal={showConfirmModal} // Modal weitergeben
			/>
		);
	}

	return (
		<div className="placeholder-component filled-forms-error-view">
			<h2>Unbekannte Benutzerrolle</h2>
			<p>Die Ansicht für Ihre Benutzerrolle konnte nicht geladen werden.</p>
		</div>
	);
};

export default FilledFormsComponent;
