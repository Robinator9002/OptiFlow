from typing import Optional, Dict, List, Any # Import Any
from backend.core.file_scanner import FileScanner
from backend.core.datei_manager import DateiManager
from backend.core.pdf_to_ocr import PDFOCRProcessor
from backend.core.account_manager import AccountManager
from backend.core.event_manager import EventManager, Event
import datetime

class DateiController:
    def __init__(self, base_dirs: str, extensions: Optional[List] = None, index_file: str = "file_index.json",
                index_content: bool = True, convert_pdf: bool = False, max_size_kb: int = 0, max_content_size_let: Optional[int] = None, data_file: Optional[str] = 'data/user.json', auto_login_time: Optional[int] = 24, events_file: str = "data/events.json", structure_file: str = "data/structure.json",
                search_limit: int = 100, snippet_limit: int = 0, snippet_window: int = 40, proximity_window: int = 20, # Added snippet/proximity window
                max_age_days: int = 1000, old_files_limit: int = 0, sort_by: str = 'age', sort_order: str = 'normal', # Added old files params
                dupe_file: str = "data/dupes.json", # Added dupe_file
                length_range_step: int = 10, min_category_length: int = 2, snippet_length: int = 5, # Added dedupe settings
                snippet_step: int = 2, signature_size: int = 100, similarity_threshold: float = 0.7 # Added more dedupe settings
                ):
        """Die Initialisierungsfunktion für den DateiController. Dieser erhällt Funktionswrapper für alle wichtigen Klassen

        Args:
            base_dirs (str) | FileScanner: In welchen Dateien wird die Indexierung stattfinden
            extensions (Optional[List], optional) | FileScanner: _description_. Defaults to None.
            index_file (str, optional) | FileScanner: Wo der Index abgespeichert wird. Defaults to "file_index.json".
            index_content (bool, optional) | FileScanner: Soll der Inhalt Indexiert werden? Defaults to True.
            convert_pdf (bool, optional) | FileScanner: Sollen PDFs Konvertiert und Ausgelesen werden? Defaults to False.
            max_size_kb (int, optional) | FileScanner: Größere Dateien werden nicht gescannt. Defaults to 0.
            max_content_size_let (Optional[int], optional) | FileScanner: Wie groß darf der Content einer Datei maximal sein (sonst wird er nicht vollständig abgespeichert). Defaults to None.
            search_limit (int): Wie viele Suchergebnisse maximal zurückgegeben werden
            snippet_limit (int): Wie viele Snippets bei der In-Datei-Suche maximal zurückgegeben werden
            snippet_window (int): Wie viele Zeichen in dem Inhalt gehighlighted werden
            proximity_window (int): Wie viele Zeichen in dem Inhalt in der Nähe beachtet werden
            max_age_days (int): Wie alt muss eine Datei mindestens sein, um in der find_old_files Funktion gefunden zu werden
            old_files_limit (int): Wie viele alte Dateien werden maximal gefunden (standardmäßig 0, bedeutet unendlich)
            sort_by (str): Wie die alten Dateien sortiert werden, entwerder nach Alter ('age') oder nach Größe ('size')
            sort_order (str): Nutzt entweder sort_by oder Invertiert es ('normal' oder 'inverted')
            dupe_file (str): Der Pfad zur Datei, in der Duplikatergebnisse gespeichert/geladen werden.
            length_range_step (int): Schrittweite für die Gruppierung nach bereinigter Inhaltslänge bei der Duplikatsuche.
            min_category_length (int): Mindestanzahl von Dateien in einer Gruppe bei der Duplikatsuche.
            snippet_length (int): Länge der Zeichen-Shingles (K) bei der Duplikatsuche.
            snippet_step (int): Abstand zwischen dem Start jedes Shingles bei der Duplikatsuche.
            signature_size (int): Anzahl der Top-Hash-Werte für die Signatur (M) bei der Duplikatsuche.
            similarity_threshold (float): Mindestübereinstimmungswert für die Ähnlichkeitsgruppierung bei der Duplikatsuche (0.0 bis 1.0).
            events_file (str, optional) | EventManager: Wo die Ereignisse lokal gespeichert werden. Defaults to "data/events.json".
            structure_file (str, optional) | DateiManager: Wo die Datei-Struktur lokal gespeichert wird. Defaults to "data/structure.json".
            data_file (str, optional) | AccountManager: Wo die Nutzer Lokal abgespeichert werdne.
            auto_login_time (int, optional) | AccountManager: Wie lange ein Nutzer angemeldet bleibt. Defaults to 24.

        """
        self.data_file, self.index_file, self.structure_file, self.events_file, self.dupe_file = data_file, index_file, structure_file, events_file, dupe_file # Store dupe_file path

        self.event_manager = EventManager(on_event_triggered=self.on_event_triggered)  # Wenn kein EventManager übergeben wird, wird ein neuer erstellt
        self.datei_manager = DateiManager(structure_file=structure_file)
        self.pdf_ocr_processor = PDFOCRProcessor(tools_dir="../tools")
        self.account_manager = AccountManager(data_file=data_file, auto_login_time=auto_login_time)
        self.data_file, self.index_file, self.structure_file, self.events_file, self.dupe_file = data_file, index_file, structure_file, events_file, dupe_file
        
                # Initialize FileScanner with all parameters, including new dedupe settings
        self.file_scanner = FileScanner(
            base_dirs=base_dirs,
            processor=self.pdf_ocr_processor,
            extensions=set(extensions) if extensions else None,
            index_file=index_file,
            dupe_file=dupe_file, # Pass dupe_file
            index_content=index_content,
            convert_pdf=convert_pdf,
            max_size_kb=max_size_kb,
            max_content_size_let=max_content_size_let,
            search_limit=search_limit,
            snippet_limit=snippet_limit,
            snippet_window=snippet_window, # Pass snippet_window
            proximity_window=proximity_window, # Pass proximity_window
            max_age_days=max_age_days, # Pass old files params
            old_files_limit=old_files_limit,
            sort_by=sort_by,
            sort_order=sort_order,
            # Pass NEW dedupe settings
            length_range_step=length_range_step,
            min_category_length=min_category_length,
            snippet_length=snippet_length,
            snippet_step=snippet_step,
            signature_size=signature_size,
            similarity_threshold=similarity_threshold,
        )
        self.file_scanner.search_limit = search_limit
        self.file_scanner.snippet_limit = snippet_limit
        
        # Load index and duplicates on initialization
        self.load_index()
        self.load_duplicates() # Load duplicates on startup

    # -- Scanner --
    def load_index(self):
        return self.file_scanner.load_index()

    def save_index(self):
        return self.file_scanner.save_index()

    def scan_files(self):
        result = self.file_scanner.scan_files()
        self.save_index()
        return result

    def actualize_index(self):
        result = self.file_scanner.actualize_index()
        self.save_index()
        return result
    
    def delete_index(self):
        return self.file_scanner.delete_index()
    
    # -- Suche --
    def search_files(self, query: str):
        return self.file_scanner.search(query)

    def search_file(self, path: str, query: str):
        return self.file_scanner.search_in_file(path, query)

    # -- Dateimanagement --
    def get_file_info(self, file_path: str):
        return self.file_scanner.index.get(file_path)

    def update_file(self, update: Dict[str, str]):
        results = self.file_scanner.update_file(update)
        return {'message': results['message']}

    def open(self, path: str):
        return self.datei_manager.open_file_or_folder(path)

    def open_explorer(self, file_path: str):
        return self.datei_manager.open_in_explorer(file_path)

    def write(self, file_path: str, content: str):
        self.file_scanner.index[file_path]["content"] = content
        return self.datei_manager.write_content(file_path, content)

    def delete_file(self, file_path: str):
        success = self.datei_manager.delete_file(file_path)
        if success:
            self.file_scanner.remove_from_index(file_path)
            self.save_index()
            return {"message": f"Datei '{file_path}' gelöscht."}
        else:
            return {"message": f"Fehler beim Löschen der Datei."}
    
    # -- DEDUPING FUNKTIONEN (NEU) --
    def find_duplicates(self) -> Dict[str, Any]:
        """Wrapper for FileScanner's find_duplicates."""
        result = self.file_scanner.find_duplicates()
        self.save_duplicates() # Save results after finding
        return result

    def load_duplicates(self) -> Dict[str, Any]:
        """Wrapper for FileScanner's load_duplicates."""
        return self.file_scanner.load_duplicates()

    def save_duplicates(self) -> Dict[str, str]:
        """Wrapper for FileScanner's save_duplicates."""
        return self.file_scanner.save_duplicates()

    def search_duplicates(self, query: Optional[str] = None, sort_by: str = 'similarity', sort_order: str = 'desc', length_range_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Wrapper for FileScanner's search_duplicates."""
        return self.file_scanner.search_duplicates(query, sort_by, sort_order, length_range_filter)

    # -- Vergessene Dateien (Alte Dateien Suche) --
    # === NEUE FUNKTION: Wrapper für find_old_files_in_index ===
    def find_old_files(self, max_files: Optional[int] = None, max_age_days: Optional[int] = None, sort_by: Optional[str] = None, sort_order: Optional[str] = None):
        """
        Wrapper-Funktion, die die Suche nach alten Dateien im FileScanner aufruft.

        Args:
            max_files: Die maximale Anzahl der zurückzugebenden Dateien.
            max_age_days: Das maximale Alter in Tagen.
            sort_by: Kriterium für die Sortierung ('size' oder 'age').
            sort_order: Sortierreihenfolge ('normal' oder 'inverted').

        Returns:
            Eine Liste von Dictionaries, die die gefundenen alten Dateien repräsentieren.
        """
        # Rufe die Funktion im FileScanner auf und gib das Ergebnis zurück
        # Die Parameter kommen vom FastAPI-Endpoint und werden direkt weitergegeben
        return self.file_scanner.find_old_files_in_index(
            max_files=max_files,
            max_age_days=max_age_days,
            sort_by=sort_by,
            sort_order=sort_order
        )

    # Event Triggered
    def on_event_triggered(self, event: Event) -> None:
        if event == 'scanner':
            self.actualize_index()
        if event == 'file-structure':
            self.rescan_file_structure()

    # Event hinzufügen
    def add_event(self, frequency: str, times: List[str], event: str) -> bool:
        """Fügt ein neues Event hinzu."""
        last_execution = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        new_event = Event(frequency, times, event, last_execution)
        self.event_manager.add_event(new_event)
        return True

    # Event aktualisieren
    def update_event(self, event_index: int, frequency: str, times: List[str], event: str) -> bool:
        """Aktualisiert ein bestehendes Event."""
        last_execution = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        updated_event = Event(frequency, times, event, last_execution)
        return self.event_manager.update_event(event_index, updated_event)

    # Event löschen
    def delete_event(self, event_index: int) -> bool:
        """Löscht ein Event."""
        return self.event_manager.delete_event(event_index)

    # Alle Events abrufen
    def get_all_events(self) -> List[Event]:
        """Gibt alle Events zurück."""
        return self.event_manager.events_db

    # Event ausführen
    def execute_event(self, event_index: int) -> bool:
        """Führt ein Event manuell aus."""
        if 0 <= event_index < len(self.event_manager.events_db):
            event = self.event_manager.events_db[event_index]
            self.event_manager.execute_event(event)
            return True
        return False

    # Event nach Index finden
    def find_event_by_index(self, event_index: int) -> Event:
        """Findet ein Event nach seinem Index."""
        if 0 <= event_index < len(self.event_manager.events_db):
            return self.event_manager.events_db[event_index]
        return None

    # Event starten (Überwachungsprozess aktivieren)
    def start_event_monitoring(self) -> None:
        """Startet die Event-Überwachung."""
        self.event_manager.start()

    # Events in der Datei speichern
    def save_events_to_file(self) -> None:
        """Speichert die Events in der Datei."""
        self.event_manager.save_events()

    # Events aus der Datei laden
    def load_events_from_file(self) -> None:
        """Lädt Events aus der Datei."""
        self.event_manager.events_db = self.event_manager.load_events()

    def process_pdf_directory(self, base_dir: str, output_subdir: Optional[str] = None, output_prefix: Optional[str] = None, overwrite: bool = False,  ignored_dir_names: Optional[List[str]] = None, max_workers: Optional[int] = None):
        """
        Verarbeitet PDFs in einem Verzeichnis mit OCR.
        """
        self.pdf_ocr_processor.process_directory(
            base_dir,
            output_subdir=output_subdir,
            output_prefix=output_prefix,
            overwrite=overwrite,
            ignored_dir_names=ignored_dir_names,
            max_workers=max_workers
        )
        return {"message": f"OCR-Verarbeitung im Verzeichnis '{base_dir}' abgeschlossen."}

    def process_pdf_file(self, input_file: str, output_file: str):
        """
        Verarbeitet eine einzelne PDF-Datei mit OCR.
        """
        self.pdf_ocr_processor.process_and_save_pdf(input_file, output_file)
        return {"message": f"OCR-Verarbeitung für '{input_file}' abgeschlossen. Ausgabe: '{output_file}'"}

    def process_index(self, overwrite: bool = False):
        """
        Verarbeitet den Index, sodass alle PDFs ausgelesen sind.
        Wenn overwrite = True ist, dann wird die PDF gespeichert, sonst nur ausgelesen!
        """
        return self.file_scanner.process_index(overwrite)

    def get_file_structure(self, path: str = None, force_rescan: bool = False):
        """
        Gibt eine JSON-Struktur der Datei-Struktur zurück.
        """
        return self.datei_manager.get_file_structure(path, force_rescan=force_rescan)

    def rescan_file_structure(self, path: str = None):
        """
        Erzwingt einen Neuscan der Datei-Struktur und aktualisiert den Cache.
        """
        return self.datei_manager.rescan_file_structure(path)
    
    def read_json_file(self, file_path: str):
        """Liest eine JSON-Datei und gibt ihren Inhalt zurück."""
        return self.datei_manager.read_json_file(file_path)

    def save_json_file(self, file_path: str, data: Dict):
        """Speichert Daten als JSON in die angegebene Datei."""
        return self.datei_manager.save_json_file(file_path, data)
    
    def get_database_path_by_name(self, database_name: str):
        return {'users.json': self.data_file, 'structure.json': self.structure_file, 'index.json': self.index_file, 'events.json': self.events_file}.get(database_name, None)

    def create_user(self, username, password, admin_username, admin_password, is_admin):
        return self.account_manager.create_user(username, password, admin_username, admin_password, is_admin)

    def verify_login(self, username, password):
        if self.account_manager.verify_password(username, password):
            self.account_manager.set_last_login(username)
            return True
        return False

    def logout_user(self, username):
        self.account_manager.clear_last_login(username)

    def check_auto_login(self, username):
        return self.account_manager.is_auto_login_valid(username)

    def get_user_admin_status(self, username):
        return self.account_manager.get_user_admin_status(username)
    
    def get_user_password_reset_status(self, username):
        return self.account_manager.get_user_password_reset_status(username)
    
    def load_settings(self, username):
        return self.account_manager.load_settings(username)
    
    def save_settings(self, username: str, settings):
        return self.account_manager.save_settings(username, settings)
    
    def apply_settings(self, settings):
        """
        Applies settings from a Settings object to the FileScanner and other components.

        Args:
            settings (Settings): The settings object containing configuration values.
        """

        # Apply FileScanner settings
        if settings.search_limit is not None:
            self.file_scanner.search_limit = settings.search_limit
        if settings.snippet_limit is not None:
            self.file_scanner.snippet_limit = settings.snippet_limit
        if settings.old_files_limit is not None:
            self.file_scanner.old_files_limit = settings.old_files_limit
        if settings.match_score is not None:
            if settings.match_score.filename_exact is not None:
                self.file_scanner.filename_exact_match_score = settings.match_score.filename_exact
            if settings.match_score.filename_partial is not None:
                self.file_scanner.filename_partial_match_score = settings.match_score.filename_partial
            if settings.match_score.content is not None:
                self.file_scanner.content_match_score = settings.match_score.content
        if settings.scanner_cpu_cores is not None:
            self.file_scanner.num_processes = settings.scanner_cpu_cores if settings.scanner_cpu_cores > 0 else None # Assuming num_processes controls workers
        if settings.usable_extensions is not None:
            # Ensure extensions are stored as a set in FileScanner
            self.file_scanner.extensions = set(settings.usable_extensions) if settings.usable_extensions else None
            self.file_scanner.usable_extensions = set(settings.usable_extensions) if settings.usable_extensions else None # Assuming usable_extensions is also used
        if settings.scan_delay is not None:
            self.file_scanner.scan_delay = settings.scan_delay
        if settings.snippet_window is not None:
            self.file_scanner.snippet_window = settings.snippet_window
        if settings.proximity_window is not None:
            self.file_scanner.proximity_window = settings.proximity_window
        if settings.max_age_days is not None:
            self.file_scanner.max_age_days = settings.max_age_days
        if settings.sort_by is not None:
            self.file_scanner.sort_by = settings.sort_by
        if settings.sort_order is not None:
            self.file_scanner.sort_order = settings.sort_order
        # max_file_size from settings model seems to map to max_size_kb in FileScanner
        if settings.max_file_size is not None:
            # Assuming max_file_size in settings is in KB, matching max_size_kb
            self.file_scanner.max_size_kb = settings.max_file_size


        # Apply PDF/OCR Processor settings
        if settings.processor_excluded_folders is not None:
            # Split the string by comma, strip whitespace, filter empty strings, convert to lowercase
            excluded_dirs = [exclude_dir.strip().lower() for exclude_dir in settings.processor_excluded_folders.split(',') if exclude_dir]
            self.pdf_ocr_processor.exclude_dirs = excluded_dirs
        if settings.force_ocr is not None:
            self.pdf_ocr_processor.force_ocr = settings.force_ocr
        if settings.skip_text is not None:
            self.pdf_ocr_processor.skip_text = settings.skip_text
        if settings.redo_ocr is not None:
            self.pdf_ocr_processor.redo_ocr = settings.redo_ocr
        # Note: processing_cpu_cores might need similar handling as scanner_cpu_cores

        # Apply EventManager settings
        if settings.check_interval is not None:
            self.event_manager.check_interval = settings.check_interval

        # --- Apply NEW Deduplication Settings ---
        # Assuming the names in the Settings model match the FileScanner attributes
        if hasattr(settings, 'length_range_step') and settings.length_range_step is not None:
            self.file_scanner.length_range_step = settings.length_range_step
        if hasattr(settings, 'min_category_length') and settings.min_category_length is not None:
            self.file_scanner.min_category_length = settings.min_category_length
        if hasattr(settings, 'snippet_length') and settings.snippet_length is not None:
            self.file_scanner.snippet_length = settings.snippet_length
        if hasattr(settings, 'snippet_step') and settings.snippet_step is not None:
            self.file_scanner.snippet_step = settings.snippet_step
        if hasattr(settings, 'signature_size') and settings.signature_size is not None:
            self.file_scanner.signature_size = settings.signature_size
        # Check for the specific dedupe similarity threshold name
        if hasattr(settings, 'similarity_threshold') and settings.similarity_threshold is not None:
            self.file_scanner.similarity_threshold = settings.similarity_threshold
            
    def change_username(self, user, new_username):
        self.account_manager.change_username(user.username, user.password, new_username)
    
    def change_password(self, user, new_password):
        self.account_manager.change_password(user.username, user.password, new_password)
                
    def change_admin_status(self, user, admin_user):
        self.account_manager.change_admin_status(user['username'], admin_user['username'], admin_user['password'], check_hash=False)

    def remove_user(self, target_username: str, admin_username: str, admin_password: str) -> tuple[bool, str]:
        """Leitet eine Löschanfrage sicher an den AccountManager weiter."""
        return self.account_manager.delete_user(target_username, admin_username, admin_password)

    def reset_password(self, target_username: str, admin_username: str, admin_password: str) -> bool:
        """Leitet eine Passwort-Reset-Anfrage sicher an den AccountManager weiter."""
        return self.account_manager.request_password_reset(target_username, admin_username, admin_password)
                
    def backup_database(self, database_name: str):
        return self.read_json_file(self.get_database_path_by_name(database_name))
    
    def reload_database(self, database_name: str):
        if database_name == 'index.json':
            self.file_scanner.load_index()
        elif database_name == 'structure.json':
            self.datei_manager.get_file_structure()

    def overwrite_database(self, database_name: str, content: str):
        self.save_json_file(self.get_database_path_by_name(database_name), content)
        