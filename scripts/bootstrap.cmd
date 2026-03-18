@echo off
setlocal

REM Use 'bootstrap.cmd full' para rodar em modo full (microserviços + worker)
set FULL_FLAG=
if /I "%~1"=="full" set FULL_FLAG=-Full

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap.ps1" %FULL_FLAG%
if errorlevel 1 (
  echo Bootstrap falhou.
  exit /b 1
)

echo Bootstrap concluido com sucesso.
exit /b 0
