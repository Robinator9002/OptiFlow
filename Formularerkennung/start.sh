#!/bin/bash

# Aktiviere die virtuelle Umgebung
source .venv/bin/activate

# Starte Uvicorn im neuen Terminalfenster
gnome-terminal -- bash -c "uvicorn backend.main:app --reload; exec bash"

# Warte, bis Uvicorn bereit ist
cd backend/api
python3 wait_for_uvicorn.py

# Starte das Frontend
cd ../../frontend
npm run dev &

# Warte kurz, damit das Frontend den Server hochfährt
sleep 1  # oder länger, wenn dein npm langsam ist

# Öffne die Website im Browser
xdg-open http://localhost:5173
