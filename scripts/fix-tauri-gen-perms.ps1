# Fix Tauri gen folder permissions on Windows
# Run this script if you encounter "Access denied" errors on desktop/src-tauri/gen

$genPath = Join-Path $PSScriptRoot "..\desktop\src-tauri\gen"

if (Test-Path $genPath) {
    Write-Host "Fixing permissions on $genPath..."
    
    # Take ownership
    takeown /f $genPath /r /d y 2>$null
    
    # Grant full control to current user
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    icacls $genPath /grant "${currentUser}:(OI)(CI)F" /t /q
    
    # Remove readonly/system/hidden attributes
    attrib -r -s -h $genPath /s /d
    
    Write-Host "Permissions fixed. You can also delete the folder to force regeneration:"
    Write-Host "  Remove-Item -Recurse -Force '$genPath'"
}
else {
    Write-Host "gen folder not found at $genPath - nothing to fix"
}
