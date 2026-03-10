use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use crate::gateway::call_gateway_connections_api;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppLoginStartOpts {
    pub account_id: Option<String>,
    pub force: bool,
    pub timeout_ms: Option<u32>,
    pub verbose: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsAppLoginWaitOpts {
    pub account_id: Option<String>,
    pub timeout_ms: Option<u32>,
}

#[tauri::command]
pub async fn whatsapp_login_start(app: AppHandle, opts: WhatsAppLoginStartOpts) -> Result<serde_json::Value, String> {
    let params = serde_json::json!({
        "accountId": opts.account_id,
        "force": opts.force,
        "timeoutMs": opts.timeout_ms,
        "verbose": opts.verbose
    });
    call_gateway_connections_api(&app, reqwest::Method::POST, "/api/v1/web.login.start", Some(&params)).await
}

#[tauri::command]
pub async fn whatsapp_login_wait(app: AppHandle, opts: WhatsAppLoginWaitOpts) -> Result<serde_json::Value, String> {
    let params = serde_json::json!({
        "accountId": opts.account_id,
        "timeoutMs": opts.timeout_ms
    });
    call_gateway_connections_api(&app, reqwest::Method::POST, "/api/v1/web.login.wait", Some(&params)).await
}

#[tauri::command]
pub async fn whatsapp_logout(app: AppHandle, account_id: Option<String>) -> Result<serde_json::Value, String> {
    let params = serde_json::json!({
        "channel": "whatsapp",
        "account": account_id
    });
    // Assuming channels.logout method exists in gateway coreGatewayHandlers as "channels.logout"
    // Wait, I saw "channels.logout" mentioned in authorizeGatewayMethod in server-methods.ts
    // Let's verify where it is defined.
    call_gateway_connections_api(&app, reqwest::Method::POST, "/api/v1/channels.logout", Some(&params)).await
}
