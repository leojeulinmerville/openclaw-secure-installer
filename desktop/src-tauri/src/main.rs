#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod docker_check;
mod state_manager;
mod secrets;
mod gateway;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
        docker_check::check_docker,
        state_manager::get_state,
        state_manager::save_state,
        state_manager::configure_installation,
        secrets::set_secret,
        secrets::has_secret,
        gateway::start_gateway,
        gateway::stop_gateway,
        gateway::is_gateway_running,
        gateway::gateway_logs,
        gateway::test_pull_access,
        gateway::update_compose_image,
        gateway::open_app_data_folder,
        gateway::docker_smoke_test
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
