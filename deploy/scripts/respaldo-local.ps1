$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Invoke-Compose {
    & docker compose `
        --env-file .env.deploy `
        -f compose.deploy.yml `
        @args

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose fallo. Codigo: $LASTEXITCODE"
    }
}

Push-Location $raiz

$reactivar = $false

try {
    if (-not (Test-Path ".env.deploy")) {
        throw "No se encontro .env.deploy."
    }

    Invoke-Compose config --quiet

    Write-Host ""
    Write-Host "Iniciando y comprobando PostgreSQL..."

    Invoke-Compose up -d --wait --wait-timeout 120 db

    $fecha = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $destino = Join-Path $raiz "backups\$fecha"
    $uploads = Join-Path $destino "uploads"
    $temporal = "/tmp/inventario-$fecha.dump"

    New-Item -ItemType Directory -Path $uploads -Force | Out-Null

    Write-Host ""
    Write-Host "Pausando frontend y API para el respaldo..."

    $reactivar = $true
    Invoke-Compose stop -t 60 web api

    Write-Host ""
    Write-Host "Exportando la base de datos..."

    Invoke-Compose exec -T db pg_dump `
        -U inventario `
        -d inventario `
        -Fc `
        -f $temporal

    Write-Host ""
    Write-Host "Comprobando el indice de la exportacion..."

    Invoke-Compose exec -T db pg_restore --list $temporal |
        Out-File `
            -FilePath (Join-Path $destino "contenido-base.txt") `
            -Encoding utf8

    Write-Host ""
    Write-Host "Copiando la exportacion a Windows..."

    Invoke-Compose cp `
        "db:$temporal" `
        (Join-Path $destino "inventario.dump")

    $dump = Get-Item (Join-Path $destino "inventario.dump")

    if ($dump.Length -eq 0) {
        throw "La exportacion esta vacia."
    }

    Write-Host ""
    Write-Host "Copiando los archivos subidos..."

    Invoke-Compose cp `
        "api:/app/backend/uploads/." `
        $uploads

    @(
        "Respaldo completado: $(Get-Date -Format o)"
        "Base: inventario"
        "Archivo: inventario.dump"
        "Archivos subidos: uploads"
        "No incluye .env.deploy ni el modelo best.pt."
        "Pendiente: comprobar restauracion en un entorno separado."
    ) | Set-Content `
        -Path (Join-Path $destino "RESPALDO_COMPLETO.txt") `
        -Encoding utf8

    Write-Host ""
    Write-Host "RESPALDO CREADO EN:"
    Write-Host $destino
}
catch {
    Write-Host ""
    Write-Warning "El respaldo no termino correctamente."
    Write-Warning "No consideres valida una carpeta sin RESPALDO_COMPLETO.txt."
    throw
}
finally {
    try {
        if ($reactivar) {
            Write-Host ""
            Write-Host "Volviendo a iniciar API y frontend..."

            Invoke-Compose up -d --wait --wait-timeout 180 api web
        }
    }
    finally {
        Pop-Location
    }
}
