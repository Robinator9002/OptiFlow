from pydantic import BaseModel, RootModel
from typing import List, Optional, Dict, Union

# Pydantic Modelle
class FileInfo(BaseModel):
    type: str
    name: str
    path: str
    size_bytes: Optional[float] = None
    modified_at: Optional[str] = None # Changed from created_at to modified_at for consistency with FileScanner
    content: Optional[str] = None # Optional, da nicht immer im Index gespeichert

class FileUpdate(BaseModel):
    path: str
    name: Optional[str] = None
    content: Optional[str] = None

class FileSearchResult(BaseModel):
    file: FileInfo
    match_count: float

class SnippetResult(BaseModel):
    text: str
    score: int
    start: int # Add start and end to SnippetResult model
    end: int   # Add start and end to SnippetResult model


class FileContentResult(BaseModel):
    # Das Modell erwartet die Struktur, die search_in_file zurückgibt
    file: FileInfo # Use FileInfo model here
    match_count: int
    snippets: List[SnippetResult]

class SearchRequest(BaseModel):
    query_input: str
    file_path: Optional[str] = None  # Nur setzen, wenn nur in einer Datei gesucht werden soll

# Das SearchResult Modell für die API-Antwort
class SearchResult(BaseModel):
    message: str
    data: Union[List[FileSearchResult], FileContentResult] # data kann Liste oder einzelnes Ergebnis sein

# Model for a duplicate group in the response
class DuplicateGroup(BaseModel):
    avg_similarity: float
    length_range: str
    file_count: int
    files: List[FileInfo] # List of files within this group

# Model for the overall find/search duplicates response
class DuplicateGroupsResponse(RootModel[Dict[str, DuplicateGroup]]):
    pass

# Model for search duplicates request
class SearchDuplicatesRequest(BaseModel):
    query: Optional[str] = None
    sort_by: str = 'similarity' # 'similarity', 'length', 'file_count'
    sort_order: str = 'desc' # 'asc', 'desc'
    length_range_filter: Optional[str] = None

class FileScanResponse(BaseModel):
    message: str
    config: Optional[Dict] = None
    duplicates: Optional[List[Dict[str, str]]] = None

class ScannerConfig(BaseModel):
    base_dirs: Optional[List[str]] = None
    extensions: Optional[List[str]] = None
    index_content: Optional[bool] = None
    convert_pdf: Optional[bool] = None
    max_size_kb: Optional[int] = None
    max_content_size_let: Optional[int] = None
    
class FileWriteRequest(BaseModel):
    file_path: str
    content: str
    
# -- Alte Dateien Suchen --
class OldFilesQueryParams(BaseModel):
    """
    Modell für die Query-Parameter des /api/find_old_files Endpoints.
    """
    max_files: Optional[int] = None
    max_age_days: Optional[int] = None
    sort_by: Optional[str] = None # Kann 'size' oder 'age' sein
    sort_order: Optional[str] = None # Kann 'normal' oder 'inverted' sein

class OldFileInfo(BaseModel):
    """
    Modell für die Informationen einer einzelnen alten Datei im Ergebnis.
    """
    path: str
    name: str
    size_bytes: Optional[int] = None # size_bytes kann fehlen
    modified_at: str # ISO 8601 Format
    
# -- OCR Prozessor --    
class PDFProcessDirectoryRequest(BaseModel):
    base_dir: str
    output_subdir: Optional[str] = None
    output_prefix: Optional[str] = None
    overwrite: Optional[bool] = None
    ignored_dir_names: Optional[str] = None
    max_workers: Optional[int] = None
    
class PDFProcessFileRequest(BaseModel):
    input_file: str
    output_file: str
    
# -- Events --
class EventIn(BaseModel):
    frequency: str
    times: List[str]
    event: str

# -- Nutzer --
class User(BaseModel):
    username: str
    password: str

class AdminUser(BaseModel):
    admin_username: str
    admin_password: str
    username: str
    password: str
    is_admin: bool
    
class LogoutRequest(BaseModel):
    username: str
    
class ShutdownRequest(BaseModel):
    password: str
    
# -- Settings --
class MatchScore(BaseModel):
    filename_exact: Optional[int] = None
    filename_partial: Optional[int] = None
    content: Optional[int] = None

class UserManagement(BaseModel):
    user: User
    admin_user: Optional[User] = None
    make_admin: Optional[bool] = None
    remove_user: Optional[bool] = None
    reset_password: Optional[bool] = None
    
class DataWrapper(BaseModel):
    data: Union[Dict, List]

class Settings(BaseModel):
    search_limit: Optional[int] = None
    snippet_limit: Optional[int] = None
    old_files_limit: Optional[int] = None
    show_relevance: Optional[bool] = None
    match_score: Optional[MatchScore] = None
    scanner_cpu_cores: Optional[int] = None
    usable_extensions: Optional[List[str]] = None
    scan_delay: Optional[int] = None
    snippet_window: Optional[int] = None
    proximity_window: Optional[int] = None
    max_age_days: Optional[int] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None
    processor_excluded_folders: Optional[str] = None
    subfolder: Optional[str] = None
    prefix: Optional[str] = None
    overwrite: Optional[bool] = None
    processing_cpu_cores: Optional[int] = None
    force_ocr: Optional[bool] = None
    skip_text: Optional[bool] = None
    redo_ocr: Optional[bool] = None
    theme_name: Optional[str] = None
    font_type: Optional[str] = None
    font_size: Optional[float] = None
    database_length: Optional[int] = None # Assuming this relates to index size or similar
    check_interval: Optional[int] = None
    max_file_size: Optional[int] = None # Assuming this is in KB, mapping to max_size_kb

    # --- NEUE DEDUPING EINSTELLUNGEN ---
    length_range_step: Optional[int] = None # Schrittweite für die Gruppierung nach bereinigter Inhaltslänge
    min_category_length: Optional[int] = None # Mindestanzahl von Dateien in einer Gruppe
    snippet_length: Optional[int] = None # Länge der Zeichen-Shingles (K)
    snippet_step: Optional[int] = None # Abstand zwischen dem Start jedes Shingles
    signature_size: Optional[int] = None # Anzahl der Top-Hash-Werte für die Signatur (M)
    similarity_threshold: Optional[float] = None # Mindestübereinstimmungswert für die Ähnlichkeitsgruppierung (0.0 bis 1.0)
