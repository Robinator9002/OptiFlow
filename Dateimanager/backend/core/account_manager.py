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
        """
        Initialisiert den AccountManager.
        Die hardcodierte 'admin_backup' Backdoor wurde entfernt.
        """
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

    def create_user(self, username: str, password: str, admin_username: str, admin_password: str, is_admin: bool) -> tuple[bool, str]:
        """Erstellt einen neuen Benutzer, verifiziert durch einen Administrator."""
        if not self.verify_password(admin_username, admin_password):
            return False, "Ungültige Administrator-Anmeldedaten."

        admin_user = self.get_user(admin_username)
        if not admin_user or not admin_user.get("isAdmin"):
            return False, "Nur ein Administrator kann neue Benutzer erstellen."

        if self.get_user(username):
            return False, f"Benutzername '{username}' bereits vergeben."

        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.users.append({
            "username": username,
            "passwordHash": password_hash.decode("utf-8"),
            "lastLogin": None,
            "isAdmin": is_admin,
            "passwordReset": False,
            "settings": {}
        })
        self.save_users()
        return True, f"Benutzer '{username}' erfolgreich erstellt."

    def get_user(self, username: str) -> Optional[Dict]:
        """Sucht und gibt einen Benutzer anhand seines Benutzernamens zurück."""
        return next((user for user in self.users if user.get("username") == username), None)

    def change_password(self, username: str, old_password: str, new_password: str) -> bool:
        """Ändert das Passwort eines Benutzers nach Verifizierung des alten Passworts."""
        if self.verify_password(username, old_password):
            user = self.get_user(username)
            if user:
                user["passwordHash"] = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                user["passwordReset"] = False
                self.save_users()
                return True
        return False

    def request_password_reset(self, target_username: str, admin_username: str, admin_password: str) -> bool:
        """Setzt das 'passwordReset'-Flag für einen Benutzer, autorisiert durch einen Admin."""
        if self.verify_password(admin_username, admin_password):
            admin_user = self.get_user(admin_username)
            if admin_user and admin_user.get("isAdmin"):
                target_user = self.get_user(target_username)
                if target_user:
                    target_user["passwordReset"] = True
                    self.save_users()
                    return True
        return False

    def delete_user(self, target_username: str, admin_username: str, admin_password: str) -> tuple[bool, str]:
        """Löscht einen Benutzer, autorisiert durch das Passwort des ausführenden Admins."""
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

    def verify_password(self, username: str, password: str) -> bool:
        """
        Verifiziert ein Passwort sicher mit bcrypt. Dies ist die EINZIGE Methode
        zur Passwortprüfung. Alle unsicheren Varianten (`check_hash`, `admin_backup`,
        `passwordReset`-Bypass) wurden entfernt.
        """
        user = self.get_user(username)
        if not user or 'passwordHash' not in user or not isinstance(password, str):
            return False
        
        try:
            return bcrypt.checkpw(password.encode("utf-8"), user["passwordHash"].encode("utf-8"))
        except (ValueError, TypeError):
            return False

    def set_last_login(self, username: str):
        """Setzt den Zeitstempel des letzten Logins."""
        user = self.get_user(username)
        if user:
            user["lastLogin"] = datetime.now().isoformat()
            self.save_users()

    def clear_last_login(self, username: str):
        """Entfernt den Zeitstempel des letzten Logins."""
        user = self.get_user(username)
        if user:
            user["lastLogin"] = None
            self.save_users()

    def is_auto_login_valid(self, username: str) -> bool:
        """Prüft, ob der Auto-Login-Zeitraum noch gültig ist."""
        user = self.get_user(username)
        if not user or not user.get("lastLogin"):
            return False
        try:
            last_login = datetime.fromisoformat(user["lastLogin"])
            return datetime.now() < last_login + timedelta(hours=self.auto_login_time)
        except (ValueError, TypeError):
            return False

    def get_user_admin_status(self, username: str) -> bool:
        """Gibt den Admin-Status eines Benutzers zurück."""
        user = self.get_user(username)
        return user.get("isAdmin", False) if user else False

    def get_user_password_reset_status(self, username: str) -> bool:
        """Gibt zurück, ob für einen Benutzer ein Passwort-Reset angefordert wurde."""
        user = self.get_user(username)
        return user.get("passwordReset", False) if user else False

    def save_settings(self, username: str, settings: Dict) -> tuple[bool, str]:
        """Speichert die Einstellungen für einen Benutzer."""
        user = self.get_user(username)
        if user:
            user["settings"] = settings
            self.save_users()
            return True, "Einstellungen erfolgreich gespeichert."
        return False, "Benutzer nicht gefunden."

    def load_settings(self, username: str) -> Optional[Dict]:
        """Lädt die Einstellungen für einen Benutzer."""
        user = self.get_user(username)
        return user.get("settings") if user and "settings" in user else None
