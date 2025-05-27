// src/api/api.ts
import axios, { AxiosError } from "axios";

// UserRole Enum
export enum UserRole {
	ADMIN = "admin",
	MITARBEITER = "mitarbeiter",
	KUNDE = "kunde",
}

// Basis-URL
const API_BASE_URL = "http://127.0.0.1:8000"; // Beibehalten wie vom Nutzer vorgegeben
export const api = axios.create({
	baseURL: API_BASE_URL,
	headers: { "Content-Type": "application/json" },
});

// --- TypeScript Interfaces ---
// Formular-Elemente & Formulare (bestehend - unverändert)
export interface FormElementBase {
	id: string;
	type: string;
	position: { [key: string]: any };
	size: { [key: string]: any };
	properties: { [key: string]: any };
}
export interface FormBase {
	name: string;
	description?: string;
	version: number;
	elements: FormElementBase[];
}
export interface FormCreate extends FormBase {}
export interface FormPublic extends FormBase {
	id: string;
	created_by_id?: string;
	created_at?: string;
	updated_at?: string;
	assigned_to_user_ids: string[];
}
export interface FormUpdate
	extends Partial<Omit<FormBase, "elements" | "name">> {
	name?: string;
	elements?: FormElementBase[];
	assigned_to_user_ids?: string[];
}
export interface FormListResponse {
	forms: FormPublic[];
	total_count: number;
}

// Benutzer und Authentifizierung (bestehend & erweitert - unverändert)
export interface UserBase {
	username: string;
	email?: string;
}
export interface UserPublic extends UserBase {
	id: string;
	role: UserRole;
	is_active: boolean;
	last_login?: string;
}
export interface AdminAuthPayload {
	// Wird für UserRegistrationRequest verwendet
	admin_username: string;
	admin_password: string;
}
export interface UserCreatePayload extends UserBase {
	password: string;
	role: UserRole;
}
export interface UserRegistrationRequest {
	admin_credentials: AdminAuthPayload;
	new_user_details: UserCreatePayload;
}
export interface TokenResponse {
	access_token: string;
	token_type: string;
	user: UserPublic;
}
export interface UserListResponse {
	// Wird von getUsers verwendet
	users: UserPublic[];
	total_count: number;
}

// Benutzereinstellungen (bestehend - unverändert)
export interface UserSettings {
	theme?: string;
	font_size_multiplier?: number;
}
export interface UserSettingsUpdatePayload {
	theme?: string;
	font_size_multiplier?: number;
}

// Account-Aktionen (bestehend & erweitert - unverändert)
export interface ChangePasswordPayload {
	current_password: string;
	new_password: string;
}
export interface ChangeEmailPayload {
	password: string;
	new_email: string;
}
export interface ChangeUsernamePayload {
	password: string;
	new_username: string;
}
export interface DeleteOwnAccountPayload {
	password: string;
}

// --- ANGEPASSTE/NEUE Interfaces für Admin-Benutzerverwaltung ---
// Basis-Payload für Admin-Aktionen, die das Admin-Passwort zur Bestätigung benötigen
// Entspricht AdminActionBaseRequest im Backend
export interface AdminActionConfirmPayload {
	requesting_admin_password: string;
}

// Payload für das Ändern der Benutzerrolle durch einen Admin
// Entspricht AdminUpdateUserRoleRequest im Backend
export interface AdminUpdateUserRolePayload extends AdminActionConfirmPayload {
	new_role: UserRole;
}

// Payload für das Setzen des Benutzerstatus durch einen Admin (falls später implementiert)
// Entspricht AdminSetUserStatusRequest im Backend (derzeit nicht implementiert)
export interface AdminSetUserStatusPayload extends AdminActionConfirmPayload {
	is_active: boolean;
}

// Payload für das Zurücksetzen des Benutzerpassworts durch einen Admin
// Entspricht AdminResetPasswordRequest im Backend
export type AdminResetPasswordPayload = AdminActionConfirmPayload;

// Response-Payload für das Zurücksetzen des Benutzerpassworts durch einen Admin
// Entspricht AdminResetPasswordResponse im Backend
export interface AdminResetPasswordResponsePayload {
	message: string;
	new_temporary_password?: string;
}

// Payload für das Löschen eines Benutzers durch einen Admin
// Entspricht dem Body, den der Backend-Endpunkt /admin/users/{username_to_delete} erwartet
// (welcher AdminActionBaseRequest ist)
export type AdminDeleteUserPayload = AdminActionConfirmPayload;

// Formularzuweisung und Einreichungen (bestehend - unverändert)
export interface AssignFormRequestPayload {
	user_ids_to_assign: string[];
}
export interface FormDataEntry {
	element_id: string;
	value: any;
}
export interface FilledFormCreatePayload {
	form_template_id: string;
	entries: FormDataEntry[];
}
export interface FilledFormPublic {
	id: string;
	form_template_id: string;
	submitted_by_user_id: string;
	entries: FormDataEntry[];
	submitted_at: string;
}
export interface FilledFormListResponse {
	filled_forms: FilledFormPublic[];
	total_count: number;
}
export interface RemoveFilledFormResponse {
	message: string;
	found: boolean;
}

// --- API Fehlerbehandlung (bestehend - unverändert) ---
const handleError = (error: any, context: string): Error => {
	let errorMessage = `Ein unerwarteter Fehler ist aufgetreten bei: ${context}.`;
	if (axios.isAxiosError(error)) {
		console.error(
			`Fehler bei ${context}:`,
			error.response?.data || error.message,
			error.response?.status
		);
		const detail = (error.response?.data as any)?.detail;
		errorMessage =
			detail ||
			error.message ||
			`API-Fehler bei ${context}. Status: ${error.response?.status}`;
	} else {
		console.error(`Unerwarteter Fehler bei ${context}:`, error);
	}
	return new Error(errorMessage);
};

// --- API Funktionen (Authentifizierung - bestehend - unverändert) ---
export const loginUser = async (
	credentials: FormData
): Promise<TokenResponse> => {
	try {
		const response = await api.post<TokenResponse>("/auth/token", credentials, {
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
		});
		if (response.data.access_token && response.data.user) {
			localStorage.setItem("authToken", response.data.access_token);
			localStorage.setItem("currentUser", JSON.stringify(response.data.user));
			api.defaults.headers.common[
				"Authorization"
			] = `Bearer ${response.data.access_token}`;
		} else {
			throw new Error("Ungültige Token-Antwort vom Server.");
		}
		return response.data;
	} catch (error) {
		localStorage.removeItem("authToken");
		localStorage.removeItem("currentUser");
		delete api.defaults.headers.common["Authorization"];
		throw handleError(error, "Login");
	}
};
export const getCurrentUser = async (): Promise<UserPublic | null> => {
	const storedUser = localStorage.getItem("currentUser");
	if (storedUser) {
		try {
			const user = JSON.parse(storedUser) as UserPublic;
			const token = localStorage.getItem("authToken");
			if (token) {
				if (!api.defaults.headers.common["Authorization"]) {
					api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
				}
				return user;
			} else {
				localStorage.removeItem("currentUser"); // Token weg, User-Info auch
			}
		} catch (e) {
			localStorage.removeItem("currentUser"); // Fehler beim Parsen
		}
	}
	// Wenn kein currentUser im Speicher oder Token fehlte, versuche vom Server zu holen
	const token = localStorage.getItem("authToken");
	if (!token) return null; // Kein Token, kein User

	// Sicherstellen, dass der Header gesetzt ist, falls er zwischendurch entfernt wurde
	if (!api.defaults.headers.common["Authorization"]) {
		api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
	}

	try {
		const response = await api.get<UserPublic>("/auth/users/me");
		if (response.data) {
			localStorage.setItem("currentUser", JSON.stringify(response.data)); // Aktuellen User speichern
		}
		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 401) {
			logoutUser(); // Bei 401 ausloggen
		}
		// throw handleError(error, "getCurrentUser"); // Fehler weiterwerfen, damit App.tsx reagieren kann
		return null; // Oder null zurückgeben, damit die App zur Login-Seite navigieren kann
	}
};
export const getUsers = async (role?: UserRole): Promise<UserPublic[]> => {
	try {
		const params: { role?: UserRole } = {};
		if (role) params.role = role;
		const response = await api.get<UserListResponse>(`/auth/users`, { params });
		return response.data.users;
	} catch (error) {
		throw handleError(error, `getUsers (Rolle: ${role || "alle"})`);
	}
};
export const logoutUser = (): void => {
	localStorage.removeItem("authToken");
	localStorage.removeItem("currentUser");
	delete api.defaults.headers.common["Authorization"];
};
export const registerUserByAdmin = async (
	registrationData: UserRegistrationRequest
): Promise<UserPublic> => {
	try {
		const response = await api.post<UserPublic>(
			"/auth/register",
			registrationData
		);
		return response.data;
	} catch (error) {
		throw handleError(error, "registerUserByAdmin");
	}
};

// --- API Funktionen (Benutzereinstellungen & Account-Aktionen - bestehend & erweitert) ---
const USER_ACCOUNT_PREFIX = "/users/me";
export const getMyUserSettings = async (): Promise<UserSettings> => {
	try {
		const response = await api.get<UserSettings>(
			`${USER_ACCOUNT_PREFIX}/settings`
		);
		return response.data;
	} catch (error) {
		throw handleError(error, "getMyUserSettings");
	}
};
export const updateMyUserSettings = async (
	settingsData: UserSettingsUpdatePayload
): Promise<UserSettings> => {
	try {
		const response = await api.put<UserSettings>(
			`${USER_ACCOUNT_PREFIX}/settings`,
			settingsData
		);
		return response.data;
	} catch (error) {
		throw handleError(error, "updateMyUserSettings");
	}
};
export const changeMyPassword = async (
	payload: ChangePasswordPayload
): Promise<{ message: string }> => {
	try {
		const response = await api.post<{ message: string }>(
			`${USER_ACCOUNT_PREFIX}/change-password`,
			payload
		);
		return response.data;
	} catch (error) {
		throw handleError(error, "changeMyPassword");
	}
};
export const changeMyEmail = async (
	payload: ChangeEmailPayload
): Promise<{ message: string }> => {
	try {
		const response = await api.post<{ message: string }>(
			`${USER_ACCOUNT_PREFIX}/change-email`,
			payload
		);
		return response.data;
	} catch (error) {
		throw handleError(error, "changeMyEmail");
	}
};
export const changeMyUsername = async (
	payload: ChangeUsernamePayload
): Promise<UserPublic> => {
	try {
		const response = await api.post<UserPublic>(
			`${USER_ACCOUNT_PREFIX}/change-username`,
			payload
		);
		// Wichtig: Nach Benutzernamensänderung sollte der currentUser im localStorage aktualisiert
		// oder entfernt werden, um Neuladen zu erzwingen, da der Token evtl. noch den alten Namen enthält.
		// Das Backend gibt den aktualisierten User zurück, der dann in App.tsx verwendet werden kann.
		localStorage.removeItem("currentUser"); // Erzwingt Neuladen von User-Daten bei nächstem getCurrentUser
		return response.data;
	} catch (error) {
		throw handleError(error, "changeMyUsername");
	}
};
export const deleteMyAccount = async (
	payload: DeleteOwnAccountPayload
): Promise<{ message: string }> => {
	try {
		const response = await api.delete<{ message: string }>(
			`${USER_ACCOUNT_PREFIX}/delete-account`,
			{ data: payload } // Wichtig: Payload für DELETE im 'data' Objekt
		);
		logoutUser(); // Nach erfolgreichem Löschen ausloggen
		return response.data;
	} catch (error) {
		throw handleError(error, "deleteMyAccount");
	}
};

// --- ÜBERARBEITETE API Funktionen für Admin-Benutzerverwaltung ---
const ADMIN_USERS_PREFIX = "/admin/users";

/**
 * Ändert die Rolle eines Zielbenutzers durch einen Admin.
 * Erfordert das Passwort des ausführenden Admins im Payload.
 */
export const adminUpdateUserRole = async (
	targetUsername: string,
	payload: AdminUpdateUserRolePayload // Enthält new_role und requesting_admin_password
): Promise<UserPublic> => {
	try {
		const response = await api.put<UserPublic>(
			`${ADMIN_USERS_PREFIX}/${targetUsername}/role`,
			payload // Sendet { new_role: "...", requesting_admin_password: "..." }
		);
		return response.data;
	} catch (error) {
		throw handleError(error, `adminUpdateUserRole (User: ${targetUsername})`);
	}
};

/**
 * Setzt den Aktivitätsstatus eines Zielbenutzers durch einen Admin. (Backend derzeit nicht implementiert)
 * Erfordert das Passwort des ausführenden Admins im Payload.
 */
export const adminSetUserStatus = async (
	targetUsername: string,
	payload: AdminSetUserStatusPayload // Enthält is_active und requesting_admin_password
): Promise<UserPublic> => {
	// ACHTUNG: Dieser Endpunkt ist laut Backend-Kommentar /main.py aktuell nicht implementiert.
	// Die Funktion wird hier der Vollständigkeit halber basierend auf dem alten Frontend-Code beibehalten.
	try {
		const response = await api.put<UserPublic>(
			`${ADMIN_USERS_PREFIX}/${targetUsername}/status`, // Annahme für den Endpunkt
			payload
		);
		return response.data;
	} catch (error) {
		throw handleError(error, `adminSetUserStatus (User: ${targetUsername})`);
	}
};

/**
 * Setzt das Passwort eines Zielbenutzers durch einen Admin zurück.
 * Erfordert das Passwort des ausführenden Admins im Payload.
 */
export const adminResetUserPassword = async (
	targetUsername: string,
	payload: AdminResetPasswordPayload // Enthält requesting_admin_password
): Promise<AdminResetPasswordResponsePayload> => {
	try {
		const response = await api.post<AdminResetPasswordResponsePayload>(
			`${ADMIN_USERS_PREFIX}/${targetUsername}/reset-password`,
			payload // Sendet { requesting_admin_password: "..." }
		);
		return response.data;
	} catch (error) {
		throw handleError(
			error,
			`adminResetUserPassword (User: ${targetUsername})`
		);
	}
};

/**
 * Löscht einen Zielbenutzer durch einen Admin.
 * Erfordert das Passwort des ausführenden Admins im Payload.
 */
export const adminDeleteUser = async (
	// Umbenannt von deleteUserByAdmin für Konsistenz
	targetUsername: string,
	payload: AdminDeleteUserPayload // Enthält requesting_admin_password
): Promise<{ message: string }> => {
	try {
		const response = await api.delete<{ message: string }>(
			`${ADMIN_USERS_PREFIX}/${targetUsername}`, // Pfad korrigiert
			{ data: payload } // Sendet { requesting_admin_password: "..." }
		);
		return response.data;
	} catch (error) {
		throw handleError(error, `adminDeleteUser (User: ${targetUsername})`);
	}
};

// --- API Funktionen (Formular-Templates - bestehend - unverändert) ---
const FORMS_PREFIX = "/forms";
export const createForm = async (formData: FormCreate): Promise<FormPublic> => {
	try {
		const response = await api.post<FormPublic>(`${FORMS_PREFIX}/`, formData);
		return response.data;
	} catch (error) {
		throw handleError(error, "createForm");
	}
};
export const getForms = async (): Promise<FormPublic[]> => {
	try {
		const response = await api.get<FormListResponse>(`${FORMS_PREFIX}/`);
		return response.data.forms;
	} catch (error) {
		throw handleError(error, "getForms");
	}
};
export const getForm = async (formId: string): Promise<FormPublic | null> => {
	try {
		const response = await api.get<FormPublic>(`${FORMS_PREFIX}/${formId}`);
		return response.data;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 404)
			return null;
		throw handleError(error, `getForm (ID: ${formId})`);
	}
};
export const updateForm = async (
	formId: string,
	formData: FormUpdate
): Promise<FormPublic> => {
	try {
		const response = await api.put<FormPublic>(
			`${FORMS_PREFIX}/${formId}`,
			formData
		);
		return response.data;
	} catch (error) {
		throw handleError(error, `updateForm (ID: ${formId})`);
	}
};
export const deleteForm = async (formId: string): Promise<void> => {
	try {
		await api.delete(`${FORMS_PREFIX}/${formId}`);
	} catch (error) {
		throw handleError(error, `deleteForm (ID: ${formId})`);
	}
};
export const assignFormToUsers = async (
	formId: string,
	userIdsToAssign: string[]
): Promise<FormPublic> => {
	try {
		const payload: AssignFormRequestPayload = {
			user_ids_to_assign: userIdsToAssign,
		};
		const response = await api.post<FormPublic>(
			`${FORMS_PREFIX}/${formId}/assign`,
			payload
		);
		return response.data;
	} catch (error) {
		throw handleError(error, `assignFormToUsers (Form ID: ${formId})`);
	}
};
export const getFormsAssignedToMe = async (): Promise<FormPublic[]> => {
	try {
		const response = await api.get<FormListResponse>(
			`${FORMS_PREFIX}/assigned_to_me`
		);
		return response.data.forms;
	} catch (error) {
		throw handleError(error, "getFormsAssignedToMe");
	}
};

// --- API Funktionen (Formular-Einreichungen - bestehend - unverändert) ---
const FILLED_FORMS_PREFIX = "/filled_forms";
export const submitFilledForm = async (
	submissionData: FilledFormCreatePayload
): Promise<FilledFormPublic> => {
	try {
		const response = await api.post<FilledFormPublic>(
			`${FILLED_FORMS_PREFIX}/`,
			submissionData
		);
		return response.data;
	} catch (error) {
		throw handleError(
			error,
			`submitFilledForm (Template ID: ${submissionData.form_template_id})`
		);
	}
};
export const getMySubmissions = async (): Promise<FilledFormPublic[]> => {
	try {
		const response = await api.get<FilledFormListResponse>(
			`${FILLED_FORMS_PREFIX}/my_submissions`
		);
		return response.data.filled_forms;
	} catch (error) {
		throw handleError(error, "getMySubmissions");
	}
};
export const getSubmissionsForTemplate = async (
	formTemplateId: string
): Promise<FilledFormPublic[]> => {
	try {
		const response = await api.get<FilledFormListResponse>(
			`${FILLED_FORMS_PREFIX}/for_template/${formTemplateId}`
		);
		return response.data.filled_forms;
	} catch (error) {
		throw handleError(
			error,
			`getSubmissionsForTemplate (Template ID: ${formTemplateId})`
		);
	}
};
export const getAllFilledForms = async (): Promise<FilledFormPublic[]> => {
	try {
		const response = await api.get<FilledFormListResponse>(
			`${FILLED_FORMS_PREFIX}/`
		);
		return response.data.filled_forms;
	} catch (error) {
		throw handleError(error, "getAllFilledForms");
	}
};
export const removeFilledForm = async (
	submissionId: string
): Promise<RemoveFilledFormResponse> => {
	try {
		const response = await api.delete<RemoveFilledFormResponse>(
			`${FILLED_FORMS_PREFIX}/${submissionId}`
		);
		return response.data;
	} catch (error) {
		throw handleError(error, `removeFilledForm (ID: ${submissionId})`);
	}
};

// --- Initialisierung des Auth-Headers (bestehend - unverändert) ---
const initialTokenOnLoad = localStorage.getItem("authToken");
if (initialTokenOnLoad) {
	if (!api.defaults.headers.common["Authorization"]) {
		api.defaults.headers.common[
			"Authorization"
		] = `Bearer ${initialTokenOnLoad}`;
	}
}
