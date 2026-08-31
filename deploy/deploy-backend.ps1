param(
    # Solo para saltear el chequeo de arbol limpio a proposito (p. ej. un hotfix que se commitea
    # despues). Por defecto NO se puede desplegar codigo sin commitear.
    [switch]$PermitirArbolSucio
)

. "$PSScriptRoot\_comun.ps1"
$root = $Repo

Write-Host ">> Deploy backend - Seguimiento de Indicadores" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# Guarda de arbol limpio (copiada de rrhh-app/deploy/deploy-backend.ps1)
# ---------------------------------------------------------------------------
# `scp -r backend\app` copia el WORKING TREE, no un commit. requirements.txt entra en la
# guarda tambien porque gobierna el `uv pip install` de abajo.
$sucio = git -C $root status --porcelain -- backend/app backend/requirements.txt
if ($sucio -and -not $PermitirArbolSucio) {
    Write-Host "ERROR: hay cambios sin commitear bajo backend/app o en requirements.txt." -ForegroundColor Red
    Write-Host "       scp copia el working tree, no un commit: esto se iria a PRODUCCION." -ForegroundColor Red
    Write-Host ""
    $sucio | ForEach-Object { Write-Host "       $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "       Commitea, o corre con -PermitirArbolSucio si es a proposito." -ForegroundColor DarkGray
    exit 1
}

$rama    = (git -C $root rev-parse --abbrev-ref HEAD).Trim()
$local   = (git -C $root rev-parse HEAD).Trim()
$remoto  = (git -C $root rev-parse "origin/$rama" 2>$null)
Write-Host "-> Desplegando $rama @ $($local.Substring(0,7))" -ForegroundColor DarkGray
if ($remoto -and $local -ne $remoto.Trim()) {
    Write-Host "   AVISO: HEAD difiere de origin/$rama - lo que se despliega no esta pusheado." -ForegroundColor Yellow
}

Write-Host "-> Subiendo codigo del backend..."
scp -r "$root\backend\app" "${Servidor}:/C:/Proyectos/rrhh/apps/seguimiento/"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: scp app/ fallo" -ForegroundColor Red; exit 1 }

scp "$root\backend\requirements.txt" "${Servidor}:/C:/Proyectos/rrhh/apps/seguimiento/"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: scp requirements.txt fallo" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# Venv compartido con rrhh-app a proposito (ver CLAUDE.md, seccion "Despliegue"):
# C:\uv-envs\rrhh ya tenia exactamente las versiones de requirements.txt cuando se relevo
# el servidor (2026-08-31), asi que instalar aca es un no-op salvo que alguien suba una
# version nueva - en ese caso afecta tambien a sistema-personal y web_validador_vetados,
# que comparten el mismo venv. Si el servicio no corre este python, NO instalar ciego
# (mismo aviso que rrhh-app: nssm get web_rrhh_seguimiento Application).
$pyServicio = "C:\uv-envs\rrhh\Scripts\python.exe"

Write-Host "-> Verificando que el venv sea el del servicio..."
$appNssm = (ssh $Servidor "C:\Windows\System32\nssm.exe get web_rrhh_seguimiento Application") -replace "`0", ""
$appNssm = ($appNssm -join "").Trim()
if ($appNssm -and $appNssm -ne $pyServicio) {
    Write-Host "ERROR: nssm corre '$appNssm' pero el script instalaria en '$pyServicio'." -ForegroundColor Red
    Write-Host "       Actualiza `$pyServicio, o las dependencias se instalan donde nadie las lee." -ForegroundColor Red
    exit 1
}

Write-Host "-> Instalando dependencias en servidor (venv compartido con rrhh-app)..."
ssh $Servidor "uv pip install --python $pyServicio -r C:\Proyectos\rrhh\apps\seguimiento\requirements.txt"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: uv pip install fallo" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# Reinicio: STOP, esperar a que pare de verdad, START (no "nssm restart", ver
# rrhh-app/deploy/deploy-backend.ps1 para el porque).
# ---------------------------------------------------------------------------
Write-Host "-> Deteniendo backend..."
ssh $Servidor "sc stop web_rrhh_seguimiento" | Out-Null

$parado = $false
foreach ($i in 1..15) {
    Start-Sleep -Seconds 2
    $estado = ssh $Servidor "sc query web_rrhh_seguimiento"
    if ($estado -match "STOPPED") { $parado = $true; break }
}
if (-not $parado) {
    Write-Host "ERROR: el servicio no llego a STOPPED en 30s. Revisar a mano." -ForegroundColor Red
    exit 1
}

Write-Host "-> Arrancando backend..."
ssh $Servidor "sc start web_rrhh_seguimiento" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: sc start fallo. EL SERVICIO QUEDA DETENIDO - levantarlo a mano:" -ForegroundColor Red
    Write-Host "       ssh $Servidor `"sc start web_rrhh_seguimiento`"" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# Health check post-deploy (mismo criterio que rrhh-app: un deploy con exit 0 no prueba
# nada si nadie chequea que la API realmente responda).
# ---------------------------------------------------------------------------
Write-Host "-> Verificando /health..."
Start-Sleep -Seconds 5
$health = $null
foreach ($intento in 1..6) {
    try {
        $health = Invoke-RestMethod -Uri "https://srv.beneficioslatam.com/rrhh/seguimiento/api/health" -TimeoutSec 15
        break
    } catch {
        if ($intento -eq 6) {
            Write-Host "ERROR: /health no respondio 200 tras el deploy." -ForegroundColor Red
            Write-Host "       $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "       Log: C:\Proyectos\rrhh\apps\seguimiento\logs\stderr.log" -ForegroundColor DarkGray
            exit 1
        }
        Start-Sleep -Seconds 5
    }
}

Write-Host ""
if ($health.database -ne "conectado") {
    Write-Host "AVISO: /health responde pero database = '$($health.database)'." -ForegroundColor Yellow
    Write-Host "       Revisa la password de bex_app en el .env del servidor." -ForegroundColor Yellow
}
Write-Host "Backend desplegado. /health = $($health.status) - database $($health.database)" -ForegroundColor Green
