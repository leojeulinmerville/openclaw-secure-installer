use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};
use tauri::Manager;
use zip::read::ZipArchive;

pub struct PgRuntimeManager<R: Runtime> {
    app_handle: AppHandle<R>,
}

impl<R: Runtime> PgRuntimeManager<R> {
    pub fn new(app_handle: AppHandle<R>) -> Self {
        Self { app_handle }
    }

    fn get_pg_root(&self) -> PathBuf {
        self.app_handle
            .path()
            .app_data_dir()
            .unwrap()
            .join("runtime")
            .join("pgsql")
    }

    fn get_pg_data(&self) -> PathBuf {
        self.app_handle
            .path()
            .app_data_dir()
            .unwrap()
            .join("data")
            .join("pgsql")
    }

    /// Expected root prefix inside the EDB binaries-only ZIP archive.
    const ARCHIVE_ROOT_PREFIX: &'static str = "pgsql/";

    pub fn setup_runtime(&self) -> Result<(), String> {
        let pg_root = self.get_pg_root();
        let zip_path = self.app_handle
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to resolve resource directory: {}", e))?
            .join("resources")
            .join("postgresql-windows-x64.zip");

        if !pg_root.exists() {
            println!("Extracting PostgreSQL binaries...");
            fs::create_dir_all(&pg_root).map_err(|e| e.to_string())?;
            let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
            let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

            // Validate archive structure: first entry must start with the expected prefix
            if archive.len() == 0 {
                return Err("PostgreSQL archive is empty".to_string());
            }
            let first_name = archive.by_index(0)
                .map_err(|e| e.to_string())?
                .name()
                .to_string();
            if !first_name.starts_with(Self::ARCHIVE_ROOT_PREFIX) {
                return Err(format!(
                    "Unexpected archive structure: expected entries under '{}', found '{}'",
                    Self::ARCHIVE_ROOT_PREFIX, first_name
                ));
            }

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let raw_name = file.name().to_string();

                // Strip the archive root prefix (e.g. "pgsql/bin/postgres.exe" -> "bin/postgres.exe")
                let relative = match raw_name.strip_prefix(Self::ARCHIVE_ROOT_PREFIX) {
                    Some(rest) => rest,
                    None => {
                        // Entry outside expected prefix — skip with warning
                        println!("Warning: skipping unexpected archive entry: {}", raw_name);
                        continue;
                    }
                };

                // Skip the root prefix directory entry itself (empty relative path)
                if relative.is_empty() {
                    continue;
                }

                let outpath = pg_root.join(relative);

                // Ensure the output path is safely within pg_root
                if !outpath.starts_with(&pg_root) {
                    println!("Warning: skipping path traversal entry: {}", raw_name);
                    continue;
                }

                if raw_name.ends_with('/') {
                    fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p).map_err(|e| e.to_string())?;
                        }
                    }
                    let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }
            println!("PostgreSQL binaries extracted to {:?}", pg_root);

            // Validate critical binaries exist after extraction
            let critical_binaries = ["postgres.exe", "initdb.exe", "pg_ctl.exe", "pg_isready.exe"];
            for bin in &critical_binaries {
                let bin_path = pg_root.join("bin").join(bin);
                if !bin_path.exists() {
                    // Clean up partial extraction so next launch retries
                    let _ = fs::remove_dir_all(&pg_root);
                    return Err(format!(
                        "PostgreSQL extraction incomplete: {} not found at {:?}",
                        bin, bin_path
                    ));
                }
            }
            println!("PostgreSQL critical binaries validated.");
        }

        self.ensure_initialized()
    }

    fn ensure_initialized(&self) -> Result<(), String> {
        let pg_data = self.get_pg_data();
        if !pg_data.exists() {
            println!("Initializing PostgreSQL data cluster...");
            fs::create_dir_all(&pg_data).map_err(|e| e.to_string())?;
            
            let pg_root = self.get_pg_root();
            let initdb_exe = pg_root.join("bin").join("initdb.exe");

            let status = Command::new(initdb_exe)
                .arg("-D")
                .arg(&pg_data)
                .arg("-U")
                .arg("openclaw")
                .arg("--auth-local=trust")
                .arg("--encoding=UTF8")
                .stdout(Stdio::inherit())
                .stderr(Stdio::inherit())
                .status()
                .map_err(|e| format!("Failed to run initdb: {}", e))?;

            if !status.success() {
                return Err(format!("initdb failed with exit code: {:?}", status.code()));
            }
            println!("PostgreSQL cluster initialized.");
        }
        Ok(())
    }

    /// Find an available TCP port by binding to port 0.
    /// Note: small TOCTOU race between releasing the port and PG binding to it.
    /// Documented and accepted for Sprint 0 MVP.
    pub fn find_available_port(&self) -> Result<u16, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to find available port: {}", e))?;
        let port = listener.local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?
            .port();
        drop(listener); // Release the port so PostgreSQL can bind to it
        println!("Selected dynamic port: {}", port);
        Ok(port)
    }

    /// Check for stale postmaster.pid and remove it if the process is not running.
    /// Uses a conservative Windows heuristic: if the PID file exists but the process
    /// is not running, treat the lock as stale.
    pub fn handle_stale_lock(&self) -> Result<(), String> {
        let pid_file = self.get_pg_data().join("postmaster.pid");
        if !pid_file.exists() {
            return Ok(());
        }

        println!("Found existing postmaster.pid, checking if process is alive...");
        let contents = fs::read_to_string(&pid_file)
            .map_err(|e| format!("Failed to read postmaster.pid: {}", e))?;

        // First line of postmaster.pid is the PID
        if let Some(pid_str) = contents.lines().next() {
            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                // On Windows, check if the process is running via tasklist
                let output = Command::new("tasklist")
                    .arg("/FI")
                    .arg(format!("PID eq {}", pid))
                    .arg("/NH")
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null())
                    .output()
                    .map_err(|e| format!("Failed to check process status: {}", e))?;

                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.contains(&format!("{}", pid)) && stdout.contains("postgres") {
                    println!("PostgreSQL process {} is still running. Killing orphaned process...", pid);
                    let _ = Command::new("taskkill")
                        .arg("/F")
                        .arg("/PID")
                        .arg(format!("{}", pid))
                        .output();
                    
                    thread::sleep(Duration::from_millis(500));
                }
            }
        }

        // Remove postmaster.pid to ensure a clean start
        println!("Removing postmaster.pid...");
        if pid_file.exists() {
            let _ = fs::remove_file(&pid_file);
        }
        Ok(())
    }

    pub fn start_server(&self, port: u16) -> Result<(), String> {
        let pg_root = self.get_pg_root();
        let pg_data = self.get_pg_data();
        let postgres_exe = pg_root.join("bin").join("postgres.exe");

        println!("Starting PostgreSQL on port {}...", port);
        
        let mut cmd = Command::new(postgres_exe);
        cmd.arg("-D")
            .arg(&pg_data)
            .arg("-p")
            .arg(port.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.spawn().map_err(|e| format!("Failed to start postgres: {}", e))?;
        
        println!("PostgreSQL process spawned.");
        Ok(())
    }

    /// Wait for PostgreSQL to become ready using pg_isready.
    pub fn wait_for_ready(&self, port: u16, timeout_secs: u64) -> Result<(), String> {
        let pg_root = self.get_pg_root();
        let pg_isready_exe = pg_root.join("bin").join("pg_isready.exe");
        let start = Instant::now();
        let timeout = Duration::from_secs(timeout_secs);

        while start.elapsed() < timeout {
            let output = Command::new(&pg_isready_exe)
                .arg("-h")
                .arg("127.0.0.1")
                .arg("-p")
                .arg(port.to_string())
                .arg("-U")
                .arg("openclaw")
                .output();

            match output {
                Ok(out) if out.status.success() => {
                    println!("PostgreSQL is ready on port {}.", port);
                    return Ok(());
                }
                _ => {
                    thread::sleep(Duration::from_millis(500));
                }
            }
        }
        Err(format!("PostgreSQL failed to become ready within {} seconds", timeout_secs))
    }

    pub fn stop_server(&self) -> Result<(), String> {
        let pg_root = self.get_pg_root();
        let pg_data = self.get_pg_data();
        let pg_ctl_exe = pg_root.join("bin").join("pg_ctl.exe");

        println!("Stopping PostgreSQL...");
        let status = Command::new(pg_ctl_exe)
            .arg("stop")
            .arg("-D")
            .arg(&pg_data)
            .arg("-m")
            .arg("fast")
            .status()
            .map_err(|e| format!("Failed to run pg_ctl stop: {}", e))?;

        if !status.success() {
            println!("Warning: pg_ctl stop failed with exit code: {:?}", status.code());
        }
        Ok(())
    }
}
