import os
import datetime
import hashlib
import logging
import json
import chardet # For text file encoding detection
import PyPDF2 # For PDF processing
import docx # For DOCX processing
import zlib # For consistent hashing (adler32)
from typing import List, Dict, Optional, Any, Tuple 
from collections import defaultdict
import concurrent.futures
import threading # Keep for _RANDOM_COEFFICIENTS_LOCK and specific main-thread locks if any
import time
import re
import random
import sys 

# Logging setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# --- MinHash Implementation Details (Top-Level for Multiprocessing) ---
_PRIME_NUMBER = 2**32 - 5 
_MAX_HASH_VALUE = sys.maxsize 
_RANDOM_COEFFICIENTS_LIST: List[tuple[int, int]] = [] 
_RANDOM_COEFFICIENTS_LOCK = threading.Lock() 

def _ensure_random_coefficients(num_functions: int, prime_val: int):
    global _RANDOM_COEFFICIENTS_LIST
    if len(_RANDOM_COEFFICIENTS_LIST) >= num_functions:
        return
    with _RANDOM_COEFFICIENTS_LOCK:
        if len(_RANDOM_COEFFICIENTS_LIST) < num_functions:
            logging.info(f"Generiere {num_functions - len(_RANDOM_COEFFICIENTS_LIST)} neue Koeffizienten für MinHash.")
            needed = num_functions - len(_RANDOM_COEFFICIENTS_LIST)
            current_coeffs_set = set(_RANDOM_COEFFICIENTS_LIST)
            new_coeffs_to_add = []
            attempts, max_attempts = 0, needed * 100
            while len(new_coeffs_to_add) < needed and attempts < max_attempts:
                a = random.randint(1, prime_val - 1)
                b = random.randint(0, prime_val - 1)
                if (a,b) not in current_coeffs_set and (a,b) not in [(nc_a, nc_b) for nc_a, nc_b in new_coeffs_to_add]:
                    new_coeffs_to_add.append((a,b))
                attempts += 1
            if len(new_coeffs_to_add) < needed:
                logging.warning(f"Nicht genug einzigartige Koeffizienten: Benötigt {needed}, Generiert {len(new_coeffs_to_add)}")
            _RANDOM_COEFFICIENTS_LIST.extend(new_coeffs_to_add)

def generate_simple_shingle_signature(
    cleaned_content: str, 
    snippet_length: int, 
    snippet_step: int, 
    signature_size: int,
    coefficients: List[tuple[int, int]], 
    prime_num: int
) -> List[int]:
    if not cleaned_content or snippet_length <= 0 or snippet_step <= 0 or signature_size <= 0:
        return []
    if len(coefficients) < signature_size:
        logging.error(f"Nicht genug Koeffizienten ({len(coefficients)}) für Signaturgröße {signature_size}.")
        return []

    signature = [_MAX_HASH_VALUE] * signature_size
    shingle_count = 0
    step = min(snippet_step, snippet_length) 
    if len(cleaned_content) < snippet_length: return []

    for i in range(0, len(cleaned_content) - snippet_length + 1, step):
        shingle = cleaned_content[i : i + snippet_length]
        shingle_count += 1
        shingle_bytes = shingle.encode('utf-8', 'surrogatepass')
        base_hash = zlib.adler32(shingle_bytes) & 0xffffffff 

        for j in range(signature_size):
            a, b = coefficients[j]
            positive_base_hash_mod_prime = (base_hash % prime_num + prime_num) % prime_num
            hashed_value = (a * positive_base_hash_mod_prime + b) % prime_num
            signature[j] = min(signature[j], hashed_value)
    
    return signature if shingle_count > 0 else []

# --- Content Processing Functions (Top-Level for Multiprocessing) ---
def clean_content_static(content: str) -> str:
    if not isinstance(content, str): return ""
    cleaned = re.sub(r'[^\w\s]', '', content) 
    cleaned = re.sub(r'\s+', '', cleaned) 
    return cleaned.lower() 

def _compute_hash_static(file_path: str) -> str:
    hasher = hashlib.md5()
    try:
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    except FileNotFoundError: logging.warning(f"Hash: Datei nicht gefunden {file_path}")
    except Exception as e: logging.error(f"Hash-Fehler für {file_path}: {e}")
    return ""

def _read_text_file_static(file_path: str) -> str:
    try:
        with open(file_path, "rb") as f:
            raw_data = f.read()
            if not raw_data: return ""
            detection = chardet.detect(raw_data)
            encoding = detection["encoding"] if detection and detection["confidence"] and detection["confidence"] > 0.5 else 'utf-8'
            return raw_data.decode(encoding or 'utf-8', errors="replace") 
    except FileNotFoundError: logging.warning(f"Textlesefehler: {file_path} nicht gefunden.")
    except Exception as e: logging.error(f"Textlesefehler für {file_path}: {e}")
    return ""

def _read_pdf_static(file_path: str) -> str:
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f, strict=False) 
            if reader.is_encrypted:
                try:
                    # In PyPDF2 v3+, decrypt returns an Enum member EncryptionType
                    decrypt_result = reader.decrypt('')
                    if decrypt_result != PyPDF2.generic.EncryptionType.DECRYPTED_BY_EMPTY_PASSWORD and \
                       decrypt_result != PyPDF2.generic.EncryptionType.DECRYPTED_BY_USER_PASSWORD : # Check against known success types
                        # Fallback for older PyPDF2 versions or other non-enum success values
                        if not (isinstance(decrypt_result, int) and decrypt_result in [1, 2]): # Older success int codes
                             logging.warning(f"PDF {file_path} verschlüsselt, Entschlüsselung fehlgeschlagen oder Status unklar: {decrypt_result}")
                             return ""
                except Exception as decrypt_err: 
                    logging.warning(f"PDF {file_path} Entschlüsselung fehlgeschlagen (evtl. Crypto fehlt oder falsches PW): {decrypt_err}")
                    return ""
            return "\n".join([p.extract_text() for p in reader.pages if p.extract_text()]).strip()
    except Exception as e: logging.error(f"PDF-Lesefehler für {file_path}: {e}")
    return ""

def _read_docx_static(file_path: str) -> str:
    try:
        doc = docx.Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs if p.text and p.text.strip()]).strip()
    except Exception as e: logging.error(f"DOCX-Lesefehler für {file_path}: {e}")
    return ""

def _extract_content_static(file_path: str, convert_pdf_flag: bool, processor_available: bool) -> Optional[str]:
    ext = os.path.splitext(file_path)[-1].lower()
    if ext in {".txt", ".md", ".csv", ".json", ".xml", ".py", ".html", ".css", ".js", ".log"}: 
        return _read_text_file_static(file_path)
    elif ext == ".pdf":
        return _read_pdf_static(file_path)
    elif ext == ".docx":
        return _read_docx_static(file_path)
    logging.debug(f"Kein spezieller Extraktor für {ext} ({file_path}), versuche als Text.")
    return _read_text_file_static(file_path) 

def _process_file_task(
    file_path: str, 
    filename: str, 
    index_content_flag: bool, 
    max_size_kb_val: int, 
    max_content_size_let_val: Optional[int],
    convert_pdf_flag: bool,
    processor_available_flag: bool 
) -> Optional[Tuple[str, Dict[str, Any]]]:
    try:
        if not os.path.exists(file_path):
            logging.warning(f"Prozess-Worker: Datei {file_path} nicht mehr vorhanden.")
            return None

        size_bytes = os.path.getsize(file_path)
        mtime = os.path.getmtime(file_path)
        mtime_iso = datetime.datetime.fromtimestamp(mtime).isoformat()
        
        file_data: Dict[str, Any] = {
            "type": "file", "name": filename, "path": file_path,
            "size_bytes": size_bytes, "modified_at": mtime_iso,
            "file_hash": None, "content": None, "content_full": None, 
            "content_hash": None, "cleaned_content": None, 
            "cleaned_content_length": 0,
        }
        file_data["file_hash"] = _compute_hash_static(file_path)

        if index_content_flag and (not max_size_kb_val or size_bytes < max_size_kb_val * 1024):
            extracted_content = _extract_content_static(file_path, convert_pdf_flag, processor_available_flag)
            if extracted_content is not None:
                file_data["content_full"] = extracted_content
                file_data["content_hash"] = hashlib.md5(extracted_content.encode('utf-8', 'ignore')).hexdigest()
                cleaned_str = clean_content_static(extracted_content)
                file_data["cleaned_content"] = cleaned_str
                file_data["cleaned_content_length"] = len(cleaned_str)
                file_data["content"] = extracted_content[:max_content_size_let_val] if max_content_size_let_val is not None else extracted_content
        
        return file_path, file_data
    except Exception as e:
        logging.error(f"Prozess-Worker Fehler für {file_path}: {e}", exc_info=True)
        return None

# --- Helper functions used by FileScanner methods ---
def compare_signatures(sig1: List[int], sig2: List[int]) -> float:
    if not sig1 or not sig2 or len(sig1) != len(sig2) or not sig1: return 0.0 # Added check for empty sig1
    return sum(1 for i in range(len(sig1)) if sig1[i] == sig2[i]) / len(sig1)

def merge_intervals(intervals: List[tuple[int, int]]) -> List[tuple[int, int]]:
    if not intervals: return []
    s_intervals = sorted(intervals, key=lambda x: x[0])
    merged = []
    if not s_intervals: return []
    current_s, current_e = s_intervals[0]
    for next_s, next_e in s_intervals[1:]:
        if next_s <= current_e: current_e = max(current_e, next_e)
        else: merged.append((current_s, current_e)); current_s, current_e = next_s, next_e
    merged.append((current_s, current_e))
    return merged

class FileScanner:
    def __init__(self, base_dirs: List[str], extensions: Optional[List[str]] = None, index_content: bool = False,
                 convert_pdf: bool = False, index_file: str = "data/file_index.json", dupe_file: str = "data/dupes.json",
                 max_size_kb: int = 0, max_content_size_let: Optional[int] = None, processor=None,
                 num_processes: Optional[int] = None, filename_exact_match_score: int = 5,
                 filename_partial_match_score: int = 3, content_match_score: int = 1, scan_delay: int = 0,
                 similarity_threshold: float = 0.90, search_limit: int = 100,
                 snippet_limit: int = 0, snippet_window: int = 40, proximity_window: int = 20, 
                 max_age_days: int = 1000, old_files_limit: int = 0, sort_by: str = 'age', sort_order: str = 'normal',
                 length_range_step: int = 10, min_category_length: int = 2, snippet_length: int = 5,      
                 snippet_step: int = 2, signature_size: int = 100):
        
        self.base_dirs = base_dirs
        self.extensions = set(ext.lower() for ext in extensions) if extensions else None
        self.index_content = index_content
        self.convert_pdf = convert_pdf 
        self.processor = processor 
        self.index_file = index_file
        self.dupe_file = dupe_file
        self.max_size_kb = max_size_kb
        self.max_content_size_let = max_content_size_let
        
        if num_processes is not None:
            self.num_processes = num_processes
        else:
            try: cpu_c = os.cpu_count(); self.num_processes = cpu_c if cpu_c else 1
            except NotImplementedError: self.num_processes = 1
        if self.num_processes <= 0: self.num_processes = 1

        self.filename_exact_match_score = filename_exact_match_score
        self.filename_partial_match_score = filename_partial_match_score
        self.content_match_score = content_match_score
        self.scan_delay = scan_delay
        self.similarity_threshold = similarity_threshold
        self.search_limit = search_limit
        self.snippet_limit = snippet_limit
        self.snippet_window = snippet_window
        self.proximity_window = proximity_window
        self.max_age_days = max_age_days
        self.old_files_limit = old_files_limit
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.length_range_step = max(1, length_range_step)
        self.min_category_length = max(2, min_category_length)
        self.snippet_length = max(1, snippet_length)
        self.snippet_step = max(1, snippet_step)
        self.signature_size = max(1, signature_size)
        
        self.index = defaultdict(dict)
        self.duplicate_groups: Dict[str, Any] = {}
        self._current_scan_seen_paths = set()

        if self.signature_size > 0:
            _ensure_random_coefficients(self.signature_size, _PRIME_NUMBER)

        logging.info(f"FileScanner init. num_processes: {self.num_processes}, Dedupe Thresh: {self.similarity_threshold}, SigSize: {self.signature_size}")

    def _highlight_text_content(self, text_content: str, queries: List[str]) -> str:
        if not text_content or not queries: return text_content
        text_content_lower = text_content.lower()
        all_matches: List[Tuple[int, int]] = [] 
        for query in queries:
            query_lower = query.strip().lower()
            if not query_lower: continue
            idx = 0
            while True:
                pos = text_content_lower.find(query_lower, idx)
                if pos == -1: break
                all_matches.append((pos, pos + len(query_lower)))
                idx = pos + 1 
        if not all_matches: return text_content
        all_matches.sort(key=lambda x: (x[0], -x[1]))
        merged_highlight_intervals: List[Tuple[int, int]] = []
        if all_matches:
            cs, ce = all_matches[0]
            for ns, ne in all_matches[1:]:
                if ns < ce: ce = max(ce, ne)
                else: merged_highlight_intervals.append((cs, ce)); cs, ce = ns, ne
            merged_highlight_intervals.append((cs, ce))
        parts, current_pos = [], 0
        for s, e in merged_highlight_intervals: 
            if s > current_pos: parts.append(text_content[current_pos:s])
            parts.extend(["**", text_content[s:e], "**"])
            current_pos = e
        if current_pos < len(text_content): parts.append(text_content[current_pos:])
        return "".join(parts)

    def load_index(self):
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    self.index = defaultdict(dict, json.load(f))
                logging.info(f"Index geladen: {len(self.index)} Einträge aus {self.index_file}.")
                return {"message": "Index geladen.", "data": dict(self.index)}
            except Exception as e:
                logging.error(f"Index Ladefehler {self.index_file}: {e}")
                self.index = defaultdict(dict)
                return {"message": f"Index Ladefehler: {e}"}
        self.index = defaultdict(dict)
        return {"message": f"Indexdatei {self.index_file} nicht gefunden."}

    def scan_files(self, actualize: bool = False) -> Dict[str, any]:
        logging.info(f"Starte Dateiscan (actualize={actualize}) mit Multiprocessing...")
        if not actualize and not self.index:
            self.load_index()

        self._current_scan_seen_paths = set() 
        tasks_for_processing = []

        for base_dir in self.base_dirs:
            if not os.path.exists(base_dir):
                logging.warning(f"Basisverzeichnis {base_dir} nicht gefunden.")
                continue
            for root, dirs, files_in_dir in os.walk(base_dir): # Renamed 'files' to 'files_in_dir'
                for folder_name in dirs: 
                    folder_path = os.path.join(root, folder_name)
                    self.index[folder_path] = {"type": "folder", "name": folder_name, "path": folder_path}
                    self._current_scan_seen_paths.add(folder_path)
                
                for file_name in files_in_dir: # Use the renamed variable
                    file_path = os.path.join(root, file_name)
                    file_ext = os.path.splitext(file_name)[1].lower()
                    if self.extensions and file_ext not in self.extensions:
                        continue
                    
                    needs_processing = True
                    if actualize and file_path in self.index and self.index[file_path].get("type") == "file":
                        try:
                            # More robust check based on file_hash if available, or mtime & size
                            entry = self.index[file_path]
                            fs_mtime = os.path.getmtime(file_path)
                            fs_mtime_iso = datetime.datetime.fromtimestamp(fs_mtime).isoformat()
                            fs_size = os.path.getsize(file_path)

                            if entry.get('modified_at') == fs_mtime_iso and \
                               entry.get('size_bytes') == fs_size and \
                               ('content_full' in entry or not self.index_content or (self.max_size_kb > 0 and fs_size >= self.max_size_kb * 1024)):
                                # If not indexing content or file too large, mtime/size is enough
                                # If indexing content, ensure it was processed (content_full exists)
                                needs_processing = False
                                self._current_scan_seen_paths.add(file_path) 
                        except FileNotFoundError: # File vanished between os.walk and getmtime/size
                            needs_processing = False # Don't try to process, will be removed later
                            if file_path in self.index: del self.index[file_path]
                        except Exception as e_check: 
                            logging.debug(f"Fehler bei Vorabprüfung für {file_path}: {e_check}")
                            pass # Proceed with needs_processing = True
                    
                    if needs_processing:
                        tasks_for_processing.append((
                            file_path, file_name, self.index_content, self.max_size_kb,
                            self.max_content_size_let, self.convert_pdf, (self.processor is not None)
                        ))
                    if self.scan_delay > 0 and needs_processing: time.sleep(self.scan_delay / 1000.0)
        
        num_workers: int
        try:
            cpu_c = os.cpu_count()
            if cpu_c is None: num_workers = max(1, self.num_processes)
            elif not self.num_processes: num_workers = cpu_c -1 if cpu_c > 1 else 1
            elif cpu_c > 1: num_workers = min(max(self.num_processes, 1), cpu_c -1)
            else: num_workers = 1
        except (NotImplementedError, Exception): num_workers = max(1, self.num_processes)
        if num_workers < 1: num_workers = 1
        logging.info(f"Scan: Verarbeite {len(tasks_for_processing)} Dateien mit {num_workers} Prozess(en).")

        new_or_updated_index_entries = {}
        if tasks_for_processing:
            with concurrent.futures.ProcessPoolExecutor(max_workers=num_workers) as executor:
                future_to_path = {executor.submit(_process_file_task, *task_args): task_args[0] for task_args in tasks_for_processing}
                for future in concurrent.futures.as_completed(future_to_path):
                    original_path = future_to_path[future]
                    try:
                        result = future.result()
                        if result:
                            returned_path, file_data_dict = result
                            new_or_updated_index_entries[returned_path] = file_data_dict
                            self._current_scan_seen_paths.add(returned_path)
                    except Exception as e:
                        logging.error(f"Scan-Fehler (Haupt-Thread) für {original_path}: {e}")
        
        for path, data in new_or_updated_index_entries.items():
            self.index[path] = data

        if actualize:
            paths_in_index_before_cleanup = list(self.index.keys())
            for path_in_idx in paths_in_index_before_cleanup:
                if path_in_idx not in self._current_scan_seen_paths:
                    if not os.path.exists(path_in_idx): 
                        if path_in_idx in self.index: del self.index[path_in_idx] # Ensure it's still there
                        logging.info(f"Actualize: '{path_in_idx}' aus Index entfernt (nicht mehr existent).")
        
        logging.info(f"Scan abgeschlossen. Index enthält {len(self.index)} Einträge.")
        return {"message": f"{len(self.index)} Dateien/Ordner indiziert.", "data": dict(self.index)}

    def actualize_index(self) -> Dict[str, any]:
        return self.scan_files(actualize=True)

    def search(self, query_input: str, search_limit: Optional[int] = None) -> Dict[str, any]:
        queries = [q.strip().lower() for q in query_input.split(",") if q.strip()]
        if not queries: return {"message": "Keine Suchbegriffe.", "data": []}
        
        eff_limit = search_limit if search_limit is not None else self.search_limit
        results = []
        for path, entry in self.index.items():
            if entry.get("type") != "file": continue
            
            current_score = 0 # Renamed from 'score' to avoid conflict with old 'match_score' usage
            name_lower = entry.get("name","").lower()
            content_lower = (entry.get("content","") or "").lower() 

            # Filename matching
            filename_already_scored = False
            for q_term in queries:
                if q_term == name_lower: 
                    current_score += self.filename_exact_match_score
                    filename_already_scored = True; break 
            if not filename_already_scored:
                for q_term in queries:
                    if q_term in name_lower: 
                        current_score += self.filename_partial_match_score
                        filename_already_scored = True; break
            
            # Content matching
            if self.index_content and content_lower:
                occurrences = 0
                for q_t in queries:
                    occurrences += content_lower.count(q_t)
                
                if occurrences > 0: 
                    current_score += self.content_match_score # Base score for any content match
                    if occurrences > 1 : # Add more for multiple occurrences
                         current_score += (occurrences -1) * self.content_match_score 
            
            if current_score > 0:
                results.append({
                    "file": {
                        "name": entry.get("name"), 
                        "path": entry.get("path"), # path is the key, but also stored in entry
                        "size_bytes": entry.get("size_bytes"), 
                        "modified_at": entry.get("modified_at"), 
                        "type": entry.get("type")
                    },
                    "match_count": current_score # CHANGED from match_score to match_count
                })
        
        results.sort(key=lambda x: (-x["match_count"], (x["file"].get("name") or "").lower()))
        if eff_limit and eff_limit > 0: results = results[:eff_limit]
        
        logging.info(f"Suche für '{query_input}' ergab {len(results)} Treffer.")
        return {"message": f"{len(results)} Treffer.", "data": results}

    def search_in_file(self, path: str, query_input: str) -> Dict[str, any]:
        entry = self.index.get(path)
        default_resp = lambda msg, file_info=None: {"file":file_info, "match_count":0, "snippets":[], "message":msg}
        if not entry or entry.get("type") != "file":
            return default_resp(f"Datei '{path}' nicht im Index oder kein Dateityp.")

        file_info_out = {k:v for k,v in entry.items() if k not in ['content_full', 'cleaned_content', 'content_hash', 'file_hash', 'content']}
        file_info_out['content_preview'] = entry.get('content') 

        raw_content = entry.get("content_full") or entry.get("content") 
        if not raw_content: return default_resp(f"Kein Inhalt für '{path}'.", file_info_out)
        
        # Normalisiere die Zeilenumbrüche, BEVOR wir suchen und Offsets berechnen.
        # Das stellt die Konsistenz mit dem Frontend sicher.
        content_to_search = raw_content.replace('\r\n', '\n')

        queries = [q.strip().lower() for q in query_input.split(",") if q.strip()]
        if not queries: return default_resp("Keine Suchbegriffe.", file_info_out)

        content_low = content_to_search.lower()
        raw_matches = []
        for q_term in queries:
            idx = -1
            while True:
                idx = content_low.find(q_term, idx + 1)
                if idx == -1: break
                raw_matches.append((idx, idx + len(q_term)))
        
        if not raw_matches: return default_resp(f"Keine Treffer für '{query_input}' in '{path}'.", file_info_out)

        merged_hits = merge_intervals(sorted(raw_matches, key=lambda x: x[0]))
        hit_count = len(merged_hits)
        
        snippet_bounds = sorted([{'start':max(0,s-self.snippet_window), 'end':min(len(content_to_search),e+self.snippet_window)} for s,e in merged_hits], key=lambda x:x['start'])
        final_snippets = []
        if snippet_bounds:
            merged_display_intervals = merge_intervals([(b['start'], b['end']) for b in snippet_bounds])
            for s_start, s_end in merged_display_intervals:
                segment = content_to_search[s_start:s_end]
                s_score = sum(1 for r_s, r_e in raw_matches if max(r_s, s_start) < min(r_e, s_end))
                final_snippets.append({'text':self._highlight_text_content(segment, queries), 'start':s_start, 'end':s_end, 'score':s_score})
        
        final_snippets.sort(key=lambda x: x['score'], reverse=True)
        if self.snippet_limit and self.snippet_limit > 0: final_snippets = final_snippets[:self.snippet_limit]
        
        return {"file":file_info_out, "match_count":hit_count, "snippets":final_snippets}

    def find_old_files(self, max_age_days: Optional[int] = None, old_files_limit: Optional[int] = None, 
                       sort_by: Optional[str] = None, sort_order: Optional[str] = None) -> List[Dict[str, Any]]:
        eff_age = max_age_days if max_age_days is not None else self.max_age_days
        eff_limit = old_files_limit if old_files_limit is not None else self.old_files_limit
        eff_sort_by = sort_by if sort_by is not None else self.sort_by
        eff_sort_order = sort_order if sort_order is not None else self.sort_order

        if not (isinstance(eff_age, (int, float)) and eff_age > 0): return []
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        cutoff = now_utc - datetime.timedelta(days=eff_age)
        old = []
        for data in self.index.values(): # Iterate over values (dictionaries)
            if data.get("type") == "file" and "modified_at" in data:
                try:
                    mod_dt = datetime.datetime.fromisoformat(data["modified_at"])
                    # Ensure timezone awareness for comparison
                    mod_utc = mod_dt.astimezone(datetime.timezone.utc) if mod_dt.tzinfo else mod_dt.replace(tzinfo=datetime.timezone.utc)
                    if mod_utc <= cutoff:
                        d_copy = data.copy(); d_copy['_internal_sort_age_dt_'] = mod_utc; old.append(d_copy)
                except Exception: pass 
        
        rev = (eff_sort_order == 'inverted')
        sort_key_func = lambda x: x['_internal_sort_age_dt_'] # Default to age
        if eff_sort_by == 'size': sort_key_func = lambda x: x.get('size_bytes', 0)
        elif eff_sort_by != 'age': # If not age or size, log warning and default to age
            logging.warning(f"Ungültiger sort_by Wert '{eff_sort_by}' für find_old_files. Verwende 'age'.")
        
        try:
            old.sort(key=sort_key_func, reverse=rev)
        except TypeError as e: # Catch errors if _internal_sort_age_dt_ is missing for some reason
            logging.error(f"Sortierfehler in find_old_files: {e}. Liste könnte unsortiert sein.")

        for item in old: item.pop('_internal_sort_age_dt_', None)
        
        return old[:eff_limit] if eff_limit and eff_limit > 0 else old

    def find_duplicates(self) -> Dict[str, Any]:
        logging.info("Starte Duplikatsuche mit Multiprocessing (konsistenter Hash)...")
        if not self.index: return {}

        _ensure_random_coefficients(self.signature_size, _PRIME_NUMBER)
        coeffs_to_use = list(_RANDOM_COEFFICIENTS_LIST) # Use the globally ensured list
        if len(coeffs_to_use) < self.signature_size:
            logging.error("Nicht genug Koeffizienten für Deduplizierung.")
            return {}

        content_groups: Dict[int, List[Tuple[str, str, Dict[str,Any]]]] = defaultdict(list)
        for path, entry in self.index.items():
            if entry.get("type") == "file" and entry.get("cleaned_content") and \
                entry.get("cleaned_content_length", 0) >= self.snippet_length:
                length = entry["cleaned_content_length"]
                key = (length // self.length_range_step) * self.length_range_step
                content_groups[key].append((path, entry["cleaned_content"], entry))
        
        potential_groups = {k:v for k,v in content_groups.items() if len(v) >= self.min_category_length}
        if not potential_groups: logging.info("Keine potenziellen Duplikatgruppen nach Längenfilter."); return {}
        
        tasks = [] 
        for length_key, items_in_group in potential_groups.items():
            for path, cleaned_c, f_info in items_in_group:
                tasks.append((cleaned_c, self.snippet_length, self.snippet_step, self.signature_size, 
                            coeffs_to_use, _PRIME_NUMBER, path, f_info, length_key))

        num_workers: int
        try:
            cpu_c = os.cpu_count()
            if cpu_c is None: num_workers = max(1, self.num_processes)
            elif not self.num_processes: num_workers = cpu_c -1 if cpu_c > 1 else 1
            elif cpu_c > 1: num_workers = min(max(self.num_processes, 1), cpu_c -1)
            else: num_workers = 1
        except (NotImplementedError, Exception): num_workers = max(1, self.num_processes)
        if num_workers < 1: num_workers = 1
        logging.info(f"Dedupe: Erstelle {len(tasks)} Signaturen mit {num_workers} Prozess(en).")

        files_with_sigs: List[Dict[str, Any]] = [] 
        if tasks:
            with concurrent.futures.ProcessPoolExecutor(max_workers=num_workers) as executor:
                future_map = {executor.submit(generate_simple_shingle_signature, t[0],t[1],t[2],t[3],t[4],t[5]): (t[6],t[7],t[8]) for t in tasks}
                for future in concurrent.futures.as_completed(future_map):
                    path, f_info, l_key = future_map[future]
                    try:
                        sig = future.result()
                        if sig: files_with_sigs.append({"path":path, "signature":sig, "file_info":f_info, "length_key":l_key})
                    except Exception as e: logging.error(f"Signaturfehler für {path}: {e}")
        
        logging.info(f"Dedupe: Vergleiche {len(files_with_sigs)} Signaturen...")
        sigs_by_len_key = defaultdict(list)
        for item in files_with_sigs: sigs_by_len_key[item["length_key"]].append(item)

        final_dupes = {}
        group_id_counter = 0
        for l_key, items in sigs_by_len_key.items():
            processed_paths = set()
            items.sort(key=lambda x: x["path"])
            for i in range(len(items)):
                item_i = items[i]
                if item_i["path"] in processed_paths: continue
                current_cluster_paths_list = [item_i["path"]] # Renamed from current_cluster
                processed_paths.add(item_i["path"])
                for j in range(i + 1, len(items)):
                    item_j = items[j]
                    if item_j["path"] in processed_paths: continue
                    if compare_signatures(item_i["signature"], item_j["signature"]) >= self.similarity_threshold:
                        current_cluster_paths_list.append(item_j["path"])
                        processed_paths.add(item_j["path"])
                
                if len(current_cluster_paths_list) >= self.min_category_length:
                    group_id_counter += 1
                    gid = f"group_{group_id_counter}"
                    cluster_files_output, cluster_sigs = [], []
                    for p_path in current_cluster_paths_list:
                        orig_item = next((it for it in items if it["path"] == p_path), None) # Safer find
                        if not orig_item: continue # Should not happen
                        cluster_sigs.append(orig_item["signature"])
                        f_info_orig = orig_item["file_info"]
                        cluster_files_output.append({
                            "name":f_info_orig.get("name"), "path":p_path,
                            "size_bytes":f_info_orig.get("size_bytes"),"modified_at":f_info_orig.get("modified_at"),
                            "type":f_info_orig.get("type")
                        })
                    
                    avg_s, pairs = 0.0, 0
                    if len(cluster_sigs) >=2:
                        total_s = sum(compare_signatures(cluster_sigs[s1], cluster_sigs[s2]) for s1 in range(len(cluster_sigs)) for s2 in range(s1+1, len(cluster_sigs)))
                        pairs = len(cluster_sigs) * (len(cluster_sigs)-1) // 2
                        if pairs > 0: avg_s = total_s / pairs
                    
                    final_dupes[gid] = {"avg_similarity": round(avg_s,4), "length_range": f"{l_key}-{l_key+self.length_range_step-1}", 
                                        "file_count": len(current_cluster_paths_list), "files": cluster_files_output}
        
        self.duplicate_groups = final_dupes
        logging.info(f"Deduplikatsuche abgeschlossen: {len(self.duplicate_groups)} Gruppen gefunden.")
        return self.duplicate_groups

    def save_duplicates(self) -> Dict[str, str]:
        if not self.duplicate_groups: return {"message": "Keine Duplikate zum Speichern."}
        try:
            d_dir = os.path.dirname(self.dupe_file)
            if d_dir: os.makedirs(d_dir, exist_ok=True)
            with open(self.dupe_file, "w", encoding="utf-8") as f: json.dump(self.duplicate_groups, f, indent=4, ensure_ascii=False)
            return {"message": f"Duplikate gespeichert in {self.dupe_file}."}
        except Exception as e: return {"message": f"Speicherfehler Duplikate: {e}"}

    def load_duplicates(self) -> Dict[str, Any]:
        if os.path.exists(self.dupe_file):
            try:
                with open(self.dupe_file, "r", encoding="utf-8") as f: loaded = json.load(f)
                if isinstance(loaded, dict): self.duplicate_groups = loaded; return {"message":"Duplikate geladen.", "result":self.duplicate_groups.copy()}
                self.duplicate_groups = {}; return {"message":"Fehler: Unerwartetes Format in Duplikatdatei."}
            except Exception as e: self.duplicate_groups={}; return {"message":f"Ladefehler Duplikate: {e}"}
        self.duplicate_groups={}; return {"message":f"Duplikatdatei {self.dupe_file} nicht gefunden."}

    def search_duplicates(self, query: Optional[str] = None, sort_by: str = 'similarity', 
                          sort_order: str = 'desc', length_range_filter: Optional[str] = None) -> Dict[str, Any]:
        if not self.duplicate_groups: return {}
        items = [{'id':gid, **ginfo} for gid,ginfo in self.duplicate_groups.items() if isinstance(ginfo,dict) and 'files' in ginfo]
        
        q_low = query.lower().strip() if query and query.strip() else None
        len_filt = length_range_filter.strip() if length_range_filter and length_range_filter.strip() else None

        filtered = []
        for g in items:
            q_match = not q_low or q_low in g['id'].lower() or q_low in g.get('length_range','').lower() or \
                      any(q_low in f.get("name","").lower() or q_low in f.get("path","").lower() for f in g.get("files",[]))
            len_match = not len_filt or g.get('length_range') == len_filt
            if q_match and len_match: filtered.append(g)

        key_fn = lambda x: x.get('avg_similarity',0.0) # Default sort
        if sort_by == 'length': 
            try: key_fn = lambda x: int(x.get('length_range','0-0').split('-')[0]) if x.get('length_range') else 0
            except ValueError: key_fn = lambda x: 0 # Fallback for bad length_range format
        elif sort_by == 'file_count': key_fn = lambda x: x.get('file_count',0)
        
        try: filtered.sort(key=key_fn, reverse=(sort_order=='desc'))
        except Exception as e: logging.error(f"Sortierfehler Duplikatsuche: {e}")
        
        return {item.pop('id'):item for item in filtered}

    def save_index(self):
        if not self.index: return {"message":"Index leer, nichts zu speichern."}
        try:
            i_dir = os.path.dirname(self.index_file)
            if i_dir: os.makedirs(i_dir, exist_ok=True)
            with open(self.index_file, "w", encoding="utf-8") as f: json.dump(dict(self.index), f, indent=4, ensure_ascii=False)
            return {"message":f"Index gespeichert in {self.index_file}."}
        except Exception as e: return {"message":f"Speicherfehler Index: {e}"}

    def update_file(self, update_data: Dict[str, Any]): 
        path = update_data.get('path')
        if not path or not isinstance(path,str) or path not in self.index:
            return {"message":f"Datei '{path}' nicht im Index oder Pfad ungültig.", "updated":False}
        
        changed = []
        entry = self.index[path]
        # Only allow specific, safe fields for direct update to avoid inconsistencies.
        # 'content' update implies 'content_full', 'cleaned_content' etc. should be re-derived.
        allowed_direct_updates = {'name'} # Example: only name can be directly updated.
                                         # 'custom_tags', 'description' could be other examples.
        
        for field, val in update_data.items():
            if field == 'path': continue # Path is key, not updatable this way
            if field in allowed_direct_updates:
                 if entry.get(field) != val:
                    entry[field] = val
                    changed.append(field)
            elif field == 'content':
                logging.warning(f"Direktes Update von 'content' für {path} ist nicht empfohlen, da abgeleitete Felder inkonsistent werden. Bitte Datei neu verarbeiten lassen.")
                # If strictly needed and understood:
                # entry[field] = val
                # entry['content_full'] = val # Assume updated content is the full content
                # entry['cleaned_content'] = clean_content_static(val)
                # entry['cleaned_content_length'] = len(entry['cleaned_content'])
                # entry['content_hash'] = hashlib.md5(val.encode('utf-8','ignore')).hexdigest()
                # changed.append(field)
                # But this is prone to issues if `val` is not the "full" new content.
            else:
                logging.warning(f"Feld '{field}' kann nicht direkt aktualisiert werden für {path}.")


        if not changed: return {"message":f"Keine unterstützten Änderungen für '{path}'.", "updated":False}
        logging.info(f"Datei '{path}' aktualisiert (Felder: {', '.join(changed)}).")
        return {"message":f"'{path}' aktualisiert.", "updated":True, "updated_fields":changed}
    
    def delete_index(self):
        msg_parts = []
        if os.path.exists(self.index_file):
            try: os.remove(self.index_file); msg_parts.append(f"Indexdatei {self.index_file} gelöscht.")
            except Exception as e: msg_parts.append(f"Fehler Löschen Indexdatei: {e}.")
        else: msg_parts.append(f"Indexdatei {self.index_file} nicht gefunden.")
        self.index = defaultdict(dict)
        self._current_scan_seen_paths = set() 
        self.duplicate_groups = {}
        msg_parts.append("In-Memory Daten zurückgesetzt.")
        final_msg = " ".join(msg_parts)
        logging.info(final_msg)
        return {"message": final_msg}

    def remove_from_index(self, path_to_remove: str):
        if not isinstance(path_to_remove, str) or not path_to_remove: return {"message":"Ungültiger Pfad.", "removed":False}
        removed = False
        if path_to_remove in self.index:
            try: del self.index[path_to_remove]; removed=True
            except Exception: pass 
        if path_to_remove in self._current_scan_seen_paths: # Also remove from temporary seen set if it exists
             self._current_scan_seen_paths.discard(path_to_remove)

        if removed: return {"message":f"'{path_to_remove}' aus Index entfernt.", "removed":True}
        return {"message":f"'{path_to_remove}' nicht im Index gefunden.", "removed":False}
    
    def process_index(self, overwrite: bool = False):
        logging.info(f"Starte Index-weite PDF OCR-Verarbeitung (overwrite={overwrite})...")
        if not self.processor or not hasattr(self.processor, 'get_ocr_text_from_pdf'):
            logging.warning("Kein OCR-Prozessor mit 'get_ocr_text_from_pdf' für process_index vorhanden.")
            return {"message":"Kein OCR-Prozessor konfiguriert.", "processed":0, "errors":0}

        processed_count, error_count = 0, 0
        # Create a list of paths to avoid issues if index is modified during iteration (though not expected here)
        pdf_paths_to_ocr = [p for p, d in list(self.index.items()) if d.get("type")=="file" and p.lower().endswith(".pdf")]

        for pdf_path in pdf_paths_to_ocr:
            entry = self.index.get(pdf_path) # Get fresh entry in case it was modified
            if not entry: continue 
            try:
                ocr_text = self.processor.get_ocr_text_from_pdf(pdf_path) 
                if ocr_text and ocr_text.strip():
                    new_content_hash = hashlib.md5(ocr_text.encode('utf-8','ignore')).hexdigest()
                    if entry.get('content_hash') == new_content_hash and not overwrite:
                        processed_count+=1; continue 
                    
                    entry['content_full'] = ocr_text
                    entry['content'] = ocr_text[:self.max_content_size_let] if self.max_content_size_let else ocr_text
                    entry['content_hash'] = new_content_hash
                    cleaned = clean_content_static(ocr_text) 
                    entry['cleaned_content'] = cleaned
                    entry['cleaned_content_length'] = len(cleaned)
                    entry['modified_at'] = datetime.datetime.now().isoformat()
                    if overwrite: entry['file_hash'] = _compute_hash_static(pdf_path) 
                    processed_count += 1
                else: error_count +=1 
            except Exception as e: error_count+=1; logging.error(f"OCR Fehler für {pdf_path} in process_index: {e}")
        
        msg = f"Index-weite OCR: {processed_count} verarbeitet, {error_count} Fehler."
        logging.info(msg)
        return {"message":msg, "processed":processed_count, "errors":error_count}

    def find_old_files_in_index(self, max_files: Optional[int] = None, max_age_days: Optional[int] = None, 
                                sort_by: Optional[str] = None, sort_order: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.find_old_files(max_age_days, max_files, sort_by, sort_order) # Alias
