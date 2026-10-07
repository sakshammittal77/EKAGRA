@echo off
rem Double-click to host EKAGRA on this computer. Optional: start-local.bat YourName
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" %*
