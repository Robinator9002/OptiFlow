#!/bin/bash

# Aktiviere die virtuelle Umgebung
source .venv/bin/activate

# Wechsle in das Backend-Verzeichnis und starte uvicorn
gnome-terminal -- bash -c "uvicorn backend.main:app; exec bash"

# Warte, bis Uvicorn gestartet ist (Python-Skript verwenden)
cd backend/api
python3 wait_for_uvicorn.py

# Wechsle in das Frontend-Verzeichnis und starte npm
cd ../../frontend
npm run app:dev
