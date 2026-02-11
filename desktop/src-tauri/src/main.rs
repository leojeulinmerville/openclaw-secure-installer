#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod docker_check;
mod state_manager;
mod secrets;
mod gateway;
mod agents;
mod chat;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
        docker_check::check_docker,
        state_manager::get_state,
        state_manager::save_state,
        state_manager::configure_installation,
        state_manager::save_gateway_image,
        state_manager::get_allow_internet,
        state_manager::set_allow_internet,
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
        gateway::build_local_image,
        gateway::get_gateway_status,
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
        // Chat
        chat::chat_send,
        chat::test_ollama_connection,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
