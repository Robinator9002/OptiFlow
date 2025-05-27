#!/bin/bash

# Aktiviere die virtuelle Umgebung
source .venv/bin/activate

# Wechsle ins Backend-Verzeichnis und starte uvicorn
cd backend
uvicorn main:app
