@echo off
echo Starting Job Spy API server...
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
