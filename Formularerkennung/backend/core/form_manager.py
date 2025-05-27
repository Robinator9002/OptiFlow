# backend/core/form_manager.py
import uuid
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone # Für updated_at bei Zuweisung

class FormManager:
    """
    Verwaltet die Logik zum Speichern, Laden und Bearbeiten von Formularen.
    Speichert Formulare vorübergehend im Speicher und persistent in einer lokalen Datei.
    """

    def __init__(self, storage_file="forms_data.json"):
        self.storage_file = storage_file
        self._forms: Dict[str, Dict[str, Any]] = {}
        self._element_ids: Dict[str, str] = {} # {element_id: form_id}
        self._load_from_file()

    def _ensure_data_dir_exists(self):
        """Stellt sicher, dass das Verzeichnis für die Storage-Datei existiert."""
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)


    def _generate_unique_id(self, existing_ids: Dict[str, Any]) -> str:
        """Generiert eine eindeutige UUID."""
        while True:
            new_id = str(uuid.uuid4())
            if new_id not in existing_ids:
                return new_id

    def _save_to_file(self):
        """Speichert den aktuellen Zustand der Formulare und Element-IDs in die JSON-Datei."""
        self._ensure_data_dir_exists()
        try:
            # Konvertiere datetime-Objekte zu ISO-Strings für JSON-Serialisierung
            forms_to_save = {}
            for form_id, form_data_dict in self._forms.items():
                form_data_copy = form_data_dict.copy()
                if isinstance(form_data_copy.get("created_at"), datetime):
                    form_data_copy["created_at"] = form_data_copy["created_at"].isoformat()
                if isinstance(form_data_copy.get("updated_at"), datetime):
                    form_data_copy["updated_at"] = form_data_copy["updated_at"].isoformat()
                forms_to_save[form_id] = form_data_copy
            
            data_to_save = {
                "forms": forms_to_save,
                "element_ids": self._element_ids # element_ids sind nur Strings
            }
            with open(self.storage_file, 'w', encoding='utf-8') as f:
                json.dump(data_to_save, f, indent=4, ensure_ascii=False)
            print(f"Formulardaten erfolgreich in '{self.storage_file}' gespeichert.")
        except Exception as e:
            print(f"Fehler beim Speichern der Formulardaten in '{self.storage_file}': {e}")

    def _load_from_file(self):
        """Lädt Formulare und Element-IDs aus der JSON-Datei."""
        self._ensure_data_dir_exists()
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r', encoding='utf-8') as f:
                    data_loaded = json.load(f)
                    
                    loaded_forms_raw = data_loaded.get("forms", {})
                    self._forms = {} # Zurücksetzen vor dem Laden
                    for form_id, form_data in loaded_forms_raw.items():
                        # Konvertiere Timestamps zurück zu datetime-Objekten
                        created_at_raw = form_data.get("created_at")
                        if isinstance(created_at_raw, str):
                            try:
                                form_data["created_at"] = datetime.fromisoformat(created_at_raw)
                            except ValueError:
                                print(f"Warnung: 'created_at' für Formular {form_id} konnte nicht in datetime umgewandelt werden. Setze aktuellen Zeitstempel.")
                                form_data["created_at"] = datetime.now(timezone.utc) # Fallback
                        elif not isinstance(created_at_raw, datetime):
                             form_data["created_at"] = datetime.now(timezone.utc) # Fallback, wenn weder str noch datetime

                        updated_at_raw = form_data.get("updated_at")
                        if isinstance(updated_at_raw, str):
                            try:
                                form_data["updated_at"] = datetime.fromisoformat(updated_at_raw)
                            except ValueError:
                                print(f"Warnung: 'updated_at' für Formular {form_id} konnte nicht in datetime umgewandelt werden. Setze aktuellen Zeitstempel.")
                                form_data["updated_at"] = datetime.now(timezone.utc) # Fallback
                        elif not isinstance(updated_at_raw, datetime):
                            form_data["updated_at"] = datetime.now(timezone.utc) # Fallback

                        # Stelle sicher, dass assigned_to_user_ids immer eine Liste ist
                        if "assigned_to_user_ids" not in form_data or not isinstance(form_data["assigned_to_user_ids"], list):
                            form_data["assigned_to_user_ids"] = []
                            
                        self._forms[form_id] = form_data

                    self._element_ids = data_loaded.get("element_ids", {})
                print(f"Formulardaten erfolgreich aus '{self.storage_file}' geladen.")
            except json.JSONDecodeError:
                print(f"Fehler beim Dekodieren von JSON aus '{self.storage_file}'. Starte mit leerem Formularspeicher.")
                self._forms = {}
                self._element_ids = {}
            except Exception as e:
                print(f"Unerwarteter Fehler beim Laden der Formulardaten aus '{self.storage_file}': {e}")
                self._forms = {}
                self._element_ids = {}
        else:
            print(f"Keine Formular-Speicherdatei unter '{self.storage_file}' gefunden. Starte mit leerem Speicher.")
            self._forms = {}
            self._element_ids = {}

    def save_form(self, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """Speichert ein neues Formular."""
        if "id" not in form_data or not form_data["id"]:
            form_id = self._generate_unique_id(self._forms)
            form_data["id"] = form_id
        else:
            form_id = form_data["id"]
            if form_id in self._forms:
                 raise ValueError(f"Formular mit ID '{form_id}' existiert bereits. Nutzen Sie update_form.")

        # Initialisiere assigned_to_user_ids als leere Liste, falls nicht vorhanden
        if "assigned_to_user_ids" not in form_data:
            form_data["assigned_to_user_ids"] = []
        
        # Stelle sicher, dass Timestamps datetime-Objekte sind oder werden
        created_at_raw = form_data.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at_raw, str): form_data["created_at"] = datetime.fromisoformat(created_at_raw)
        elif not isinstance(created_at_raw, datetime): form_data["created_at"] = datetime.now(timezone.utc)

        updated_at_raw = form_data.get("updated_at", datetime.now(timezone.utc))
        if isinstance(updated_at_raw, str): form_data["updated_at"] = datetime.fromisoformat(updated_at_raw)
        elif not isinstance(updated_at_raw, datetime): form_data["updated_at"] = datetime.now(timezone.utc)


        if "elements" in form_data and isinstance(form_data["elements"], list):
            current_form_element_ids_input = set()
            for element in form_data["elements"]:
                if "id" not in element or not element["id"]:
                    element["id"] = self._generate_unique_id(self._element_ids)
                element_id = element["id"]
                if element_id in self._element_ids and self._element_ids[element_id] != form_id:
                    raise ValueError(f"Element-ID '{element_id}' ist in Formular '{self._element_ids[element_id]}' bereits vergeben.")
                if element_id in current_form_element_ids_input:
                     raise ValueError(f"Element-ID '{element_id}' kommt mehrfach in den übergebenen Formulardaten vor.")
                current_form_element_ids_input.add(element_id)
                self._element_ids[element_id] = form_id
        
        self._forms[form_id] = form_data
        print(f"Formular '{form_data.get('name', form_id)}' mit ID '{form_id}' gespeichert.")
        self._save_to_file()
        return self._forms[form_id]

    def load_form(self, form_id: str) -> Optional[Dict[str, Any]]:
        """Lädt ein Formular anhand seiner ID."""
        return self._forms.get(form_id)

    def load_all_forms(self) -> List[Dict[str, Any]]:
        """Lädt alle gespeicherten Formulare."""
        return list(self._forms.values())

    def update_form(self, form_id: str, form_data_update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Aktualisiert ein bestehendes Formular."""
        if form_id not in self._forms:
            print(f"Formular mit ID '{form_id}' nicht zum Aktualisieren gefunden.")
            return None
        
        original_form = self._forms[form_id]
        # Erstelle eine Kopie, um das Original nicht direkt zu verändern, bevor alles validiert ist
        updated_form_data = original_form.copy() 
        
        # Aktualisiere die Felder aus form_data_update.
        # `assigned_to_user_ids` wird hier nur überschrieben, wenn es in `form_data_update` explizit enthalten ist.
        # Die Hauptlogik für Zuweisungen sollte über `assign_form_to_users` laufen.
        for key, value in form_data_update.items():
            updated_form_data[key] = value
        
        # Stelle sicher, dass 'updated_at' gesetzt/aktualisiert wird und ein datetime-Objekt ist
        updated_at_raw = updated_form_data.get("updated_at", datetime.now(timezone.utc))
        if isinstance(updated_at_raw, str):
            updated_form_data["updated_at"] = datetime.fromisoformat(updated_at_raw)
        elif not isinstance(updated_at_raw, datetime): # Wenn es nicht str oder datetime ist, neu setzen
             updated_form_data["updated_at"] = datetime.now(timezone.utc)


        # Element-ID-Logik (angepasst für `updated_form_data`)
        if "elements" in updated_form_data and isinstance(updated_form_data["elements"], list):
            old_element_ids_in_form = {elem["id"] for elem in original_form.get("elements", []) if "id" in elem}
            new_element_ids_in_form = {elem["id"] for elem in updated_form_data.get("elements", []) if "id" in elem}
            
            removed_element_ids = old_element_ids_in_form - new_element_ids_in_form
            for elem_id in removed_element_ids:
                 if elem_id in self._element_ids and self._element_ids[elem_id] == form_id:
                      del self._element_ids[elem_id]
            
            current_form_element_ids_input = set()
            for element in updated_form_data["elements"]:
                 if "id" not in element or not element["id"]:
                     element["id"] = self._generate_unique_id(self._element_ids)
                 element_id = element["id"]
                 if element_id in self._element_ids and self._element_ids[element_id] != form_id:
                     raise ValueError(f"Element-ID '{element_id}' ist in Formular '{self._element_ids[element_id]}' bereits vergeben.")
                 if element_id in current_form_element_ids_input:
                      raise ValueError(f"Element-ID '{element_id}' kommt mehrfach in den übergebenen Formulardaten für Update vor.")
                 current_form_element_ids_input.add(element_id)
                 self._element_ids[element_id] = form_id
        
        self._forms[form_id] = updated_form_data
        print(f"Formular '{updated_form_data.get('name', form_id)}' mit ID '{form_id}' aktualisiert.")
        self._save_to_file()
        return self._forms[form_id]

    def delete_form(self, form_id: str) -> bool:
        """Löscht ein Formular anhand seiner ID."""
        if form_id in self._forms:
            form_data_to_delete = self._forms[form_id] # Für Element-ID-Bereinigung
            if "elements" in form_data_to_delete and isinstance(form_data_to_delete["elements"], list):
                 for element in form_data_to_delete["elements"]:
                      if "id" in element and element["id"] in self._element_ids and self._element_ids[element["id"]] == form_id:
                           del self._element_ids[element["id"]]
            del self._forms[form_id]
            self._save_to_file()
            print(f"Formular '{form_id}' gelöscht.")
            return True
        print(f"Formular mit ID '{form_id}' nicht zum Löschen gefunden.")
        return False

    def assign_form_to_users(self, form_id: str, user_ids_to_assign: List[str]) -> Optional[Dict[str, Any]]:
        """
        Weist ein Formular einer Liste von Benutzern zu, indem deren IDs zur
        'assigned_to_user_ids'-Liste des Formulars hinzugefügt werden.
        Vermeidet Duplikate in der Liste und aktualisiert 'updated_at'.
        """
        form_to_update = self.load_form(form_id) # Holt das Formular aus dem In-Memory-Speicher
        if not form_to_update:
            print(f"Fehler bei Zuweisung: Formular mit ID '{form_id}' nicht gefunden.")
            return None

        # Stelle sicher, dass 'assigned_to_user_ids' eine Liste ist
        if not isinstance(form_to_update.get("assigned_to_user_ids"), list):
            form_to_update["assigned_to_user_ids"] = []

        current_assigned_ids_set = set(form_to_update["assigned_to_user_ids"])
        added_new_users = False
        for user_id in user_ids_to_assign:
            if user_id not in current_assigned_ids_set: 
                current_assigned_ids_set.add(user_id)
                added_new_users = True
        
        if added_new_users: # Nur aktualisieren und speichern, wenn sich etwas geändert hat
            form_to_update["assigned_to_user_ids"] = sorted(list(current_assigned_ids_set)) # Sortiert für Konsistenz
            
            # Zuweisung ist eine Art Update, also 'updated_at' aktualisieren
            form_to_update["updated_at"] = datetime.now(timezone.utc) 
            
            self._forms[form_id] = form_to_update # Im In-Memory-Speicher aktualisieren
            self._save_to_file() # Und persistieren
            print(f"Formular '{form_id}' aktualisiert mit Zuweisungen: {form_to_update['assigned_to_user_ids']}")
        else:
            print(f"Keine neuen Benutzer zu Formular '{form_id}' zugewiesen. Bestehende Zuweisungen: {form_to_update['assigned_to_user_ids']}")
            
        return form_to_update
