# backend/api/models.py
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, EmailStr
import uuid
from datetime import datetime, timezone
from enum import Enum

# --- Nutzerrollen Enum ---
class UserRole(str, Enum):
    ADMIN = "admin"
    MITARBEITER = "mitarbeiter"
    KUNDE = "kunde"

# --- Modelle für Formular-Elemente ---
class FormElementBase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    position: Dict[str, Any]
    size: Dict[str, Any] = Field(default_factory=lambda: {"width": 100, "height": 50})
    properties: Dict[str, Any] = Field(default_factory=dict)

# --- Modelle für das gesamte Formular ---
class FormBase(BaseModel):
    name: str
    description: Optional[str] = None
    version: int = Field(default=1)
    elements: List[FormElementBase] = Field(default_factory=list)

class FormCreate(FormBase):
    pass

class FormPublic(FormBase):
    id: str
    created_by_id: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_to_user_ids: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True

class FormUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[int] = None
    elements: Optional[List[FormElementBase]] = None
    assigned_to_user_ids: Optional[List[str]] = None

class FormList(BaseModel):
    forms: List[FormPublic] = Field(default_factory=list)
    total_count: int = 0

# --- Modelle für Benutzerauthentifizierung und -verwaltung ---
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_.-]+$")
    email: Optional[EmailStr] = None

class UserCreatePayload(UserBase):
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.KUNDE

class AdminAuthPayload(BaseModel): # Wird für Aktionen verwendet, die Admin-PW erfordern
    admin_username: str # Der Admin, der die Aktion ausführt
    admin_password: str # Das Passwort dieses Admins

class UserRegistrationRequest(BaseModel):
    admin_credentials: AdminAuthPayload # Bleibt für die Registrierung
    new_user_details: UserCreatePayload

class UserSettingsBase(BaseModel):
    theme: Optional[str] = "default"
    font_size_multiplier: Optional[float] = Field(1.0, ge=0.5, le=2.0)

class UserSettingsPublic(UserSettingsBase):
    pass

class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    font_size_multiplier: Optional[float] = Field(None, ge=0.5, le=2.0)

class UserPublic(UserBase):
    id: str
    role: UserRole
    is_active: bool = True
    last_login: Optional[datetime] = None # Für Admin-Übersicht

    class Config:
        from_attributes = True

class UserInDB(UserPublic):
    password_hash: str
    settings: Optional[UserSettingsBase] = Field(default_factory=UserSettingsBase)

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserPublic

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[UserRole] = None

class UserDeleteByAdminRequest(BaseModel): # Für Admin löscht anderen User
    admin_password: str # Passwort des Admins, der die Aktion durchführt
    username_to_delete: str

class UserListResponse(BaseModel):
    users: List[UserPublic]
    total_count: int

# --- Modelle für Account-Aktionen (Selbstbedienung & Admin) ---
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class ChangeEmailRequest(BaseModel):
    password: str
    new_email: EmailStr

class ChangeUsernameRequest(BaseModel):
    password: str
    new_username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_.-]+$")

class DeleteOwnAccountRequest(BaseModel):
    password: str # Passwort des Benutzers, der seinen eigenen Account löscht

# NEU: Modelle für Admin-Aktionen zur Benutzerverwaltung, die Admin-Passwort erfordern
class AdminActionBaseRequest(BaseModel): # Basis für Admin-Aktionen, die Admin-PW erfordern
    requesting_admin_password: str = Field(..., description="Passwort des Admins, der die Aktion ausführt.")

class AdminUpdateUserRoleRequest(AdminActionBaseRequest):
    new_role: UserRole

class AdminResetPasswordRequest(AdminActionBaseRequest):
    pass # Keine weiteren Felder, target_username kommt aus Pfad

class AdminResetPasswordResponse(BaseModel):
    message: str
    new_temporary_password: Optional[str] = None

# --- Modelle für das Zuweisen von Formularen & Einreichungen ---
# ... (Rest bleibt unverändert) ...
class AssignFormRequest(BaseModel):
    user_ids_to_assign: List[str]

class FormDataEntry(BaseModel):
    element_id: str
    value: Any

class FilledFormCreate(BaseModel):
    form_template_id: str
    entries: List[FormDataEntry]

class FilledFormPublic(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    form_template_id: str
    submitted_by_user_id: str
    entries: List[FormDataEntry]
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    class Config: from_attributes = True

class FilledFormList(BaseModel):
    filled_forms: List[FilledFormPublic] = Field(default_factory=list)
    total_count: int = 0

class FilledFormDeleteResponse(BaseModel):
    message: str
    found: bool
