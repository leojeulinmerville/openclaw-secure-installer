# PostgreSQL Runtime Bundle — Provisioning

## Required File

`postgresql-windows-x64.zip` must be placed in this directory before building or running the Tauri application.

**This file is excluded from git** (see `.gitignore`).

## How to Obtain

1. Go to <https://www.enterprisedb.com/download-postgresql-binaries>
2. Download **PostgreSQL 16.x — Windows x64 — Binaries** (ZIP format)
3. Rename the downloaded file to `postgresql-windows-x64.zip`
4. Place it in this directory (`desktop/src-tauri/resources/`)

### Direct download (PostgreSQL 16.8)

```
https://get.enterprisedb.com/postgresql/postgresql-16.8-1-windows-x64-binaries.zip
```

## Expected ZIP Structure

The ZIP must contain a `pgsql/` root directory with at minimum:

```
pgsql/
├── bin/
│   ├── postgres.exe    (required)
│   ├── initdb.exe      (required)
│   ├── pg_ctl.exe      (required)
│   ├── pg_isready.exe  (required)
│   └── *.dll           (runtime dependencies)
├── lib/
└── share/
```

## Size

Expected size: ~290 MB (full binaries distribution).

## Version Compatibility

- **Tested**: PostgreSQL 16.8-1
- **Recommended**: Any PostgreSQL 16.x release
- **Architecture**: Windows x64 only (MVP constraint)
