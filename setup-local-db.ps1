$ErrorActionPreference = 'Stop'
$psql = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin\psql.exe'
if (!(Test-Path -LiteralPath $psql)) { throw "PostgreSQL 18 psql was not found at $psql" }
$adminSecure = Read-Host 'Enter the postgres administrator password (input is hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecure)
try { $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$randomBytes = New-Object byte[] 36
$rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
$rng.GetBytes($randomBytes)
$rng.Dispose()
$appPassword = [Convert]::ToBase64String($randomBytes)
$env:PGPASSWORD = $adminPassword
try {
  $env:PGCLIENTENCODING = 'UTF8'
  & $psql -X -A -t -h localhost -U postgres -d postgres -c 'SELECT current_user'
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL rejected the login or local connection. Check the postgres password and confirm the service is running.' }
  $setupSql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reading_room_app') THEN
    CREATE ROLE reading_room_app LOGIN PASSWORD '$appPassword';
  ELSE
    ALTER ROLE reading_room_app WITH LOGIN PASSWORD '$appPassword';
  END IF;
END `$`$;
"@
  & $psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres -c $setupSql
  if ($LASTEXITCODE -ne 0) { throw 'The login worked, but creating the library database role failed. Check the PostgreSQL output above.' }
  $dbExists = & $psql -X -A -t -h localhost -U postgres -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'reading_room'"
  if ($LASTEXITCODE -ne 0) { throw 'Could not check whether the library database exists.' }
  if (!$dbExists) {
    & (Join-Path (Split-Path -Parent $psql) 'createdb.exe') -h localhost -U postgres -O reading_room_app reading_room
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the reading_room database.' }
  }
  $env:PGPASSWORD = $appPassword
  $projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  & $psql -X -v ON_ERROR_STOP=1 -h localhost -U reading_room_app -d reading_room -f (Join-Path $projectRoot 'database/schema.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Database schema setup failed.' }
  & $psql -X -v ON_ERROR_STOP=1 -h localhost -U reading_room_app -d reading_room -f (Join-Path $projectRoot 'database/seed.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Sample catalog setup failed.' }
  $env:PGPASSWORD = $null
  $encodedPassword = [Uri]::EscapeDataString($appPassword)
  "DATABASE_URL=postgresql://reading_room_app:$encodedPassword@localhost:5432/reading_room`nPORT=3000`n" | Set-Content -LiteralPath (Join-Path $projectRoot '.env') -Encoding ascii
  Write-Host 'Library PostgreSQL database, schema, and sample catalog are ready. Local .env was created.' -ForegroundColor Green
} finally {
  $env:PGPASSWORD = $null
  $adminPassword = $null
  $appPassword = $null
}
