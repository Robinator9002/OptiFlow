import os
import sys
import shutil
import logging
import time
import inspect
from concurrent.futures import ProcessPoolExecutor
from typing import Optional, List
from tqdm import tqdm
import ocrmypdf  # Importiere hier, damit es global bekannt ist

# --- Debug Info (Beibehalten für Diagnosezwecke) ---
# Gibt Informationen über die verwendete ocrmypdf-Version und Python-Umgebung aus.
# Wichtig für die Fehlersuche, insbesondere bei Multiprocessing.
print("--- ocrmypdf Debug Info ---", flush=True)
try:
    print(f"Version: {ocrmypdf.__version__}", flush=True)
    print(f"Speicherort: {inspect.getfile(ocrmypdf)}", flush=True)
    print(f"Python Executable: {sys.executable}", flush=True)
except Exception as e:
    print(f"Fehler beim Abrufen von ocrmypdf-Informationen: {e}", flush=True)
print("--- Ende Debug Info ---", flush=True)
# --- Ende Debug Info ---


class PDFOCRProcessor:
    """
    Verarbeitet rekursiv PDF-Dateien in einem Verzeichnis mit OCRmyPDF,
    um eine durchsuchbare Textebene hinzuzufügen. Verwaltet externe Tools
    (Tesseract, Ghostscript, pngquant) und nutzt Multiprocessing.
    """

    def __init__(self, tools_dir='data.tools/', exclude_dirs: Optional[str] = None):
        """
        Initialisiert den PDFOCRProcessor und richtet Pfade sowie Logging ein.

        Args:
            tools_dir (str): Relativer Pfad zum Ordner, der die Unterordner für
                            Tesseract, Ghostscript und pngquant enthält.
                            Standard: '.tools/' relativ zum Skript/Executable.
            exclude_dirs (Optional[List[str]]): Liste von Verzeichnissen, die von der Verarbeitung ausgeschlossen werden sollen.
                                                Standard: None.
        """
        self.base_path = self._get_base_path()
        self.tools_dir = os.path.abspath(os.path.join(self.base_path, tools_dir))
        self.exclude_dirs = [exclude_dir.strip().lower() for exclude_dir in exclude_dirs.split(',')] if exclude_dirs else []

        # Pfade zu den erwarteten Tool-Verzeichnissen/Dateien
        self.tesseract_dir = os.path.join(self.tools_dir, "tesseract")
        self.ghostscript_dir = os.path.join(self.tools_dir, "ghostscript", "bin")
        # Korrigierter, plausiblerer Pfad für pngquant. Passe dies ggf. an deine Struktur an.
        self.pngquant_path = os.path.join(self.tools_dir, "pngquant", "tools", "pngquant", "pngquant.exe")

        self.error_logger = None  # Wird in _setup_logging initialisiert

        self.force_ocr = True
        self.skip_text = False
        self.redo_ocr = False

        self._setup_logging()
        self._add_tools_to_path()
        self._verify_tools_in_path()

    def _get_base_path(self):
        """Ermittelt den Basis-Pfad (Verzeichnis des Skripts oder der Exe)."""
        if getattr(sys, 'frozen', False):
            # Wenn als gepackte Exe ausgeführt (z.B. PyInstaller)
            return os.path.dirname(sys.executable)
        else:
            # Wenn als normales Skript ausgeführt
            # __file__ ist der Pfad zur aktuellen Datei
            return os.path.dirname(os.path.abspath(__file__))

    def _setup_logging(self):
        """Konfiguriert das Logging für Konsole und Dateien."""
        log_dir = os.path.join(self.base_path, '../.logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "ocr_process.log")
        error_log_file = os.path.join(log_dir, "error.log")

        # Vorhandene Handler entfernen, um Duplikate zu vermeiden
        # (Nützlich, falls die Klasse mehrfach instanziiert würde)
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        self.error_logger = logging.getLogger("error_logger")
        for handler in self.error_logger.handlers[:]:
            self.error_logger.removeHandler(handler)

        # Standard-Logging konfigurieren (INFO Level für Konsole & Haupt-Logdatei)
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",  # Datumsformat hinzugefügt
            handlers=[
                logging.FileHandler(log_file, encoding="utf-8", mode='a'),  # Anhängen
                logging.StreamHandler(sys.stdout)  # Explizit stdout
            ]
        )

        # Separaten Logger nur für FEHLER konfigurieren
        if not self.error_logger.handlers:
            error_handler = logging.FileHandler(error_log_file, encoding="utf-8", mode='a')
            # Einfacheres Format für die reine Fehlerdatei
            error_formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt="%Y-%m-%d %H:%M:%S")
            error_handler.setFormatter(error_formatter)
            self.error_logger.addHandler(error_handler)
            self.error_logger.setLevel(logging.ERROR)  # Nur ERROR Level loggen
            self.error_logger.propagate = False  # Verhindert, dass Fehler auch im Hauptlog landen

        logging.info("Logging wurde initialisiert.")

    def _add_tools_to_path(self):
        """Fügt die Verzeichnisse der externen Tools zum System-PATH hinzu."""
        logging.info(f"Füge Tool-Pfade hinzu: Tesseract='{self.tesseract_dir}', Ghostscript='{self.ghostscript_dir}'")

        # Prüfe Existenz der notwendigen Verzeichnisse
        if not os.path.isdir(self.tesseract_dir):
            raise FileNotFoundError(f"Tesseract-Verzeichnis nicht gefunden: {self.tesseract_dir}")
        if not os.path.isdir(self.ghostscript_dir):
            raise FileNotFoundError(f"Ghostscript 'bin'-Verzeichnis nicht gefunden: {self.ghostscript_dir}")

        # Füge Verzeichnisse *vorne* zum PATH hinzu, damit sie zuerst gefunden werden
        os.environ["PATH"] = self.tesseract_dir + os.pathsep + os.environ["PATH"]
        os.environ["PATH"] = self.ghostscript_dir + os.pathsep + os.environ["PATH"]

        # Prüfe Existenz von pngquant (optional) und füge dessen Verzeichnis hinzu
        pngquant_dir = os.path.dirname(self.pngquant_path)
        if os.path.isfile(self.pngquant_path):
            if os.path.isdir(pngquant_dir):
                logging.info(f"Füge hinzu: pngquant='{pngquant_dir}'")
                os.environ["PATH"] = pngquant_dir + os.pathsep + os.environ["PATH"]
            else:
                logging.warning(
                    f"Verzeichnis für pngquant '{pngquant_dir}' ist ungültig, wird nicht zum PATH hinzugefügt.")
        else:
            # Versuche ohne .exe für Nicht-Windows-Systeme
            non_exe_path = os.path.splitext(self.pngquant_path)[0]
            if os.path.isfile(non_exe_path):
                self.pngquant_path = non_exe_path  # Pfad aktualisieren
                pngquant_dir = os.path.dirname(self.pngquant_path)
                if os.path.isdir(pngquant_dir):
                    logging.info(f"Füge hinzu: pngquant='{pngquant_dir}' (ohne .exe)")
                    os.environ["PATH"] = pngquant_dir + os.pathsep + os.environ["PATH"]
                else:
                    logging.warning(
                        f"Verzeichnis für pngquant '{pngquant_dir}' ist ungültig, wird nicht zum PATH hinzugefügt.")
            else:
                logging.warning(
                    f"pngquant nicht gefunden unter '{self.pngquant_path}' oder '{non_exe_path}'. Optimierung mit pngquant evtl. nicht möglich.")

        # logging.debug(f"Aktualisierter PATH: {os.environ['PATH']}") # Nur bei Bedarf ausgeben (sehr lang)

    def _verify_tools_in_path(self):
        """Überprüft mittels shutil.which, ob die Tools im PATH gefunden werden."""
        tesseract_exe = "tesseract.exe" if os.name == 'nt' else "tesseract"
        # Ghostscript: gswin64c für 64bit Windows Console, gswin64 für GUI, gs für Linux/Mac
        ghostscript_exe = "gswin64c.exe" if os.name == 'nt' else "gs"
        pngquant_exe = os.path.basename(self.pngquant_path)  # Name der Exe aus dem Pfad holen

        tesseract_found = shutil.which(tesseract_exe)
        ghostscript_found = shutil.which(ghostscript_exe)
        pngquant_found = shutil.which(pngquant_exe)

        logging.info(f"Tool-Verifizierung im PATH:")
        logging.info(
            f"  Tesseract ({tesseract_exe}): {'Gefunden -> ' + tesseract_found if tesseract_found else 'NICHT GEFUNDEN!'}")
        logging.info(
            f"  Ghostscript ({ghostscript_exe}): {'Gefunden -> ' + ghostscript_found if ghostscript_found else 'NICHT GEFUNDEN!'}")
        logging.info(
            f"  pngquant ({pngquant_exe}): {'Gefunden -> ' + pngquant_found if pngquant_found else 'Nicht gefunden (optional)'}")

        if not tesseract_found:
            logging.error(
                f"Tesseract ('{tesseract_exe}') konnte im PATH nicht gefunden werden. OCR wird fehlschlagen.")
            # Hier könnte man auch sys.exit() aufrufen, wenn Tesseract zwingend ist.
        if not ghostscript_found:
            logging.error(
                f"Ghostscript ('{ghostscript_exe}') konnte im PATH nicht gefunden werden. OCR wird wahrscheinlich fehlschlagen.")
        if not pngquant_found:
            logging.warning(
                f"pngquant ('{pngquant_exe}') nicht im PATH gefunden. Optimierungsstufen > 0 sind evtl. beeinträchtigt.")

    def _process_pdf(self, input_file, output_file=None):
        """
        Führt OCR für eine einzelne PDF-Datei mittels ocrmypdf.ocr aus.

        Args:
            input_file (str): Pfad zur Eingabe-PDF.
            output_file (str, optional): Pfad zur Ausgabe-PDF. Wenn None,
                                            wird keine Datei gespeichert. Standard: None.

        Returns:
            tuple: (input_file, status_message)
                   status_message ist "Success", "Skipped (...)" oder "Error (...)".
        """
        # Stelle sicher, dass die benötigten Module im Worker-Prozess verfügbar sind
        # (Workaround für potenzielle Multiprocessing-Importprobleme)
        import ocrmypdf
        from ocrmypdf import exceptions as ocr_exceptions  # Nutze Alias

        if not output_file:
            logging.warning(f"Überspringe {os.path.basename(input_file)}: Keine Ausgabedatei angegeben.")
            return input_file, "Skipped (no output file specified)"

        input_basename = os.path.basename(input_file)
        output_basename = os.path.basename(output_file)
        logging.info(f"Starte Verarbeitung: {input_basename} -> {output_basename}")

        try:
            # OCR Parameter (angepasst nach User-Feedback)
            # optimize=0: Keine Optimierung (schnellst)
            # image_dpi=150: Geringere Auflösung für schnellere Verarbeitung
            ocrmypdf.ocr(
                input_file,
                output_file,
                language='deu',  # Sprache explizit setzen
                deskew=True,  # Automatische Geraderichtung
                rotate_pages=True,  # Automatische Seitenausrichtung
                optimize=0,  # Keine Optimierung (schneller)
                image_dpi=150,  # Geringere DPI (schneller, evtl. ungenauer)
                force_ocr=self.force_ocr,  # OCR auch erzwingen, wenn Text vermutet wird
                skip_text=self.skip_text,  # Seiten mit Text nicht überspringen
                redo_ocr=self.redo_ocr,  # Keine erneute OCR, wenn schon vorhanden
                progress_bar=False  # Interne Progressbar deaktivieren (wir nutzen tqdm)
            )
            # Erfolgsfall wird implizit durch tqdm geloggt, hier nur Rückgabe
            return input_file, "Success"

        # --- Spezifische Fehlerbehandlung ---
        except ocr_exceptions.PriorOcrFoundError:
            logging.warning(f"Übersprungen (vorhandene OCR): {input_basename}")
            return input_file, "Skipped (Prior OCR Found)"

        except ocr_exceptions.EncryptedPdfError:
            logging.error(f"Fehler (verschlüsselt): {input_basename}")
            self.error_logger.error(f"{input_file} - Encrypted PDF")
            return input_file, "Error (Encrypted PDF)"

        # --- Allgemeine Fehlerbehandlung ---
        except Exception as e:
            # Fängt alle anderen Fehler ab. logging.exception inkludiert den Traceback.
            logging.exception(f"Unerwarteter Fehler bei Verarbeitung von {input_basename}: {e}")
            # Logge Typ und Nachricht in die separate Fehlerdatei
            self.error_logger.error(f"{input_file} - Unexpected Error: {e} (Type: {type(e).__name__})")
            return input_file, f"Error ({type(e).__name__})"

    def process_directory(self, base_dir, output_subdir=None, output_prefix=None, overwrite=False,
                        ignored_dir_names=None, max_workers=None):
        """
        Verarbeitet rekursiv alle PDFs in `base_dir` mit verschiedenen Ausgabeoptionen.

        Args:
            base_dir (str): Das Startverzeichnis für die PDF-Suche.
            output_subdir (str, optional): Name des Unterordners für die Ausgabe-PDFs.
            output_prefix (str, optional): Präfix für die Ausgabe-Dateinamen im selben Verzeichnis.
            overwrite (bool, optional): Originaldateien überschreiben, wenn True.
            ignored_dir_names (list oder set, optional): Liste/Set von VerzeichnisNAMEN, die ignoriert werden sollen.
            max_workers (int, optional): Maximale Anzahl paralleler Prozesse.
        """
        if sum(map(bool, [output_subdir, output_prefix, overwrite])) > 1:
            raise ValueError("Nur eine Ausgabeoption (output_subdir, output_prefix, overwrite) darf gesetzt sein.")

        if ignored_dir_names is None:
            ignored_dir_names = {os.path.basename(self.tools_dir), ".logs"}
        else:
            ignored_dir_names = set(ignored_dir_names)
            ignored_dir_names.update({os.path.basename(self.tools_dir), ".logs"})

        if self.exclude_dirs:
            ignored_dir_names.update({os.path.basename(excluded_dir) for excluded_dir in self.exclude_dirs})

        logging.info(f"Starte OCR-Prozess im Basisverzeichnis: {base_dir}")
        logging.info(f"Ausgabe-Unterverzeichnis: {output_subdir}")
        logging.info(f"Ausgabe-Präfix: {output_prefix}")
        logging.info(f"Überschreiben: {overwrite}")
        logging.info(f"Ignoriere Verzeichnisse mit Namen: {sorted(list(ignored_dir_names))}")

        if max_workers is None or max_workers <= 0:
            try:
                # os.cpu_count() kann None zurückgeben
                cpu_cores = os.cpu_count()
                if cpu_cores:
                    max_workers = max(1, cpu_cores - 1)  # Mind. 1, sonst CPU-Anzahl - 1
                else:
                    max_workers = 1  # Fallback, falls CPU-Anzahl nicht ermittelbar
            except NotImplementedError:
                max_workers = 1  # Fallback für Systeme ohne os.cpu_count()
            logging.info(f"Verwende automatisch max. {max_workers} Worker-Prozess(e).")
        else:
            logging.info(f"Verwende manuell max. {max_workers} Worker-Prozess(e).")

        # Finde alle zu verarbeitenden PDF-Dateien
        pdf_tasks = self._get_pdf_tasks(base_dir, output_subdir, output_prefix, overwrite, ignored_dir_names)

        if not pdf_tasks:
            logging.warning("Keine PDF-Dateien zur Verarbeitung gefunden (unter Berücksichtigung ignorierter Ordner).")
            return

        logging.info(f"{len(pdf_tasks)} PDF-Dateien zur Verarbeitung gefunden.")

        # Verarbeitung mit ProcessPoolExecutor und tqdm Fortschrittsanzeige
        processed_count = 0
        success_count = 0
        skipped_count = 0
        error_count = 0

        # Verwende try-finally, um sicherzustellen, dass die Zusammenfassung geloggt wird
        try:
            with ProcessPoolExecutor(max_workers=max_workers) as executor:
                results = list(tqdm(executor.map(self._process_pdf_wrapper, pdf_tasks),
                                    total=len(pdf_tasks),
                                    desc="Verarbeite PDFs",
                                    unit="Datei"))

            # Ergebnisse auswerten
            for _, status in results:
                processed_count += 1
                if status == "Success":
                    success_count += 1
                elif "Skipped" in status:
                    skipped_count += 1
                else:  # Annahme: Jeder andere Status ist ein Fehler
                    error_count += 1
        finally:
            # Logge die Zusammenfassung, auch wenn ein Fehler im Executor auftrat
            logging.info("--- OCR Prozess Zusammenfassung ---")
            logging.info(f"Gesamtzahl verarbeiteter Dateien: {processed_count}")
            logging.info(f"✅ Erfolgreich: {success_count}")
            logging.info(f"⚠️ Übersprungen: {skipped_count}")
            logging.info(f"❌ Fehler: {error_count}")
            if error_count > 0:
                error_log_path = os.path.join(self.base_path, '.logs', "error.log")
                logging.info(f"Details zu Fehlern siehe: '{error_log_path}'")
            logging.info("--- Ende Zusammenfassung ---")

    def _get_pdf_tasks(self, base_dir, output_subdir, output_prefix, overwrite, ignored_dir_names):
        """
        Findet rekursiv PDFs und erstellt eine Liste von (input_path, output_path) Tasks.
        """
        pdf_tasks = []
        processed_physical_dirs = set()

        logging.info(f"Suche nach PDF-Dateien in '{base_dir}', ignoriere Ordner: {ignored_dir_names}")

        for root, dirs, files in os.walk(base_dir, topdown=True, followlinks=False):
            # Verhindere Endlosschleifen durch Symlinks, die auf bereits besuchte Orte zeigen
            try:
                current_real_path = os.path.realpath(root)
                if current_real_path in processed_physical_dirs:
                    logging.warning(f"Symlink-Schleife oder wiederholter Pfad entdeckt, überspringe: {root}")
                    dirs[:] = []  # Nicht weiter in diesem Pfad absteigen
                    continue
                processed_physical_dirs.add(current_real_path)
            except OSError as e:
                logging.warning(f"Konnte realpath für {root} nicht auflösen, überspringe evtl.: {e}")
                # Vorsichtshalber hier nicht weiter absteigen
                dirs[:] = []
                continue

            # --- Verzeichnisse zum Ignorieren ausfiltern ---
            # Modifiziere 'dirs' direkt, damit os.walk nicht hineingeht.
            original_dirs = list(dirs)
            dirs[:] = [d for d in dirs if d not in ignored_dir_names]

            # Logge, welche Verzeichnisse übersprungen wurden
            skipped_local_dirs = [d for d in original_dirs if d in ignored_dir_names]
            if skipped_local_dirs:
                for skipped in skipped_local_dirs:
                    logging.info(f"  -> Ignoriere Abstieg in '{skipped}' innerhalb von '{root}'")
            # --- Ende Ignorier-Logik ---

            # Finde PDFs im aktuellen Verzeichnis (ignoriere bereits verarbeitete)
            pdf_files_in_dir = [f for f in files if f.lower().endswith(".pdf")]

            if pdf_files_in_dir:
                for filename in pdf_files_in_dir:
                    input_path = os.path.join(root, filename)

                    if overwrite:
                        output_path = input_path  # Überschreiben
                    elif output_prefix:
                        output_filename = f"{output_prefix}{filename}"
                        output_path = os.path.join(root, output_filename)
                    elif output_subdir:
                        output_dir_path = os.path.join(root, output_subdir)
                        try:
                            if not os.path.isdir(output_dir_path):
                                os.makedirs(output_dir_path)
                                logging.info(f"Ausgabe-Verzeichnis erstellt: {output_dir_path}")
                        except OSError as e:
                            logging.error(
                                f"Konnte Ausgabe-Verzeichnis '{output_dir_path}' nicht erstellen: {e}. Überspringe PDFs in '{root}'.")
                            continue
                        output_filename = f"OCR_{filename}"
                        output_path = os.path.join(output_dir_path, output_filename)
                    else:
                        logging.warning(f"Überspringe {filename}: Keine Ausgabeoptionen angegeben.")
                        continue

                    pdf_tasks.append((input_path, output_path))

        return pdf_tasks

    def _process_pdf_wrapper(self, args):
        """
        Hilfsfunktion für ProcessPoolExecutor.map, entpackt Argumente
        und ruft _process_pdf auf. Fängt unerwartete Fehler im Wrapper.
        """
        input_file, output_file = args
        try:
            # Hier könnten bei Bedarf Worker-spezifische Initialisierungen erfolgen
            # (z.B. separates Logging, obwohl das komplex sein kann)
            return self._process_pdf(input_file, output_file)
        except Exception as e:
            # Fängt Fehler, die *außerhalb* des try/except in _process_pdf auftreten
            input_basename = os.path.basename(input_file)  # Sicherer Zugriff auf Dateiname
            logging.error(f"Kritischer Fehler im Wrapper für {input_basename}: {e}")
            # Versuche, in die separate Fehlerdatei zu loggen
            try:
                error_log_path = os.path.join(self._get_base_path(), '.logs', "error.log")
                with open(error_log_path, 'a', encoding='utf-8') as f:
                    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
                    f.write(
                        f"{timestamp} - {input_file} - Wrapper Error: {e} (Type: {type(e).__name__})\n")
            except Exception as log_e:
                print(f"FEHLER: Konnte nicht in error.log schreiben: {log_e}",
                    file=sys.stderr)  # Ausgabe nach stderr
            return input_file, f"Error (Wrapper Exception: {type(e).__name__})"

    # --- Methoden für Einzeldateiverarbeitung (weniger relevant für Batch) ---

    def process_and_save_pdf(self, input_file, output_file):
        """
        Verarbeitet eine einzelne PDF mit OCR und speichert das Ergebnis.
        """
        if not output_file:
            logging.error("Ausgabepfad muss für process_and_save_pdf angegeben werden.")
            return
        logging.info(f"Verarbeite Einzeldatei: {input_file} -> {output_file}")
        # Ruft die Kernfunktion für eine Datei auf
        self._process_pdf(input_file, output_file)
