# OpenClaw Desktop (Tauri)

This directory contains the Tauri-based desktop application for OpenClaw.

## Prerequisites

- Node.js 18+
- pnpm
- Rust toolchain (rustc, cargo)
- Tauri CLI: `cargo install tauri-cli`

## Development

```bash
# From repo root
pnpm --filter ./desktop... install
pnpm -C desktop tauri:dev
```

## Windows Troubleshooting

### "gen folder access denied" / Failed to determine package fingerprint

If you see errors like:

```
Failed to read directory ... desktop/src-tauri/gen/schemas
Access denied (os error 5)
```

**Cause**: The `gen` folder may have incorrect permissions, often caused by running build commands with elevated privileges (admin) or Windows Defender/indexer locks.

**Solutions**:

1. **Run the repair script**:
   ```powershell
   .\scripts\fix-tauri-gen-perms.ps1
   ```

2. **Or manually fix**:
   ```powershell
   # Take ownership
   takeown /f desktop\src-tauri\gen /r /d y
   
   # Grant full control
   icacls desktop\src-tauri\gen /grant "$env:USERNAME:(OI)(CI)F" /t
   
   # Remove attributes
   attrib -r -s -h desktop\src-tauri\gen /s /d
   ```

3. **Nuclear option** - delete and let Tauri regenerate:
   ```powershell
   Remove-Item -Recurse -Force desktop\src-tauri\gen
   pnpm -C desktop tauri:dev
   ```

### Verify your toolchain

```powershell
where.exe cargo
where.exe rustc
cargo --version
rustc --version
```

## Build for Production

```bash
pnpm -C desktop tauri:build
```

Output will be in `desktop/src-tauri/target/release/bundle/`.
