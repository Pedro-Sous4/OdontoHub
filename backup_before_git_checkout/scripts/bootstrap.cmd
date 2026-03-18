@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap.ps1"
if errorlevel 1 (
  echo Bootstrap falhou.
  exit /b 1
)

echo Bootstrap concluido com sucesso.
exit /b 0
