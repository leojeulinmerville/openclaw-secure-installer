#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod docker_check;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![docker_check::check_docker])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
