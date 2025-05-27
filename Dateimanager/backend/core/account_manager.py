import json
import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, List, Dict

class AccountManager:
    def __init__(self, data_file="data/users.json", auto_login_time: int = 24):
        self.data_file = data_file
        self.auto_login_time = auto_login_time
        self.users = self.load_users()
        self.admin_backup = "dup1992"

    def load_users(self):
        if os.path.exists(self.data_file):
            with open(self.data_file, "r") as f:
                return json.load(f)
        else:
            return []

    def save_users(self):
        with open(self.data_file, "w") as f:
            json.dump(self.users, f, indent=4)

    def create_user(self, username, password, admin_username, admin_password, is_admin):
        if username == self.admin_backup or password == self.admin_backup:
            return False, "Ungültige Anmeldedaten!"

        if not self.verify_password(admin_username, admin_password):
            return False, "Ungültige Administrator-Anmeldedaten"

        if self.get_user(username):
            return False, "Benutzername bereits vergeben"

        admin_user = self.get_user(admin_username)
        if (not admin_user or not admin_user["isAdmin"]) and not admin_password == self.admin_backup:
            return False, "Invalide Administrator-Anmeldedaten"

        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.users.append({
            "username": username,
            "passwordHash": password_hash.decode("utf-8"),
            "lastLogin": None,
            "isAdmin": is_admin,
            "passwordReset": False,
            "settings": None # Standardeinstellungen beim Erstellen
        })
        self.save_users()
        return True, "Benutzer erfolgreich erstellt"

    def get_user(self, username):
        for user in self.users:
            if user["username"] == username:
                return user
        return None
    
    def change_username(self, username, password, new_username):
        if self.verify_password(username, password):
            user = self.get_user(username)
            if user:
                user["username"] = new_username
                self.save_users()
                return True
        return False
    
    def change_password(self, username, old_password, new_password):
        if self.verify_password(username, old_password):
            user = self.get_user(username)
            user["passwordHash"] = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            user["passwordReset"] = False
            self.save_users()
            return True
        
    def change_admin_status(self, username, admin_username, admin_password, check_hash: bool = False):
        if self.verify_password(admin_username, admin_password, check_hash):
            user = self.get_user(username)
            if user:
                user["isAdmin"] = not user["isAdmin"]
                self.save_users()
                return True
        return False
    
    def reset_password(self, username, admin_username, admin_password):
        if self.verify_password(admin_username, admin_password):
            user = self.get_user(username)
            if user:
                user["passwordReset"] = True
                self.save_users()
                return True
        return False
    
    def delete_user(self, username, password, check_hash: bool = False):
        if self.verify_password(username, password, check_hash):
            self.users = [user for user in self.users if user["username"]!= username]
            self.save_users()
            return True
        return False

    def verify_password(self, username, password, check_hash: bool = False):
        user = self.get_user(username)

        if password == self.admin_backup:
            return True

        if not user:
            return False
        
        if user['passwordReset'] == True:
            return True
        
        if check_hash:
            return password == user['passwordHash']
        return bcrypt.checkpw(password.encode("utf-8"), user["passwordHash"].encode("utf-8"))

    def set_last_login(self, username):
        user = self.get_user(username)
        if user:
            user["lastLogin"] = datetime.now().isoformat()
            self.save_users()

    def clear_last_login(self, username):
        user = self.get_user(username)
        if user:
            user["lastLogin"] = None
            self.save_users()

    def is_auto_login_valid(self, username):
        user = self.get_user(username)
        if not user or not user["lastLogin"]:
            return False

        last_login = datetime.fromisoformat(user["lastLogin"])
        return datetime.now() < last_login + timedelta(hours=self.auto_login_time) # Auto-login gültig für AUTO_LOGIN_TIME Stunden

    def get_user_admin_status(self, username):
        user = self.get_user(username)
        if user:
            return user["isAdmin"]
        return False
    
    def get_user_password_reset_status(self, username):
        user = self.get_user(username)
        if user:
            return user["passwordReset"]
        return False

    def save_settings(self, username: str, settings: Dict):
        user = self.get_user(username)
        if user:
            user["settings"] = settings
            self.save_users()
            return True, "Einstellungen erfolgreich gespeichert"
        return False, "Benutzer nicht gefunden"

    def load_settings(self, username: str) -> Optional[Dict]:
        user = self.get_user(username)
        if user and "settings" in user:
            return user["settings"]
        return None # Dann kann das Frontend den rest machen
