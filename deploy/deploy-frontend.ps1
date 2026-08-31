. "$PSScriptRoot\_comun.ps1"
$root = $Repo

Write-Host ">> Deploy frontend - Seguimiento de Indicadores" -ForegroundColor Cyan

$volver = Get-Location
$Web = "C:\Proyectos\rrhh\web\seguimiento"

Write-Host "-> Construyendo frontend..."
Set-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: build fallo" -ForegroundColor Red; Set-Location $volver; exit 1 }

# Swap por directorio temporal con timestamp, no "dist_new" fijo (mismo motivo que
# rrhh-app/deploy/deploy-frontend.ps1: un scp cortado a mitad deja bloqueos y un destino
# ya existente hace que `scp -r` anide en vez de reemplazar).
$Sello = Get-Date -Format "yyyyMMdd-HHmmss"
$Tmp   = "dist_up_$Sello"

Write-Host "-> Subiendo nueva version a $Tmp..."
scp -o ConnectTimeout=30 -r ".\dist" "${Servidor}:/C:/Proyectos/rrhh/web/seguimiento/$Tmp"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: scp fallo - la app SIGUE ARRIBA con la version anterior" -ForegroundColor Red
    Write-Host "       La red a este servidor es intermitente: reintentar suele alcanzar." -ForegroundColor Yellow
    ssh $Servidor "if exist $Web\$Tmp rmdir /s /q $Web\$Tmp" 2>$null
    Set-Location $volver
    exit 1
}

Write-Host "-> Verificando que el bundle subio completo y sin anidar..."
$chequeo = ssh $Servidor "if exist $Web\$Tmp\index.html (echo INDEX_OK) else (echo INDEX_FALTA) & if exist $Web\$Tmp\dist (echo ANIDADO) else (echo PLANO)"
if ($chequeo -notmatch "INDEX_OK" -or $chequeo -match "ANIDADO") {
    Write-Host "ERROR: el temporal no quedo bien ($chequeo) - NO se hace el swap" -ForegroundColor Red
    Write-Host "       La app sigue sirviendo la version anterior." -ForegroundColor Yellow
    Set-Location $volver
    exit 1
}

$Backup = "dist_prev_$Sello"
Write-Host "-> Swap: dist -> $Backup, $Tmp -> dist..."
ssh $Servidor "cd $Web & ren dist $Backup & ren $Tmp dist"
$post = ssh $Servidor "if exist $Web\dist\index.html (echo SWAP_OK) else (echo SWAP_ROTO)"
if ($post -notmatch "SWAP_OK") {
    Write-Host "ERROR: el swap dejo 'dist' sin index.html - RESTAURANDO..." -ForegroundColor Red
    ssh $Servidor "cd $Web & if exist dist ren dist dist_malo_$Sello & ren $Backup dist"
    Set-Location $volver
    exit 1
}

Set-Location $volver

Write-Host ""
Write-Host "Frontend desplegado." -ForegroundColor Green
Write-Host "   https://srv.beneficioslatam.com/rrhh/seguimiento/"
Write-Host "   Rollback: cd $Web & ren dist dist_malo & ren $Backup dist" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   Verificar: grepear un string de la feature en el bundle servido, con no-cache." -ForegroundColor DarkGray
Write-Host "   Los dist_prev_* y dist_up_* viejos se pueden borrar a mano cuando sobren." -ForegroundColor DarkGray
