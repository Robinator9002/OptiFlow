import json
import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, List, Dict

class AccountManager:
    """
    Verwaltet Benutzerkonten, Authentifizierung und Einstellungen sicher.
    FINALE VERSION: Alle Backdoors und unsicheren Verifizierungs-Shortcuts
    wurden für maximale Robustheit und Einfachheit entfernt.
    """

    def __init__(self, data_file: str = "data/users.json", auto_login_time: int = 24):
        self.data_file = data_file
        self.auto_login_time = auto_login_time
        
        os.makedirs(os.path.dirname(data_file), exist_ok=True)
        self.users = self.load_users()

    def load_users(self) -> List[Dict]:
        """Lädt die Benutzerliste aus der JSON-Datei."""
        if not os.path.exists(self.data_file):
            return []
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                content = f.read()
                if not content: return []
                return json.loads(content)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def save_users(self):
        """Speichert die aktuelle Benutzerliste in die JSON-Datei."""
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(self.users, f, indent=4)

    def get_user(self, username: str) -> Optional[Dict]:
        """Sucht und gibt einen Benutzer anhand seines Benutzernamens zurück."""
        return next((user for user in self.users if user.get("username") == username), None)

    def verify_password(self, username: str, password: str) -> bool:
        """Verifiziert ein Passwort sicher mit bcrypt."""
        user = self.get_user(username)
        if not user or 'passwordHash' not in user or not isinstance(password, str):
            return False
        
        try:
            return bcrypt.checkpw(password.encode("utf-8"), user["passwordHash"].encode("utf-8"))
        except (ValueError, TypeError):
            return False

    def create_user(self, username: str, password: str, admin_username: Optional[str], admin_password: Optional[str], is_admin: bool) -> tuple[bool, str]:
        """
        Erstellt einen neuen Benutzer. Wenn keine Benutzer vorhanden sind, wird der erste Benutzer
        automatisch als Administrator erstellt, ohne dass Administrator-Anmeldeinformationen erforderlich sind.
        """
        # NEUE LOGIK: Prüfen, ob dies der erste Benutzer ist
        is_first_user = not self.users

        if not is_first_user:
            # Bestehende Logik für das Hinzufügen von Benutzern durch einen Admin
            if not admin_username or not admin_password:
                return False, "Administrator-Anmeldeinformationen sind erforderlich."
            if not self.verify_password(admin_username, admin_password):
                return False, "Ungültige Administrator-Anmeldedaten."
            admin_user = self.get_user(admin_username)
            if not admin_user or not admin_user.get("isAdmin"):
                return False, "Nur ein Administrator kann neue Benutzer erstellen."
        
        if self.get_user(username):
            return False, f"Benutzername '{username}' bereits vergeben."

        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        
        # NEU: Der erste Benutzer ist immer ein Admin
        new_user_is_admin = is_admin if not is_first_user else True
        
        self.users.append({
            "username": username,
            "passwordHash": password_hash.decode("utf-8"),
            "lastLogin": None,
            "isAdmin": new_user_is_admin,
            "passwordReset": False,
            "settings": {}
        })
        self.save_users()
        
        if is_first_user:
            return True, f"Administrator-Konto '{username}' erfolgreich erstellt."
        return True, f"Benutzer '{username}' erfolgreich erstellt."


    def change_password(self, username: str, old_password: str, admin_username: str, admin_password: str, password_reset: bool, new_password: str) -> bool:
        user = self.get_user(username)
        if password_reset:
            if self.verify_password(admin_username, admin_password) and user:
                user["passwordHash"] = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                user["passwordReset"] = False
                self.save_users()
                return True

        if self.verify_password(username, old_password):
            if user:
                user["passwordHash"] = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                user["passwordReset"] = False
                self.save_users()
                return True
        return False
        
    def change_username(self, current_username: str, password: str, new_username: str) -> tuple[bool, str]:
        """Ändert den Benutzernamen eines Benutzers nach Verifizierung."""
        if not self.verify_password(current_username, password):
            return False, "Falsches Passwort."
        
        if self.get_user(new_username):
            return False, f"Der Benutzername '{new_username}' ist bereits vergeben."

        user = self.get_user(current_username)
        if user:
            user['username'] = new_username
            self.save_users()
            return True, f"Benutzername erfolgreich zu '{new_username}' geändert."
        return False, "Benutzer nicht gefunden."

    def change_admin_status(self, target_username: str, admin_username: str, admin_password: str, new_status: bool) -> tuple[bool, str]:
        """Ändert den Admin-Status eines Benutzers, autorisiert durch einen Admin."""
        if not self.verify_password(admin_username, admin_password):
            return False, "Ungültige Administrator-Anmeldedaten."
        
        admin_user = self.get_user(admin_username)
        if not admin_user or not admin_user.get("isAdmin"):
            return False, "Diese Aktion ist nur für Administratoren."

        target_user = self.get_user(target_username)
        if not target_user:
            return False, f"Zielbenutzer '{target_username}' nicht gefunden."
            
        if target_username == admin_username and not new_status:
            admins = [u for u in self.users if u.get("isAdmin")]
            if len(admins) <= 1:
                return False, "Der letzte Administrator kann seinen Status nicht entfernen."

        target_user['isAdmin'] = new_status
        self.save_users()
        status_text = "erteilt" if new_status else "entzogen"
        return True, f"Admin-Status für '{target_username}' erfolgreich {status_text}."

    def delete_user(self, target_username: str, admin_username: str, admin_password: str) -> tuple[bool, str]:
        if target_username == admin_username:
             admins = [u for u in self.users if u.get("isAdmin")]
             if len(admins) <= 1 and self.get_user(target_username).get("isAdmin"):
                 return False, "Der letzte Administrator kann nicht gelöscht werden."

        if not self.verify_password(admin_username, admin_password):
            return False, "Ungültige Administrator-Anmeldedaten."
        
        admin_user = self.get_user(admin_username)
        if not admin_user or not admin_user.get("isAdmin"):
            return False, "Aktion ist nur für Administratoren."

        original_user_count = len(self.users)
        self.users = [user for user in self.users if user.get("username") != target_username]
        
        if len(self.users) < original_user_count:
            self.save_users()
            return True, f"Benutzer '{target_username}' gelöscht."
        
        return False, f"Benutzer '{target_username}' nicht gefunden."

    def set_last_login(self, username: str):
        user = self.get_user(username)
        if user:
            user["lastLogin"] = datetime.now().isoformat()
            self.save_users()

    def clear_last_login(self, username: str):
        user = self.get_user(username)
        if user:
            user["lastLogin"] = None
            self.save_users()

    def is_auto_login_valid(self, username: str) -> bool:
        user = self.get_user(username)
        if not user or not user.get("lastLogin"):
            return False
        try:
            last_login = datetime.fromisoformat(user["lastLogin"])
            return datetime.now() < last_login + timedelta(hours=self.auto_login_time)
        except (ValueError, TypeError):
            return False

    def get_user_admin_status(self, username: str) -> bool:
        user = self.get_user(username)
        return user.get("isAdmin", False) if user else False

    def save_settings(self, username: str, settings: Dict) -> tuple[bool, str]:
        user = self.get_user(username)
        if user:
            user["settings"] = settings
            self.save_users()
            return True, "Einstellungen erfolgreich gespeichert."
        return False, "Benutzer nicht gefunden."

    def load_settings(self, username: str) -> Optional[Dict]:
        user = self.get_user(username)
        return user.get("settings") if user and "settings" in user else None
