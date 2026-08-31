# Resolucion de rutas compartida por los scripts de deploy. Se usa con dot-sourcing:
#     . "$PSScriptRoot\_comun.ps1"
#
# Copiado del mismo patron de rrhh-app/deploy/_comun.ps1 (mismo servidor, mismo mecanismo
# scp+ssh+nssm). Ver CLAUDE.md, seccion "Despliegue", para las coordenadas de esta app
# (puerto, nombre de servicio, rutas remotas) y por que se comparten venv y cuenta de
# servicio con rrhh-app en vez de crear unos propios.

$Deploy = $PSScriptRoot
$Repo   = Split-Path $Deploy -Parent

if (-not (Test-Path (Join-Path $Repo "backend\app")) -or -not (Test-Path (Join-Path $Repo "frontend\src"))) {
    Write-Host "ERROR: '$Repo' no parece la raiz del repo (falta backend\app o frontend\src)." -ForegroundColor Red
    Write-Host "       Estos scripts esperan vivir en <repo>\deploy\." -ForegroundColor Red
    exit 1
}

$Servidor = "Administrator@10.0.0.2"
