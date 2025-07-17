# =================================================================
# start_server.sh (Startet NUR das Backend)
# =================================================================
#!/bin/bash

# Aktiviere die virtuelle Umgebung
source .venv/bin/activate

# Wechsle ins Backend-Verzeichnis und starte uvicorn
echo "Starte Backend-Server (Uvicorn)..."
# VERBESSERUNG: Auch hier --app-dir verwenden, um 'cd' zu vermeiden.
uvicorn main:app --app-dir backend
