$ErrorActionPreference = 'Stop'

param(
  [string]$GatewayBaseUrl = 'http://localhost:3000',
  [int]$HealthTimeoutSeconds = 240,
  [switch]$Full
)

function Info($message) {
  Write-Host "[bootstrap] $message" -ForegroundColor Cyan
}

function Success($message) {
  Write-Host "[bootstrap] $message" -ForegroundColor Green
}

function Fail($message) {
  Write-Host "[bootstrap] $message" -ForegroundColor Red
  exit 1
}

Info 'Validando Docker no PATH...'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail 'Docker não encontrado no PATH. Instale/abra o Docker Desktop e tente novamente.'
}

Info 'Validando Docker Engine...'
try {
  docker info | Out-Null
} catch {
  Fail 'Docker instalado, mas o engine não respondeu. Abra o Docker Desktop e aguarde iniciar.'
}

$composeArgs = @('up', '-d', '--build')
if ($Full) {
  Info 'Modo full (microserviços + worker) ativado.'
  $composeArgs += '--profile'
  $composeArgs += 'full'
} else {
  Info 'Modo leve (API Gateway + Frontend + infra) ativado.'
}

Info "Subindo stack com docker compose: docker compose $($composeArgs -join ' ')"
& docker compose @composeArgs
if ($LASTEXITCODE -ne 0) {
  Fail 'Falha ao subir a stack com docker compose.'
}

Info "Aguardando health do gateway em $GatewayBaseUrl/health ..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
$healthy = $false

while ((Get-Date) -lt $deadline) {
  try {
    $health = Invoke-RestMethod -Method Get -Uri "$GatewayBaseUrl/health" -TimeoutSec 5
    if ($health.status -eq 'ok') {
      $healthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 3
  }
}

if (-not $healthy) {
  Fail "Gateway não ficou saudável em até $HealthTimeoutSeconds segundos."
}

Success 'Gateway saudável. Executando smoke test...'

$smokeScript = Join-Path $PSScriptRoot 'smoke-test.ps1'
if (-not (Test-Path $smokeScript)) {
  Fail "Script de smoke test não encontrado: $smokeScript"
}

& $smokeScript -GatewayBaseUrl $GatewayBaseUrl
if ($LASTEXITCODE -ne 0) {
  Fail 'Smoke test falhou.'
}

Success 'Bootstrap concluído com sucesso: stack ativa + smoke test OK.'
