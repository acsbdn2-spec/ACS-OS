@echo off
cd /d "%~dp0"
py -3 setup_sync.py
if errorlevel 1 (
  echo.
  echo Could not start with py -3. Install Python from python.org and tick "py launcher".
  echo.
  pause
)
