#!/bin/bash

# Aktiviert die virtuelle Umgebung
source .venv/bin/activate

# Wechselt ins Frontend-Verzeichnis und startet npm
cd frontend
npm run dev &

sleep 1

xdg-open http://localhost:5173
