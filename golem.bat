@echo off
cd /d "%~dp0"
call .venv\Scripts\activate
pythonw main.py
