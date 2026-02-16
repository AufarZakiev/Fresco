# Start the BOINC client and the Tauri manager together for development.
# Usage: .\dev.ps1
#
# The script:
#   1. Starts boinc.exe (if not already running) pointed at the system data dir
#   2. Waits for the RPC port (31416) to become available
#   3. Launches "pnpm tauri dev"
#   4. On exit (Ctrl-C), stops the BOINC client it started

$ErrorActionPreference = "Stop"

$BoincExe = "C:\Program Files\BOINC\boinc.exe"
$BoincData = "C:\ProgramData\BOINC"
$BoincPort = 31416

# Ensure cargo is in PATH
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

$boincProcess = $null

try {
    # --- Start BOINC client if not running ---
    $running = Get-Process -Name "boinc" -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "BOINC client is already running, skipping startup."
    }
    else {
        Write-Host "Starting BOINC client..."
        $boincProcess = Start-Process -FilePath $BoincExe `
            -ArgumentList "--dir `"$BoincData`" --redirectio --daemon" `
            -PassThru -WindowStyle Hidden
        Write-Host "BOINC client started (PID $($boincProcess.Id))"

        # Wait for RPC port to be ready (up to 15 seconds)
        Write-Host -NoNewline "Waiting for RPC port $BoincPort"
        for ($i = 0; $i -lt 30; $i++) {
            try {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $tcp.Connect("127.0.0.1", $BoincPort)
                $tcp.Close()
                Write-Host " ready!"
                break
            }
            catch {
                Write-Host -NoNewline "."
                Start-Sleep -Milliseconds 500
            }
        }
    }

    # --- Start the Tauri manager ---
    Write-Host "Starting Tauri manager..."
    Set-Location $PSScriptRoot
    pnpm tauri dev
}
finally {
    Write-Host ""
    Write-Host "Shutting down..."
    if ($boincProcess -and !$boincProcess.HasExited) {
        Write-Host "Stopping BOINC client (PID $($boincProcess.Id))..."
        Stop-Process -Id $boincProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Done."
}
