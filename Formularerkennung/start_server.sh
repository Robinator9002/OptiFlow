#!/bin/bash

# Aktiviere die virtuelle Umgebung
source .venv/bin/activate

# Wechsle ins Backend-Verzeichnis und starte uvicorn
uvicorn backend.main:app
