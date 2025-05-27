# backend/main.py
from fastapi import FastAPI, HTTPException, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import os
from typing import Optional, List 
from datetime import datetime, timezone
import uuid

from backend.core.form_manager import FormManager
from backend.core.account_manager import AccountManager
from backend.core.filled_form_manager import FilledFormManager

from backend.api.models import (
    FormCreate, FormPublic, FormUpdate, FormList,
    UserPublic as ModelUserPublic, 
    Token as ModelToken,
    UserRegistrationRequest,
    UserRole,
    # UserDeleteByAdminRequest, # Wird jetzt durch AdminActionBaseRequest abgedeckt oder spezifischer
    UserListResponse,
    AssignFormRequest, 
    FilledFormCreate, FilledFormPublic, FilledFormList, FilledFormDeleteResponse,
    UserSettingsPublic, UserSettingsUpdate,
    ChangePasswordRequest, ChangeEmailRequest, ChangeUsernameRequest,
    DeleteOwnAccountRequest,
    AdminUpdateUserRoleRequest,
    # AdminSetUserStatusRequest, # Vorerst nicht implementiert
    AdminResetPasswordRequest, # Hinzugefügt für Admin PW Reset Request
    AdminResetPasswordResponse,
    AdminActionBaseRequest # Für Admin-Passwort-Bestätigung bei Löschung
)

# Pfaddefinitionen und Instanziierungen bleiben gleich...
PROJECT_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
FORMS_STORAGE_FILE_PATH = os.path.join(DATA_DIR, "forms_data.json")
USERS_STORAGE_FILE_PATH = os.path.join(DATA_DIR, "users_data.json")
FILLED_FORMS_STORAGE_FILE_PATH = os.path.join(DATA_DIR, "filled_forms_data.json")
form_manager = FormManager(storage_file=FORMS_STORAGE_FILE_PATH)
account_manager = AccountManager(storage_file=USERS_STORAGE_FILE_PATH) 
filled_form_manager = FilledFormManager(storage_file=FILLED_FORMS_STORAGE_FILE_PATH)

app = FastAPI(
    title="Formular Manager API",
    description="API für die Verwaltung von Formularen, Nutzern und deren Daten.",
    version="0.10.1 Presentation Ready", 
)
# CORS Middleware bleibt gleich...
allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Authentifizierung & Helfer-Dependencies bleiben gleich...
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
async def get_current_user(token: str = Depends(oauth2_scheme)) -> ModelUserPublic:
    if not token.startswith("dummy_auth_token_for_"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiger Token-Präfix", headers={"WWW-Authenticate": "Bearer"})
    username_from_token = token.replace("dummy_auth_token_for_", "")
    user_in_db_obj = account_manager.get_user(username_from_token) 
    if not user_in_db_obj:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzer nicht gefunden oder Token ungültig", headers={"WWW-Authenticate": "Bearer"})
    user_public = ModelUserPublic.model_validate(user_in_db_obj)
    if not user_public.is_active:
         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzer ist inaktiv", headers={"WWW-Authenticate": "Bearer"})
    return user_public

async def get_current_active_admin(current_user: ModelUserPublic = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine ausreichenden Berechtigungen (Admin erforderlich)")
    return current_user

async def get_current_active_admin_or_mitarbeiter(current_user: ModelUserPublic = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.MITARBEITER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine ausreichenden Berechtigungen (Admin oder Mitarbeiter erforderlich)")
    return current_user

# --- Auth Endpunkte ---
AUTH_ROUTER_PREFIX = "/auth"
@app.get(f"{AUTH_ROUTER_PREFIX}/users", response_model=UserListResponse, tags=["Benutzerverwaltung (Admin)"])
async def get_all_users_endpoint(role: Optional[UserRole] = Query(None), current_user: ModelUserPublic = Depends(get_current_active_admin)):
    all_users_in_db_objects = account_manager.get_all_users()
    users_to_return = [ModelUserPublic.model_validate(u) for u in all_users_in_db_objects if not role or u.role == role]
    return UserListResponse(users=users_to_return, total_count=len(users_to_return))

@app.post(f"{AUTH_ROUTER_PREFIX}/token", response_model=ModelToken, tags=["Authentifizierung"])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user_auth_details_dict = account_manager.login_user(form_data.username, form_data.password)
    if not user_auth_details_dict:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falscher Benutzername oder Passwort", headers={"WWW-Authenticate": "Bearer"})
    return ModelToken(**user_auth_details_dict)

@app.post(f"{AUTH_ROUTER_PREFIX}/register", response_model=ModelUserPublic, status_code=status.HTTP_201_CREATED, tags=["Authentifizierung"])
async def register_new_user_endpoint(registration_data: UserRegistrationRequest):
    success, message, new_user_public_obj = account_manager.register_user_by_admin(
        admin_username=registration_data.admin_credentials.admin_username,
        admin_password_plaintext=registration_data.admin_credentials.admin_password,
        new_username=registration_data.new_user_details.username,
        new_email=registration_data.new_user_details.email,
        new_password_plaintext=registration_data.new_user_details.password,
        new_user_role=registration_data.new_user_details.role,
    )
    if not success or not new_user_public_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return new_user_public_obj

@app.get(f"{AUTH_ROUTER_PREFIX}/users/me", response_model=ModelUserPublic, tags=["Authentifizierung"])
async def read_users_me_endpoint(current_user: ModelUserPublic = Depends(get_current_user)):
    return current_user

# --- Endpunkte für Benutzereinstellungen und Account-Aktionen (Selbstbedienung) ---
USER_ACCOUNT_ROUTER_PREFIX = "/users/me" 
@app.get(f"{USER_ACCOUNT_ROUTER_PREFIX}/settings", response_model=UserSettingsPublic, tags=["Benutzereinstellungen"])
async def get_my_settings_endpoint(current_user: ModelUserPublic = Depends(get_current_user)):
    user_settings_base_instance = account_manager.get_user_settings(current_user.username)
    if not user_settings_base_instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Einstellungen nicht gefunden.")
    return UserSettingsPublic.model_validate(user_settings_base_instance.model_dump())

@app.put(f"{USER_ACCOUNT_ROUTER_PREFIX}/settings", response_model=UserSettingsPublic, tags=["Benutzereinstellungen"])
async def update_my_settings_endpoint(settings_update: UserSettingsUpdate, current_user: ModelUserPublic = Depends(get_current_user)):
    updated_settings_base_instance = account_manager.update_user_settings(current_user.username, settings_update)
    if not updated_settings_base_instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benutzer nicht gefunden oder Fehler beim Update.")
    return UserSettingsPublic.model_validate(updated_settings_base_instance.model_dump())

@app.post(f"{USER_ACCOUNT_ROUTER_PREFIX}/change-password", tags=["Benutzerkonto-Aktionen"])
async def change_my_password_endpoint(request_data: ChangePasswordRequest, current_user: ModelUserPublic = Depends(get_current_user)):
    success, message = account_manager.change_user_password(current_user.username, request_data.current_password, request_data.new_password)
    if not success:
        if "Passwort ist falsch" in message: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) 
    return {"message": message}

@app.post(f"{USER_ACCOUNT_ROUTER_PREFIX}/change-email", tags=["Benutzerkonto-Aktionen"])
async def change_my_email_endpoint(request_data: ChangeEmailRequest, current_user: ModelUserPublic = Depends(get_current_user)):
    if not current_user.email and not request_data.new_email: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Keine E-Mail-Adresse zum Ändern vorhanden oder angegeben.")
    success, message = account_manager.change_user_email(current_user.username, request_data.password, request_data.new_email)
    if not success:
        if "Passwort" in message or "E-Mail-Adresse" in message: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    return {"message": message}

@app.post(f"{USER_ACCOUNT_ROUTER_PREFIX}/change-username", response_model=ModelUserPublic, tags=["Benutzerkonto-Aktionen"])
async def change_my_username_endpoint(request_data: ChangeUsernameRequest, current_user: ModelUserPublic = Depends(get_current_user)):
    success, message, updated_user_public = account_manager.change_user_username(current_username=current_user.username, password_plaintext=request_data.password, new_username=request_data.new_username)
    if not success:
        if "Passwort" in message or "Benutzername" in message: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) 
    if updated_user_public: return updated_user_public
    else: raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Fehler beim Abrufen der aktualisierten Benutzerdaten.")

@app.delete(f"{USER_ACCOUNT_ROUTER_PREFIX}/delete-account", tags=["Benutzerkonto-Aktionen"], status_code=status.HTTP_200_OK)
async def delete_my_account_endpoint(
    request_data: DeleteOwnAccountRequest, current_user: ModelUserPublic = Depends(get_current_user)
):
    success, message = account_manager.delete_own_account(username=current_user.username, password_plaintext=request_data.password)
    if not success:
        if "Passwort ist falsch" in message: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        if "letzte aktive Administrator" in message: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    return {"message": message}

# --- Admin-spezifische Endpunkte für Benutzerverwaltung ---
ADMIN_USERS_ROUTER_PREFIX = "/admin/users"

@app.put(f"{ADMIN_USERS_ROUTER_PREFIX}/{{target_username}}/role", response_model=ModelUserPublic, tags=["Benutzerverwaltung (Admin)"])
async def admin_update_user_role_endpoint(
    target_username: str, request_data: AdminUpdateUserRoleRequest, admin_user: ModelUserPublic = Depends(get_current_active_admin)
):
    success, message, updated_user = account_manager.admin_update_user_role(
        requesting_admin_username=admin_user.username, 
        requesting_admin_password=request_data.requesting_admin_password, # Passwort des Admins aus dem Request Body
        target_username=target_username,
        new_role=request_data.new_role
    )
    if not success:
        if "nicht gefunden" in message: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
        if "Admin-Authentifizierung fehlgeschlagen" in message: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)
        if "nicht selbst die Admin-Rechte entziehen" in message: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    if updated_user: return updated_user
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Fehler beim Abrufen des aktualisierten Benutzers nach Rollenänderung.")

@app.post(f"{ADMIN_USERS_ROUTER_PREFIX}/{{target_username}}/reset-password", response_model=AdminResetPasswordResponse, tags=["Benutzerverwaltung (Admin)"])
async def admin_reset_user_password_endpoint(
    target_username: str, request_data: AdminResetPasswordRequest, admin_user: ModelUserPublic = Depends(get_current_active_admin)
):
    success, message, temp_password = account_manager.admin_reset_user_password(
        requesting_admin_username=admin_user.username,
        requesting_admin_password=request_data.requesting_admin_password, # Passwort des Admins aus dem Request Body
        target_username=target_username
    )
    if not success:
        if "nicht gefunden" in message: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
        if "Admin-Authentifizierung fehlgeschlagen" in message: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return AdminResetPasswordResponse(message=message, new_temporary_password=temp_password)

@app.delete(f"{ADMIN_USERS_ROUTER_PREFIX}/{{username_to_delete}}", status_code=status.HTTP_200_OK, tags=["Benutzerverwaltung (Admin)"])
async def admin_delete_user_endpoint(
    username_to_delete: str, admin_confirmation: AdminActionBaseRequest, # Erwartet Admin-Passwort
    requesting_admin: ModelUserPublic = Depends(get_current_active_admin)
):
    success, message = account_manager.admin_delete_user( # Umbenannt in AccountManager
        requesting_admin_username=requesting_admin.username,
        admin_password_to_confirm=admin_confirmation.requesting_admin_password,
        username_to_delete=username_to_delete
    )
    if not success:
        if "Authentifizierung fehlgeschlagen" in message: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)
        if "nicht gefunden" in message: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
        if "nicht gelöscht werden" in message: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return {"message": message}

# Formular-Template Endpunkte und Einreichungs-Endpunkte bleiben unverändert...
# ... (Rest der Datei)
FORMS_ROUTER_PREFIX = "/forms"
@app.post(f"{FORMS_ROUTER_PREFIX}/", response_model=FormPublic, status_code=status.HTTP_201_CREATED, tags=["Formular-Templates"])
async def create_form_endpoint(
    form_data: FormCreate, 
    current_user: ModelUserPublic = Depends(get_current_active_admin_or_mitarbeiter)
):
    try:
        form_dict = form_data.model_dump()
        form_dict["created_by_id"] = current_user.id
        now_utc = datetime.now(timezone.utc)
        form_dict["created_at"] = now_utc
        form_dict["updated_at"] = now_utc
        form_dict["assigned_to_user_ids"] = []
        saved_form_dict = form_manager.save_form(form_dict)
        return FormPublic.model_validate(saved_form_dict)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Fehler beim Erstellen des Formulars: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Interner Serverfehler beim Erstellen des Formulars.")

@app.get(f"{FORMS_ROUTER_PREFIX}/", response_model=FormList, tags=["Formular-Templates"])
async def read_forms_endpoint(
    current_user: ModelUserPublic = Depends(get_current_active_admin_or_mitarbeiter) 
):
    all_forms_dicts = form_manager.load_all_forms()
    form_public_list = [FormPublic.model_validate(form_data) for form_data in all_forms_dicts]
    return FormList(forms=form_public_list, total_count=len(form_public_list))

@app.get(f"{FORMS_ROUTER_PREFIX}/assigned_to_me", response_model=FormList, tags=["Formular-Zuweisung"])
async def get_forms_assigned_to_me_endpoint(
    current_user: ModelUserPublic = Depends(get_current_user)
):
    all_forms_dicts = form_manager.load_all_forms()
    assigned_forms_to_current_user = []
    for form_dict_iter in all_forms_dicts:
        assigned_ids = form_dict_iter.get("assigned_to_user_ids", [])
        if not isinstance(assigned_ids, list): assigned_ids = []
        
        if current_user.id in assigned_ids:
            assigned_forms_to_current_user.append(FormPublic.model_validate(form_dict_iter))
            
    return FormList(forms=assigned_forms_to_current_user, total_count=len(assigned_forms_to_current_user))

@app.get(f"{FORMS_ROUTER_PREFIX}/{{form_id}}", response_model=FormPublic, tags=["Formular-Templates"])
async def read_form_endpoint(form_id: str, current_user: ModelUserPublic = Depends(get_current_user)):
    form_data_dict = form_manager.load_form(form_id)
    if form_data_dict is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formular-Template nicht gefunden")
    return FormPublic.model_validate(form_data_dict)

@app.put(f"{FORMS_ROUTER_PREFIX}/{{form_id}}", response_model=FormPublic, tags=["Formular-Templates"])
async def update_form_endpoint(
    form_id: str, 
    form_data_update: FormUpdate,
    current_user: ModelUserPublic = Depends(get_current_user) 
):
    original_form_dict = form_manager.load_form(form_id)
    if not original_form_dict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formular-Template nicht gefunden")
    
    original_form_public = FormPublic.model_validate(original_form_dict)
    if current_user.role != UserRole.ADMIN and original_form_public.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung, dieses Formular-Template zu aktualisieren.")

    try:
        update_payload_dict = form_data_update.model_dump(exclude_unset=True) 
        if not update_payload_dict:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Keine Daten zum Aktualisieren angegeben.")
        
        update_payload_dict["updated_at"] = datetime.now(timezone.utc)

        updated_form_dict = form_manager.update_form(form_id, update_payload_dict)
        if updated_form_dict is None: 
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formular-Template nach Update nicht gefunden (interner Fehler).")
        return FormPublic.model_validate(updated_form_dict)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Fehler beim Aktualisieren des Formular-Templates {form_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Interner Serverfehler beim Aktualisieren.")

@app.delete(f"{FORMS_ROUTER_PREFIX}/{{form_id}}", status_code=status.HTTP_204_NO_CONTENT, tags=["Formular-Templates"])
async def delete_form_endpoint(form_id: str, current_user: ModelUserPublic = Depends(get_current_user)): 
    original_form_dict = form_manager.load_form(form_id)
    if not original_form_dict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formular-Template nicht gefunden")
    
    original_form_public = FormPublic.model_validate(original_form_dict)
    if current_user.role != UserRole.ADMIN and original_form_public.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung, dieses Formular-Template zu löschen.")
        
    success = form_manager.delete_form(form_id)
    if not success: 
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formular-Template nicht gefunden beim Löschversuch (interner Fehler).")
    return None 

@app.post(f"{FORMS_ROUTER_PREFIX}/{{form_id}}/assign", response_model=FormPublic, tags=["Formular-Zuweisung"])
async def assign_form_to_users_endpoint(
    form_id: str,
    assign_request: AssignFormRequest,
    current_user: ModelUserPublic = Depends(get_current_active_admin_or_mitarbeiter)
):
    form_template_dict = form_manager.load_form(form_id)
    if not form_template_dict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formular-Template nicht gefunden.")
    for user_id_to_assign in assign_request.user_ids_to_assign:
        user_to_assign_obj = account_manager.get_user_by_id(user_id_to_assign)
        if not user_to_assign_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Benutzer mit ID '{user_id_to_assign}' für Zuweisung nicht gefunden.")
    updated_form_dict = form_manager.assign_form_to_users(form_id, assign_request.user_ids_to_assign)
    if not updated_form_dict:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Fehler beim Zuweisen des Formulars.")
    print(f"Formular '{form_id}' wurde von '{current_user.username}' an Benutzer {assign_request.user_ids_to_assign} zugewiesen.")
    return FormPublic.model_validate(updated_form_dict)

FILLED_FORMS_ROUTER_PREFIX = "/filled_forms"
@app.post(f"{FILLED_FORMS_ROUTER_PREFIX}/", response_model=FilledFormPublic, status_code=status.HTTP_201_CREATED, tags=["Formular-Einreichungen"])
async def submit_filled_form_endpoint(
    filled_form_payload: FilledFormCreate, 
    current_user: ModelUserPublic = Depends(get_current_user)
):
    form_template_dict = form_manager.load_form(filled_form_payload.form_template_id)
    if not form_template_dict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Formular-Template mit ID '{filled_form_payload.form_template_id}' nicht gefunden.")
    assigned_ids = form_template_dict.get("assigned_to_user_ids", [])
    if not isinstance(assigned_ids, list): assigned_ids = []
    if current_user.id not in assigned_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sie sind nicht berechtigt, dieses Formular einzureichen oder es wurde Ihnen nicht zugewiesen.")
    submission_data_dict = {
        "id": str(uuid.uuid4()), 
        "form_template_id": filled_form_payload.form_template_id,
        "submitted_by_user_id": current_user.id,
        "entries": [entry.model_dump() for entry in filled_form_payload.entries],
        "submitted_at": datetime.now(timezone.utc) 
    }
    try:
        saved_submission_dict = filled_form_manager.save_filled_form(submission_data_dict)
        return FilledFormPublic.model_validate(saved_submission_dict)
    except Exception as e:
        print(f"Fehler beim Speichern des ausgefüllten Formulars: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Fehler beim Speichern der Einreichung.")

@app.get(f"{FILLED_FORMS_ROUTER_PREFIX}/my_submissions", response_model=FilledFormList, tags=["Formular-Einreichungen"])
async def get_my_submitted_forms_endpoint(
    current_user: ModelUserPublic = Depends(get_current_user)
):
    my_submissions_dicts = filled_form_manager.load_filled_forms_for_user(current_user.id)
    my_submissions_public = [FilledFormPublic.model_validate(s_dict) for s_dict in my_submissions_dicts]
    return FilledFormList(filled_forms=my_submissions_public, total_count=len(my_submissions_public))

@app.get(f"{FILLED_FORMS_ROUTER_PREFIX}/for_template/{{form_template_id}}", response_model=FilledFormList, tags=["Formular-Einreichungen"])
async def get_submissions_for_form_template_endpoint(
    form_template_id: str,
    current_user: ModelUserPublic = Depends(get_current_active_admin_or_mitarbeiter)
):
    form_template_dict = form_manager.load_form(form_template_id)
    if not form_template_dict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Formular-Template mit ID '{form_template_id}' nicht gefunden.")
    submissions_for_template_dicts = filled_form_manager.load_filled_forms_for_form_template(form_template_id)
    submissions_public = [FilledFormPublic.model_validate(s_dict) for s_dict in submissions_for_template_dicts]
    return FilledFormList(filled_forms=submissions_public, total_count=len(submissions_public))

@app.get(f"{FILLED_FORMS_ROUTER_PREFIX}/", response_model=FilledFormList, tags=["Formular-Einreichungen"])
async def get_all_filled_forms_admin_endpoint(current_user: ModelUserPublic = Depends(get_current_active_admin_or_mitarbeiter)): 
    all_filled_forms_dicts = filled_form_manager.load_all_filled_forms()
    all_filled_forms_public = [FilledFormPublic.model_validate(s_dict) for s_dict in all_filled_forms_dicts]
    return FilledFormList(filled_forms=all_filled_forms_public, total_count=len(all_filled_forms_public))

@app.delete(f"{FILLED_FORMS_ROUTER_PREFIX}/{{submission_id}}", response_model=FilledFormDeleteResponse, tags=["Formular-Löschung"])
async def delete_submission_by_id(submission_id: str, current_user: ModelUserPublic = Depends(get_current_active_admin)): 
    manager_response = filled_form_manager.delete_filled_form(submission_id)
    if manager_response["found"]:
        return manager_response
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Ausgefülltes Formular mit der ID {submission_id} wurde nicht gefunden!"
    )

# --- Root Endpunkt ---
@app.get("/", tags=["Allgemein"])
async def read_root():
    return {"message": f"Formular Manager API läuft! Version {app.version}"}
