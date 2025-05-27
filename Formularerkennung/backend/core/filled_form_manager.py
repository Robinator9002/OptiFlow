# backend/core/filled_form_manager.py
import json
import os
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

# Importiere das Pydantic-Modell, um die Struktur zu kennen, obwohl wir Dicts speichern
from backend.api.models import FilledFormPublic # Hilft bei der Typ-Annotation und mentalen Modell


class FilledFormManager:
    """
    Verwaltet die Logik zum Speichern und Laden von ausgefüllten Formularen.
    Speichert Daten in einer lokalen JSON-Datei.
    Stellt sicher, dass pro Benutzer und Formular-Template nur die neueste Einreichung gespeichert wird.
    """
    def __init__(self, storage_file: str):
        self.storage_file = storage_file
        # In-Memory-Speicher für ausgefüllte Formulare: {submission_id: filled_form_data_dict}
        self._filled_forms: Dict[str, Dict[str, Any]] = {}
        self._load_from_file()

    def _ensure_data_dir_exists(self):
        """Stellt sicher, dass das Verzeichnis für die Storage-Datei existiert."""
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)

    def _load_from_file(self):
        """Lädt ausgefüllte Formulardaten aus der JSON-Datei."""
        self._ensure_data_dir_exists()
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, 'r', encoding='utf-8') as f:
                    data_loaded = json.load(f)
                    loaded_submissions = data_loaded.get("filled_forms", {})
                    self._filled_forms = {} # Zurücksetzen vor dem Laden
                    for ff_id, ff_data in loaded_submissions.items():
                        if isinstance(ff_data.get("submitted_at"), str):
                            try:
                                ff_data["submitted_at"] = datetime.fromisoformat(ff_data["submitted_at"])
                            except ValueError:
                                print(f"Warnung: Konnte 'submitted_at' für Einreichung {ff_id} nicht in datetime umwandeln. Verwende aktuellen Zeitstempel.")
                                ff_data["submitted_at"] = datetime.now(timezone.utc)
                        elif not isinstance(ff_data.get("submitted_at"), datetime):
                             ff_data["submitted_at"] = datetime.now(timezone.utc) # Fallback
                        self._filled_forms[ff_id] = ff_data
                print(f"Ausgefüllte Formulardaten erfolgreich aus '{self.storage_file}' geladen.")
            except json.JSONDecodeError:
                print(f"Fehler beim Dekodieren von JSON aus '{self.storage_file}' (ausgefüllte Formulare). Starte mit leerem Speicher.")
                self._filled_forms = {}
            except Exception as e:
                print(f"Unerwarteter Fehler beim Laden der ausgefüllten Formulardaten aus '{self.storage_file}': {e}")
                self._filled_forms = {}
        else:
            print(f"Keine Speicherdatei für ausgefüllte Formulare unter '{self.storage_file}' gefunden. Starte mit leerem Speicher.")
            self._filled_forms = {}

    def _save_to_file(self):
        """Speichert die aktuellen ausgefüllten Formulardaten in die JSON-Datei."""
        self._ensure_data_dir_exists()
        try:
            data_to_save = {}
            for ff_id, ff_data_dict in self._filled_forms.items():
                ff_data_copy = ff_data_dict.copy()
                if isinstance(ff_data_copy.get("submitted_at"), datetime):
                    ff_data_copy["submitted_at"] = ff_data_copy["submitted_at"].isoformat()
                data_to_save[ff_id] = ff_data_copy

            with open(self.storage_file, 'w', encoding='utf-8') as f:
                json.dump({"filled_forms": data_to_save}, f, indent=4, ensure_ascii=False)
            print(f"Ausgefüllte Formulardaten erfolgreich in '{self.storage_file}' gespeichert.")
        except Exception as e:
            print(f"Fehler beim Speichern der ausgefüllten Formulardaten in '{self.storage_file}': {e}")

    def save_filled_form(self, filled_form_data_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Speichert ein ausgefülltes Formular. Wenn bereits eine Einreichung vom selben Benutzer
        für dasselbe Formular-Template existiert, wird die alte Einreichung entfernt.
        Erwartet 'form_template_id', 'submitted_by_user_id', 'entries'.
        'id' und 'submitted_at' werden hier generiert/gesetzt.
        """
        form_template_id = filled_form_data_dict.get("form_template_id")
        submitted_by_user_id = filled_form_data_dict.get("submitted_by_user_id")

        if not form_template_id or not submitted_by_user_id:
            raise ValueError("form_template_id und submitted_by_user_id sind erforderlich.")

        # Finde und entferne existierende Einreichungen desselben Benutzers für dasselbe Template
        existing_submission_id_to_delete: Optional[str] = None
        for sub_id, sub_data in self._filled_forms.items():
            if sub_data.get("form_template_id") == form_template_id and \
               sub_data.get("submitted_by_user_id") == submitted_by_user_id:
                existing_submission_id_to_delete = sub_id
                break 
        
        if existing_submission_id_to_delete:
            print(f"Entferne alte Einreichung '{existing_submission_id_to_delete}' für Template '{form_template_id}' von Benutzer '{submitted_by_user_id}'.")
            del self._filled_forms[existing_submission_id_to_delete]

        # Erstelle eine neue ID für die aktuelle Einreichung
        new_submission_id = str(uuid.uuid4())
        filled_form_data_dict["id"] = new_submission_id
        
        # Stelle sicher, dass 'submitted_at' ein datetime-Objekt ist und aktuell ist.
        # Auch wenn es vom Payload kommt, setzen wir es hier neu, um die "neueste" Einreichung zu markieren.
        filled_form_data_dict["submitted_at"] = datetime.now(timezone.utc)

        self._filled_forms[new_submission_id] = filled_form_data_dict
        self._save_to_file()
        print(f"Neue/Aktualisierte Einreichung '{new_submission_id}' für Template '{form_template_id}' von Benutzer '{submitted_by_user_id}' gespeichert.")
        return filled_form_data_dict

    def load_filled_form_by_id(self, submission_id: str) -> Optional[Dict[str, Any]]:
        """Lädt eine spezifische Einreichung anhand ihrer ID."""
        return self._filled_forms.get(submission_id)

    def load_all_filled_forms(self) -> List[Dict[str, Any]]:
        """Lädt alle gespeicherten ausgefüllten Formulare."""
        return list(self._filled_forms.values())

    def load_filled_forms_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Lädt alle (aktuellsten) Formulare, die von einem spezifischen Benutzer eingereicht wurden.
        Da wir jetzt überschreiben, sollte dies immer nur die eine, aktuellste Einreichung pro Template sein.
        """
        return [
            ff_dict for ff_dict in self._filled_forms.values() 
            if ff_dict.get("submitted_by_user_id") == user_id
        ]

    def load_filled_forms_for_form_template(self, form_template_id: str) -> List[Dict[str, Any]]:
        """
        Lädt alle (aktuellsten) Einreichungen für ein spezifisches Formular-Template.
        Jeder Benutzer wird nur mit seiner neuesten Einreichung für dieses Template vertreten sein.
        """
        return [
            ff_dict for ff_dict in self._filled_forms.values() 
            if ff_dict.get("form_template_id") == form_template_id
        ]

    def delete_filled_form(self, submission_id: str) -> bool:
        """Löscht eine Einreichung anhand ihrer ID."""
        if submission_id in self._filled_forms:
            del self._filled_forms[submission_id]
            self._save_to_file()
            print(f"Einreichung '{submission_id}' gelöscht.")
            return {"message": f"Einreichung '{submission_id}' gelöscht.", "found": True}
        print(f"Einreichung '{submission_id}' nicht zum Löschen gefunden.")
        return {"message": f"Einreichung '{submission_id}' nicht zum Löschen gefunden.", "found": False}
