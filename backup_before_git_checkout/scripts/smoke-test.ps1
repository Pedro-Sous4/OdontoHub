$ErrorActionPreference = 'Stop'

param(
  [string]$GatewayBaseUrl = 'http://localhost:3000'
)

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

$tenantSuffix = Get-Date -Format 'yyyyMMddHHmmss'
$registerBody = @{
  nomeClinica = "Clinica Smoke $tenantSuffix"
  cnpj = "9900000000$tenantSuffix"
  emailClinica = "clinica.$tenantSuffix@teste.local"
  nome = 'Admin Smoke'
  email = "admin.$tenantSuffix@teste.local"
  senha = 'SenhaForte123!'
  role = 'admin'
} | ConvertTo-Json

Step 'Healthcheck do API Gateway'
$health = Invoke-RestMethod -Method Get -Uri "$GatewayBaseUrl/health"
$health | ConvertTo-Json -Depth 5

Step 'Registro de tenant + usuário'
$register = Invoke-RestMethod -Method Post -Uri "$GatewayBaseUrl/api/auth/register" -ContentType 'application/json' -Body $registerBody
$token = $register.token
if (-not $token) {
  throw 'Falha ao obter token JWT no registro.'
}

$headers = @{ Authorization = "Bearer $token" }

Step 'Criando paciente'
$patientBody = @{
  nome = 'Paciente Smoke'
  cpf = "1234567$tenantSuffix"
  telefone = '11999999999'
  email = "paciente.$tenantSuffix@teste.local"
  dataNascimento = '1990-01-01'
} | ConvertTo-Json
$patient = Invoke-RestMethod -Method Post -Uri "$GatewayBaseUrl/api/patients" -Headers $headers -ContentType 'application/json' -Body $patientBody

Step 'Criando operadora TISS'
$providerBody = @{
  nome = 'Operadora Smoke'
  codigoAns = "ANS-$tenantSuffix"
} | ConvertTo-Json
$provider = Invoke-RestMethod -Method Post -Uri "$GatewayBaseUrl/api/tiss/providers" -Headers $headers -ContentType 'application/json' -Body $providerBody

Step 'Consultando prontuário (deve retornar vazio inicialmente)'
$records = Invoke-RestMethod -Method Get -Uri "$GatewayBaseUrl/api/prontuario/records/$($patient.id)" -Headers $headers
$records | ConvertTo-Json -Depth 6

Step 'Enfileirando notificação'
$notificationBody = @{
  channel = 'whatsapp'
  recipient = '11999999999'
  subject = 'Teste'
  body = 'Mensagem de teste smoke'
  referenceType = 'smoke'
  priority = 'normal'
} | ConvertTo-Json
$notification = Invoke-RestMethod -Method Post -Uri "$GatewayBaseUrl/api/notifications/enqueue" -Headers $headers -ContentType 'application/json' -Body $notificationBody

Step 'Listando eventos de notificação'
$events = Invoke-RestMethod -Method Get -Uri "$GatewayBaseUrl/api/notifications/events" -Headers $headers

Step 'Resumo'
[pscustomobject]@{
  TenantId = $register.tenantId
  PatientId = $patient.id
  TissProviderId = $provider.id
  NotificationEventId = $notification.id
  NotificationEventsCount = @($events).Count
} | Format-List

Write-Host "`nSmoke test concluído com sucesso." -ForegroundColor Green
