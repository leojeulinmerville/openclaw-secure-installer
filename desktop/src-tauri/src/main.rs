#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod docker_check;
mod state_manager;
mod secrets;
mod gateway;
mod process;
mod agents;
mod chat;
mod runs;
mod patch;
mod channels;
mod runtime_pgsql;
mod db;

use tauri::Manager;
use crate::runtime_pgsql::PgRuntimeManager;
use crate::db::DbState;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
        let handle = app.handle().clone();

        // Deterministic bootstrap chain (Workstream B approved design):
        // 1. setup_runtime  — extract ZIP + initdb if needed
        // 2. handle_stale_lock — clean up stale postmaster.pid
        // 3. find_available_port — dynamic port selection
        // 4. start_server — spawn postgres process
        // 5. wait_for_ready — poll pg_isready
        // 6. init SQLx — connect + run migrations

        let pg_manager = PgRuntimeManager::new(handle.clone());
        
        // Step 1: Extract binaries and initialize cluster
        println!("[bootstrap] Step 1: setup_runtime");
        pg_manager.setup_runtime()
            .map_err(|e| {
                eprintln!("[bootstrap] FATAL: setup_runtime failed: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>
            })?;

        // Step 2: Handle stale locks
        println!("[bootstrap] Step 2: handle_stale_lock");
        pg_manager.handle_stale_lock()
            .map_err(|e| {
                eprintln!("[bootstrap] FATAL: handle_stale_lock failed: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>
            })?;

        // Step 3: Find available port
        println!("[bootstrap] Step 3: find_available_port");
        let port = pg_manager.find_available_port()
            .map_err(|e| {
                eprintln!("[bootstrap] FATAL: find_available_port failed: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>
            })?;

        // Step 4: Start PostgreSQL
        println!("[bootstrap] Step 4: start_server on port {}", port);
        pg_manager.start_server(port)
            .map_err(|e| {
                eprintln!("[bootstrap] FATAL: start_server failed: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>
            })?;

        // Step 5: Wait for readiness (15 second timeout)
        println!("[bootstrap] Step 5: wait_for_ready");
        pg_manager.wait_for_ready(port, 15)
            .map_err(|e| {
                eprintln!("[bootstrap] FATAL: wait_for_ready failed: {}", e);
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>
            })?;

        // Step 6: Initialize SQLx connection pool and run migrations
        println!("[bootstrap] Step 6: init_db");
        let db_url = format!("postgresql://openclaw@127.0.0.1:{}/postgres", port);
        let handle_for_db = handle.clone();
        
        tauri::async_runtime::spawn(async move {
            match db::init_db(&db_url).await {
                Ok(pool) => {
                    handle_for_db.manage(DbState { pool });
                    println!("[bootstrap] DB ready. Sprint 0 bootstrap complete.");
                },
                Err(e) => eprintln!("[bootstrap] FATAL: DB init failed: {}", e),
            }
        });

        Ok(())
    })
    .on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let handle = window.app_handle();
            let pg_manager = PgRuntimeManager::new(handle.clone());
            let _ = pg_manager.stop_server();
        }
    })
    .invoke_handler(tauri::generate_handler![
        docker_check::check_docker,
        state_manager::get_state,
        state_manager::save_state,
        state_manager::configure_installation,
        state_manager::save_gateway_image,
        state_manager::get_allow_internet,
        state_manager::set_allow_internet,
        state_manager::set_stop_agents_on_gateway_stop,
        secrets::set_secret,
        secrets::has_secret,
        secrets::delete_secret,
        gateway::start_gateway,
        gateway::stop_gateway,
        gateway::is_gateway_running,
        gateway::gateway_logs,
        gateway::test_pull_access,
        gateway::update_compose_image,
        gateway::open_app_data_folder,
        gateway::docker_smoke_test,
        gateway::check_gateway_health,
        gateway::test_gateway_ollama_access,
        gateway::test_gateway_ollama_access,
        gateway::build_local_image,
        gateway::get_gateway_status,
        gateway::get_console_info,
        gateway::open_console_window,
        gateway::get_runtime_capabilities,
        gateway::connections_get_schema,
        gateway::connections_get_status,
        gateway::connections_configure,
        gateway::connections_test,
        // Agent lifecycle
        agents::create_agent,
        agents::list_agents,
        agents::start_agent,
        agents::stop_agent,
        agents::restart_agent,
        agents::remove_agent,
        agents::agent_logs,
        agents::agent_stats,
        agents::agent_inspect_health,
        agents::agent_set_network,
        agents::quarantine_agent,
        agents::unquarantine_agent,
        agents::check_agent_crashloop,
        agents::get_agent_detail,
        // Chat / LLM
        chat::chat_send,
        chat::test_ollama_connection,
        chat::lmstudio_list_models,
        chat::list_chats,
        chat::get_chat,
        chat::save_chat,
        chat::delete_chat,
        // Runs
        runs::create_run,
        runs::list_runs,
        runs::get_run,
        runs::get_run_events,
        runs::start_run,
        runs::submit_approval,
        runs::read_workspace_file,
        runs::delete_run,
        // Channels
        channels::whatsapp_login_start,
        channels::whatsapp_login_wait,
        channels::whatsapp_logout,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
