import os
import sys
import shutil
import logging
import time
import inspect
from concurrent.futures import ProcessPoolExecutor
from typing import Optional, Dict, Any
from tqdm import tqdm
import ocrmypdf

# --- Debug Info (Beibehalten für Diagnosezwecke) ---
print("--- ocrmypdf Debug Info ---", flush=True)
try:
    print(f"Version: {ocrmypdf.__version__}", flush=True)
    print(f"Speicherort: {inspect.getfile(ocrmypdf)}", flush=True)
    print(f"Python Executable: {sys.executable}", flush=True)
except Exception as e:
    print(f"Fehler beim Abrufen von ocrmypdf-Informationen: {e}", flush=True)
print("--- Ende Debug Info ---", flush=True)

class PDFOCRProcessor:
    """
    Verarbeitet rekursiv PDF-Dateien in einem Verzeichnis mit OCRmyPDF.
    """

    def __init__(self, tools_dir: str, exclude_dirs: Optional[str] = None, ocr_settings: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den PDFOCRProcessor.

        Args:
            tools_dir (str): Der absolute Pfad zum Ordner, der die Unterordner für
                             Tesseract, Ghostscript und pngquant enthält.
            exclude_dirs (Optional[List[str]]): Liste von Verzeichnissen, die ausgeschlossen werden sollen.
            ocr_settings (Optional[Dict[str, Any]]): Dictionary mit OCR-spezifischen Einstellungen.
        """
        self.tools_dir = tools_dir
        if not os.path.isdir(self.tools_dir):
             raise FileNotFoundError(f"Das übergebene Tools-Verzeichnis existiert nicht: {self.tools_dir}")

        self.exclude_dirs = [exclude_dir.strip().lower() for exclude_dir in exclude_dirs.split(',')] if exclude_dirs else []
        
        self.tesseract_dir = os.path.join(self.tools_dir, "tesseract")
        self.ghostscript_dir = os.path.join(self.tools_dir, "ghostscript", "bin")

        # --- PNGQUANT FIX: Korrigiere den verschachtelten Pfad ---
        pngquant_base_name = "pngquant.exe" if os.name == 'nt' else "pngquant"
        self.pngquant_path = os.path.join(self.tools_dir, "pngquant", "tools", "pngquant", pngquant_base_name)
        
        self.error_logger = None

        settings = ocr_settings if ocr_settings is not None else {}
        
        # --- LOGIK-FIX: Eindeutige OCR-Modus-Auswahl erzwingen ---
        user_wants_redo = settings.get('ocr_redo_text_layer', False)
        user_wants_skip = settings.get('ocr_skip_text_layer', False)

        if user_wants_redo:
            self.redo_ocr = True
            self.skip_text = False
            self.force_ocr = False
        elif user_wants_skip:
            self.redo_ocr = False
            self.skip_text = True
            self.force_ocr = False
        else:
            self.redo_ocr = False
            self.skip_text = False
            self.force_ocr = settings.get('ocr_force', True)

        self.ocr_image_dpi = settings.get('ocr_image_dpi', 300)
        self.ocr_optimize_level = settings.get('ocr_optimize_level', 1)
        self.ocr_tesseract_config = settings.get('ocr_tesseract_config', '--oem 1 --psm 3')
        self.ocr_clean_images = settings.get('ocr_clean_images', True)
        self.ocr_language = settings.get('ocr_language', 'deu')

        self._setup_logging()
        self._add_tools_to_path()
        self._verify_tools_in_path()

    def _setup_logging(self):
        """Konfiguriert das Logging für Konsole und Dateien."""
        log_dir = os.path.join(self.tools_dir, '..', '.logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "ocr_process.log")
        error_log_file = os.path.join(log_dir, "error.log")
        
        root_logger = logging.getLogger()
        if root_logger.hasHandlers():
            root_logger.handlers.clear()

        self.error_logger = logging.getLogger("error_logger")
        if self.error_logger.hasHandlers():
            self.error_logger.handlers.clear()
            
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            handlers=[
                logging.FileHandler(log_file, encoding="utf-8", mode='a'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        if not self.error_logger.handlers:
            error_handler = logging.FileHandler(error_log_file, encoding="utf-8", mode='a')
            error_formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt="%Y-%m-%d %H:%M:%S")
            error_handler.setFormatter(error_formatter)
            self.error_logger.addHandler(error_handler)
            self.error_logger.setLevel(logging.ERROR)
            self.error_logger.propagate = False

        logging.info("Logging wurde initialisiert.")

    def _add_tools_to_path(self):
        """Fügt die Verzeichnisse der externen Tools zum System-PATH hinzu."""
        logging.info(f"Füge Tool-Pfade hinzu: Tesseract='{self.tesseract_dir}', Ghostscript='{self.ghostscript_dir}'")

        if not os.path.isdir(self.tesseract_dir):
            raise FileNotFoundError(f"Tesseract-Verzeichnis nicht gefunden: {self.tesseract_dir}")
        if not os.path.isdir(self.ghostscript_dir):
            raise FileNotFoundError(f"Ghostscript 'bin'-Verzeichnis nicht gefunden: {self.ghostscript_dir}")

        os.environ["PATH"] = self.tesseract_dir + os.pathsep + os.environ["PATH"]
        os.environ["PATH"] = self.ghostscript_dir + os.pathsep + os.environ["PATH"]

        pngquant_dir = os.path.dirname(self.pngquant_path)
        if os.path.isfile(self.pngquant_path):
            logging.info(f"Füge hinzu: pngquant='{pngquant_dir}'")
            os.environ["PATH"] = pngquant_dir + os.pathsep + os.environ["PATH"]
        else:
            logging.warning(
                f"pngquant nicht gefunden unter '{self.pngquant_path}'. Optimierung mit pngquant evtl. nicht möglich.")
    
    def _verify_tools_in_path(self):
        """Überprüft mittels shutil.which, ob die Tools im PATH gefunden werden."""
        tesseract_exe = "tesseract.exe" if os.name == 'nt' else "tesseract"
        ghostscript_exe = "gswin64c.exe" if os.name == 'nt' else "gs"
        pngquant_exe = os.path.basename(self.pngquant_path)

        tesseract_found = shutil.which(tesseract_exe)
        ghostscript_found = shutil.which(ghostscript_exe)
        pngquant_found = shutil.which(pngquant_exe)

        logging.info("Tool-Verifizierung im PATH:")
        logging.info(
            f"  Tesseract ({tesseract_exe}): {'Gefunden -> ' + tesseract_found if tesseract_found else 'NICHT GEFUNDEN!'}")
        logging.info(
            f"  Ghostscript ({ghostscript_exe}): {'Gefunden -> ' + ghostscript_found if ghostscript_found else 'NICHT GEFUNDEN!'}")
        logging.info(
            f"  pngquant ({pngquant_exe}): {'Gefunden -> ' + pngquant_found if pngquant_found else 'Nicht gefunden (optional)'}")

        if not tesseract_found:
            logging.error(
                f"Tesseract ('{tesseract_exe}') konnte im PATH nicht gefunden werden. OCR wird fehlschlagen.")
        if not ghostscript_found:
            logging.error(
                f"Ghostscript ('{ghostscript_exe}') konnte im PATH nicht gefunden werden. OCR wird wahrscheinlich fehlschlagen.")

    def _process_pdf(self, input_file, output_file=None):
        """
        Führt OCR für eine einzelne PDF-Datei mittels ocrmypdf.ocr aus.
        """
        import ocrmypdf
        from ocrmypdf import exceptions as ocr_exceptions

        if not output_file:
            logging.warning(f"Überspringe {os.path.basename(input_file)}: Keine Ausgabedatei angegeben.")
            return input_file, "Skipped (no output file specified)"

        input_basename = os.path.basename(input_file)
        output_basename = os.path.basename(output_file)
        logging.info(f"Starte Verarbeitung: {input_basename} -> {output_basename}")

        try:
            ocrmypdf.ocr(
                input_file,
                output_file,
                language=self.ocr_language,
                deskew=True,
                rotate_pages=True,
                optimize=self.ocr_optimize_level,
                image_dpi=self.ocr_image_dpi,
                force_ocr=self.force_ocr,
                skip_text=self.skip_text,
                redo_ocr=self.redo_ocr,
                clean=self.ocr_clean_images,
                tesseract_config=self.ocr_tesseract_config,
                progress_bar=False
            )
            return input_file, "Success"
        except ocr_exceptions.PriorOcrFoundError:
            logging.warning(f"Übersprungen (vorhandene OCR): {input_basename}")
            return input_file, "Skipped (Prior OCR Found)"
        except ocr_exceptions.EncryptedPdfError:
            logging.error(f"Fehler (verschlüsselt): {input_basename}")
            self.error_logger.error(f"{input_file} - Encrypted PDF")
            return input_file, "Error (Encrypted PDF)"
        except Exception as e:
            logging.exception(f"Unerwarteter Fehler bei Verarbeitung von {input_basename}: {e}")
            self.error_logger.error(f"{input_file} - Unexpected Error: {e} (Type: {type(e).__name__})")
            return input_file, f"Error ({type(e).__name__})"

    def process_directory(self, base_dir, output_subdir=None, output_prefix=None, overwrite=False,
                        ignored_dir_names=None, max_workers=None):
        """
        Verarbeitet rekursiv alle PDFs in `base_dir` mit verschiedenen Ausgabeoptionen.
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
                cpu_cores = os.cpu_count()
                if cpu_cores:
                    max_workers = max(1, cpu_cores - 1)
                else:
                    max_workers = 1
            except NotImplementedError:
                max_workers = 1
            logging.info(f"Verwende automatisch max. {max_workers} Worker-Prozess(e).")
        else:
            logging.info(f"Verwende manuell max. {max_workers} Worker-Prozess(e).")

        pdf_tasks = self._get_pdf_tasks(base_dir, output_subdir, output_prefix, overwrite, ignored_dir_names)

        if not pdf_tasks:
            logging.warning("Keine PDF-Dateien zur Verarbeitung gefunden.")
            return

        logging.info(f"{len(pdf_tasks)} PDF-Dateien zur Verarbeitung gefunden.")
        
        processed_count = 0
        success_count = 0
        skipped_count = 0
        error_count = 0

        try:
            with ProcessPoolExecutor(max_workers=max_workers) as executor:
                results = list(tqdm(executor.map(self._process_pdf_wrapper, pdf_tasks),
                                    total=len(pdf_tasks),
                                    desc="Verarbeite PDFs",
                                    unit="Datei"))
            for _, status in results:
                processed_count += 1
                if status == "Success":
                    success_count += 1
                elif "Skipped" in status:
                    skipped_count += 1
                else:
                    error_count += 1
        finally:
            logging.info("--- OCR Prozess Zusammenfassung ---")
            logging.info(f"Gesamtzahl verarbeiteter Dateien: {processed_count}")
            logging.info(f"✅ Erfolgreich: {success_count}")
            logging.info(f"⚠️ Übersprungen: {skipped_count}")
            logging.info(f"❌ Fehler: {error_count}")
            if error_count > 0:
                error_log_path = os.path.join(self.tools_dir, '..', '.logs', "error.log")
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
            try:
                current_real_path = os.path.realpath(root)
                if current_real_path in processed_physical_dirs:
                    logging.warning(f"Symlink-Schleife oder wiederholter Pfad entdeckt, überspringe: {root}")
                    dirs[:] = []
                    continue
                processed_physical_dirs.add(current_real_path)
            except OSError as e:
                logging.warning(f"Konnte realpath für {root} nicht auflösen, überspringe evtl.: {e}")
                dirs[:] = []
                continue

            original_dirs = list(dirs)
            dirs[:] = [d for d in dirs if d not in ignored_dir_names]
            skipped_local_dirs = [d for d in original_dirs if d in ignored_dir_names]
            if skipped_local_dirs:
                for skipped in skipped_local_dirs:
                    logging.info(f"  -> Ignoriere Abstieg in '{skipped}' innerhalb von '{root}'")

            pdf_files_in_dir = [f for f in files if f.lower().endswith(".pdf")]

            if pdf_files_in_dir:
                for filename in pdf_files_in_dir:
                    input_path = os.path.join(root, filename)

                    if overwrite:
                        output_path = input_path
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
        Hilfsfunktion für ProcessPoolExecutor.map, entpackt Argumente.
        """
        input_file, output_file = args
        try:
            return self._process_pdf(input_file, output_file)
        except Exception as e:
            input_basename = os.path.basename(input_file)
            logging.error(f"Kritischer Fehler im Wrapper für {input_basename}: {e}")
            try:
                error_log_path = os.path.join(self.tools_dir, '..', '.logs', "error.log")
                with open(error_log_path, 'a', encoding='utf-8') as f:
                    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
                    f.write(
                        f"{timestamp} - {input_file} - Wrapper Error: {e} (Type: {type(e).__name__})\n")
            except Exception as log_e:
                print(f"FEHLER: Konnte nicht in error.log schreiben: {log_e}",
                    file=sys.stderr)
            return input_file, f"Error (Wrapper Exception: {type(e).__name__})"

    def process_and_save_pdf(self, input_file, output_file):
        """
        Verarbeitet eine einzelne PDF mit OCR und speichert das Ergebnis.
        """
        if not output_file:
            logging.error("Ausgabepfad muss für process_and_save_pdf angegeben werden.")
            return
        logging.info(f"Verarbeite Einzeldatei: {input_file} -> {output_file}")
        self._process_pdf(input_file, output_file)
