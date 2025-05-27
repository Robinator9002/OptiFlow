# backend/core/account_manager.py
import json
import os
import uuid
from typing import Dict, Optional, Tuple, Any, List
from datetime import datetime, timezone
import random
import string

from backend.api.models import UserRole, UserInDB, UserPublic as ModelUserPublic, UserSettingsBase, UserSettingsUpdate, EmailStr

CORE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CORE_DIR)
USERS_STORAGE_FILE_DEFAULT = os.path.join(BACKEND_DIR, "../../data/users_data.json")

MASTER_ADMIN_PASSWORD = "dup1992" # Nur für Demo-Zwecke, wird jetzt weniger verwendet

class AccountManager:
    def __init__(self, storage_file: str = USERS_STORAGE_FILE_DEFAULT):
        self.storage_file = storage_file
        self._users: Dict[str, UserInDB] = {}
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        self._load_users_from_file()
        self._ensure_default_users()

    def _ensure_default_users(self):
        # ... (Initialisiert 'settings' und 'last_login' für Default-User) ...
        admin_changed = False
        testuser_changed = False
        initial_save_needed = not os.path.exists(self.storage_file)

        if not any(user.role == UserRole.ADMIN for user in self._users.values()):
            print("Kein Admin-Benutzer gefunden. Erstelle Standard-Admin 'admin' mit Passwort 'admin'.")
            _, _, admin_user = self.register_user_internal(
                username="admin", email="admin@formular-manager.local",
                password_plaintext="admin", role=UserRole.ADMIN, is_initial_setup=True
            )
            if admin_user:
                admin_user.settings = UserSettingsBase()
                admin_user.last_login = None
            admin_changed = True
        
        testuser_username = "testuser"
        testuser_password = "testpassword"
        expected_testuser_hash = self._hash_password(testuser_password)
        current_testuser = self._users.get(testuser_username)

        if not current_testuser:
            print(f"Erstelle Standard-Mitarbeiter '{testuser_username}' mit Passwort '{testuser_password}'.")
            _, _, new_testuser = self.register_user_internal(
                username=testuser_username, email="testuser@formular-manager.local",
                password_plaintext=testuser_password, role=UserRole.MITARBEITER, is_initial_setup=True
            )
            if new_testuser:
                 new_testuser.settings = UserSettingsBase()
                 new_testuser.last_login = None
            testuser_changed = True
        elif current_testuser:
            changed_in_elif = False
            if current_testuser.password_hash != expected_testuser_hash or \
               current_testuser.role != UserRole.MITARBEITER or \
               not current_testuser.is_active:
                current_testuser.password_hash = expected_testuser_hash
                current_testuser.role = UserRole.MITARBEITER
                current_testuser.is_active = True
                changed_in_elif = True
            if not current_testuser.settings:
                current_testuser.settings = UserSettingsBase()
                changed_in_elif = True
            if not hasattr(current_testuser, 'last_login') or current_testuser.last_login is None: # Check for None too
                current_testuser.last_login = None # Explicitly set to None if missing
                changed_in_elif = True
            if changed_in_elif:
                testuser_changed = True
        
        if admin_changed or testuser_changed or initial_save_needed:
            self._save_users_to_file()


    def _load_users_from_file(self):
        # ... (Stellt sicher, dass 'settings' und 'last_login' korrekt geladen werden) ...
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r', encoding='utf-8') as f:
                    data_loaded = json.load(f)
                    loaded_users_raw = data_loaded.get("users", {})
                    self._users = {}
                    for username, user_data_dict in loaded_users_raw.items():
                        settings_data = user_data_dict.pop("settings", None)
                        last_login_str = user_data_dict.pop("last_login", None)

                        user_obj = UserInDB(**user_data_dict)
                        
                        if settings_data and isinstance(settings_data, dict):
                            user_obj.settings = UserSettingsBase(**settings_data)
                        elif not user_obj.settings: # Should be caught by UserInDB default_factory
                            user_obj.settings = UserSettingsBase()
                        
                        if last_login_str and isinstance(last_login_str, str):
                            try:
                                user_obj.last_login = datetime.fromisoformat(last_login_str)
                            except ValueError:
                                user_obj.last_login = None 
                        elif not hasattr(user_obj, 'last_login'): 
                            user_obj.last_login = None
                        
                        self._users[username] = user_obj
                print(f"Benutzerdaten erfolgreich aus '{self.storage_file}' geladen.")
            except Exception as e:
                print(f"Fehler beim Laden der Benutzerdaten aus '{self.storage_file}': {e}")
                self._users = {}
        else:
            self._users = {}

    def _save_users_to_file(self):
        # ... (Speichert 'settings' und 'last_login' korrekt) ...
        try:
            os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
            users_to_save = {}
            for username, user_obj in self._users.items():
                user_data_dict = user_obj.model_dump(mode='json') 
                # settings sollte dank default_factory in UserInDB immer existieren
                user_data_dict["settings"] = user_obj.settings.model_dump(mode='json')
                
                if user_obj.last_login:
                    user_data_dict["last_login"] = user_obj.last_login.isoformat()
                else:
                    user_data_dict["last_login"] = None # Explizit None speichern

                users_to_save[username] = user_data_dict

            with open(self.storage_file, 'w', encoding='utf-8') as f:
                json.dump({"users": users_to_save}, f, indent=4, ensure_ascii=False)
            print(f"Benutzerdaten erfolgreich in '{self.storage_file}' gespeichert.")
        except Exception as e:
            print(f"Fehler beim Speichern der Benutzerdaten in '{self.storage_file}': {e}")


    def _hash_password(self, password: str) -> str:
        return f"hashed_{password}"

    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return self._hash_password(plain_password) == hashed_password
    
    def _generate_temporary_password(self, length: int = 12) -> str:
        characters = string.ascii_letters + string.digits + "!@#$%^&*" # Sicherere Zeichenauswahl
        return ''.join(random.choice(characters) for i in range(length))

    def get_user(self, username: str) -> Optional[UserInDB]:
        return self._users.get(username)

    def get_user_by_id(self, user_id: str) -> Optional[UserInDB]:
        for user in self._users.values():
            if user.id == user_id: return user
        return None

    def get_all_users(self) -> List[UserInDB]:
        if not self._users:
            self._load_users_from_file()
            self._ensure_default_users()
        return list(self._users.values())
    
    def verify_admin_credentials(self, admin_username: str, admin_password_plaintext: str) -> bool:
        """Prüft Admin-Credentials. True wenn Master-PW oder korrektes Admin-PW."""
        if admin_password_plaintext == MASTER_ADMIN_PASSWORD and admin_username == "admin": # Master PW nur für "admin" User
            print("Master-Admin-Passwort für 'admin' verwendet.")
            return True
        admin_user = self.get_user(admin_username)
        if admin_user and admin_user.role == UserRole.ADMIN and admin_user.is_active:
            if self._verify_password(admin_password_plaintext, admin_user.password_hash):
                print(f"Admin '{admin_username}' erfolgreich authentifiziert.")
                return True
        print(f"Admin-Authentifizierung fehlgeschlagen für Benutzer: {admin_username}")
        return False

    def register_user_internal(
        self, username: str, email: Optional[str], password_plaintext: str, role: UserRole, is_initial_setup: bool = False
    ) -> Tuple[bool, str, Optional[UserInDB]]:
        # ... (Logik bleibt unverändert, stellt sicher, dass last_login=None gesetzt wird) ...
        if not is_initial_setup and username in self._users:
            return False, "Benutzername bereits vergeben.", None
        
        new_user = UserInDB(
            id=str(uuid.uuid4()), username=username, email=email,
            password_hash=self._hash_password(password_plaintext), role=role, is_active=True,
            settings=UserSettingsBase(),
            last_login=None 
        )
        self._users[username] = new_user
        print(f"Benutzer '{username}' ({role.value}) intern verarbeitet.")
        return True, "Benutzer erfolgreich registriert.", new_user


    def register_user_by_admin(
        self, admin_username: str, admin_password_plaintext: str,
        new_username: str, new_email: Optional[str], new_password_plaintext: str, new_user_role: UserRole,
    ) -> Tuple[bool, str, Optional[ModelUserPublic]]:
        # ... (Logik bleibt unverändert) ...
        if not self.verify_admin_credentials(admin_username, admin_password_plaintext):
            return False, "Admin-Authentifizierung fehlgeschlagen.", None
        
        success, message, new_user_db_internal = self.register_user_internal(
            new_username, new_email, new_password_plaintext, new_user_role, is_initial_setup=False
        )
        if success and new_user_db_internal:
            self._save_users_to_file()
            return success, message, ModelUserPublic.model_validate(new_user_db_internal)
        return success, message, None

    def login_user(self, username: str, password_plaintext: str) -> Optional[Dict[str, Any]]:
        user = self.get_user(username)
        if not user or not user.is_active:
            return None
        if self._verify_password(password_plaintext, user.password_hash):
            user.last_login = datetime.now(timezone.utc) # Letzten Login aktualisieren
            self._save_users_to_file()
            user_public_data = ModelUserPublic.model_validate(user)
            return {"access_token": f"dummy_auth_token_for_{username}", "token_type": "bearer", "user": user_public_data}
        return None

    # --- Bestehende Account-Aktionen (Selbstbedienung) ---
    # ... (get_user_settings, update_user_settings, change_user_password, change_user_email, change_user_username bleiben unverändert) ...
    def get_user_settings(self, username: str) -> Optional[UserSettingsBase]:
        user = self.get_user(username)
        if user:
            if not user.settings: 
                user.settings = UserSettingsBase()
                self._save_users_to_file() 
            return user.settings
        return None

    def update_user_settings(self, username: str, settings_update_data: UserSettingsUpdate) -> Optional[UserSettingsBase]:
        user = self.get_user(username)
        if not user: return None
        if user.settings is None: user.settings = UserSettingsBase()
        update_data_dict = settings_update_data.model_dump(exclude_unset=True)
        if not update_data_dict: return user.settings
        for key, value in update_data_dict.items():
            if hasattr(user.settings, key): setattr(user.settings, key, value)
        self._save_users_to_file()
        return user.settings

    def change_user_password(self, username: str, current_password_plaintext: str, new_password_plaintext: str) -> Tuple[bool, str]:
        user = self.get_user(username)
        if not user: return False, "Benutzer nicht gefunden."
        if not self._verify_password(current_password_plaintext, user.password_hash):
            return False, "Aktuelles Passwort ist falsch."
        user.password_hash = self._hash_password(new_password_plaintext)
        self._save_users_to_file()
        return True, "Passwort erfolgreich geändert."

    def change_user_email(self, username: str, password_plaintext: str, new_email: EmailStr) -> Tuple[bool, str]:
        user = self.get_user(username)
        if not user: return False, "Benutzer nicht gefunden."
        if not self._verify_password(password_plaintext, user.password_hash):
            return False, "Passwort zur Bestätigung der E-Mail-Änderung ist falsch."
        for u in self._users.values():
            if u.email == new_email and u.username != username:
                return False, f"Die E-Mail-Adresse '{new_email}' wird bereits von einem anderen Benutzer verwendet."
        user.email = new_email
        self._save_users_to_file()
        return True, "E-Mail-Adresse erfolgreich geändert."

    def change_user_username(self, current_username: str, password_plaintext: str, new_username: str) -> Tuple[bool, str, Optional[ModelUserPublic]]:
        user = self.get_user(current_username)
        if not user: return False, "Benutzer nicht gefunden.", None
        if not self._verify_password(password_plaintext, user.password_hash):
            return False, "Passwort zur Bestätigung der Benutzernamensänderung ist falsch.", None
        if new_username == current_username: return False, "Der neue Benutzername ist identisch mit dem aktuellen.", None
        if new_username in self._users: return False, f"Der Benutzername '{new_username}' ist bereits vergeben.", None
        
        user_copy = user.model_copy(deep=True) 
        user_copy.username = new_username 
        
        del self._users[current_username] 
        self._users[new_username] = user_copy 
        
        self._save_users_to_file()
        return True, "Benutzername erfolgreich geändert. Bitte melden Sie sich erneut an.", ModelUserPublic.model_validate(user_copy)

    # --- Account-Löschung und Admin-Funktionen ---
    def delete_own_account(self, username: str, password_plaintext: str) -> Tuple[bool, str]:
        user_to_delete = self.get_user(username)
        if not user_to_delete:
            return False, "Benutzer nicht gefunden."
        if not self._verify_password(password_plaintext, user_to_delete.password_hash):
            return False, "Das eingegebene Passwort ist falsch."
        if user_to_delete.role == UserRole.ADMIN:
            active_admins = [u for u in self._users.values() if u.role == UserRole.ADMIN and u.is_active]
            if len(active_admins) <= 1 and user_to_delete.username in [admin.username for admin in active_admins]:
                return False, "Der letzte aktive Administrator kann nicht gelöscht werden."
        del self._users[username]
        self._save_users_to_file()
        return True, "Ihr Account wurde erfolgreich gelöscht."

    def admin_delete_user( # Umbenannt von delete_user_by_admin für Konsistenz
        self, requesting_admin_username: str, admin_password_to_confirm: str, username_to_delete: str
    ) -> Tuple[bool, str]:
        if not self.verify_admin_credentials(requesting_admin_username, admin_password_to_confirm):
            return False, "Admin-Authentifizierung für Löschaktion fehlgeschlagen."
        # ... (Rest der Logik wie in deinem delete_user_by_admin) ...
        user_to_delete = self.get_user(username_to_delete)
        if not user_to_delete:
            return False, f"Benutzer '{username_to_delete}' zum Löschen nicht gefunden."
        if user_to_delete.role == UserRole.ADMIN and user_to_delete.username == requesting_admin_username:
            # Verhindere, dass sich ein Admin selbst löscht, wenn er der einzige Admin ist
            # Diese Logik ist etwas anders als in delete_own_account, da hier ein Admin einen *anderen* Admin löschen könnte
            # oder sich selbst, wenn es andere Admins gibt.
            admin_count = sum(1 for u in self._users.values() if u.role == UserRole.ADMIN and u.is_active)
            if admin_count <= 1 and user_to_delete.username == requesting_admin_username : # Nur wenn er sich selbst löscht UND letzter Admin ist
                return False, "Der letzte aktive Administrator kann nicht gelöscht werden."
        
        # Zusätzliche Prüfung: Ein Admin kann nicht den "admin"-Superuser löschen, wenn er nicht selbst "admin" ist
        if username_to_delete == "admin" and requesting_admin_username != "admin":
            return False, "Nur der Hauptadministrator 'admin' kann sich selbst (oder andere Admins) löschen, wenn er der letzte ist."

        del self._users[username_to_delete]
        self._save_users_to_file()
        return True, f"Benutzer '{username_to_delete}' erfolgreich von Admin '{requesting_admin_username}' gelöscht."


    def admin_update_user_role(
        self, requesting_admin_username: str, requesting_admin_password: str, 
        target_username: str, new_role: UserRole
    ) -> Tuple[bool, str, Optional[ModelUserPublic]]:
        if not self.verify_admin_credentials(requesting_admin_username, requesting_admin_password):
            return False, "Admin-Authentifizierung fehlgeschlagen.", None
        
        target_user = self.get_user(target_username)
        if not target_user:
            return False, f"Zielbenutzer '{target_username}' nicht gefunden.", None

        if target_user.username == requesting_admin_username and target_user.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
            active_admins = [u for u in self._users.values() if u.role == UserRole.ADMIN and u.is_active]
            if len(active_admins) <= 1:
                return False, "Sie können sich nicht selbst die Admin-Rechte entziehen, da Sie der letzte aktive Administrator sind.", None
        
        target_user.role = new_role
        self._save_users_to_file()
        return True, f"Rolle von '{target_username}' erfolgreich zu '{new_role.value}' geändert.", ModelUserPublic.model_validate(target_user)

    def admin_reset_user_password(
        self, requesting_admin_username: str, requesting_admin_password: str, 
        target_username: str
    ) -> Tuple[bool, str, Optional[str]]:
        if not self.verify_admin_credentials(requesting_admin_username, requesting_admin_password):
            return False, "Admin-Authentifizierung fehlgeschlagen.", None
        
        target_user = self.get_user(target_username)
        if not target_user:
            return False, f"Zielbenutzer '{target_username}' nicht gefunden.", None

        temporary_password = self._generate_temporary_password()
        target_user.password_hash = self._hash_password(temporary_password)
        self._save_users_to_file()
        return True, f"Passwort für '{target_username}' wurde zurückgesetzt.", temporary_password
