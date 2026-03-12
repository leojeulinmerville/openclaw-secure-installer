use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::gateway::ensure_gateway_ready;
use crate::secrets::get_secret_internal;
use crate::state_manager::{get_app_data_dir, load_state};

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,   // "user" | "assistant" | "system"
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub provider: String, // "openai" | "ollama"
    pub model: String,
    pub messages: Vec<ChatMessage>,
    /// Ollama endpoint (e.g. "http://localhost:11434")
    pub ollama_endpoint: Option<String>,
    /// Base URL for LM Studio or custom OpenAI (e.g. "http://localhost:1234/v1")
    pub api_base: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub provider: String,
    pub model: String,
    pub usage: Option<ChatUsage>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatUsage {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
}

// ── OpenAI response shape ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
    total_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModelData>,
}

#[derive(Debug, Deserialize)]
struct OpenAIModelData {
    id: String,
}

// ── Ollama response shape ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OllamaResponse {
    message: Option<OllamaMessage>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: Option<String>,
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn chat_send(app: AppHandle, request: ChatRequest) -> Result<ChatResponse, String> {
    // Gate 1: Gateway must be ready
    ensure_gateway_ready(&app)?;

    match request.provider.as_str() {
        "openai" => chat_openai(&app, &request).await,
        "ollama" => chat_ollama(&request).await,
        "lmstudio" => chat_lmstudio(&request).await,
        other => Err(format!("Unsupported provider: {}", other)),
    }
}

async fn chat_openai(app: &AppHandle, request: &ChatRequest) -> Result<ChatResponse, String> {
    // Gate 2: Internet must be enabled
    let state = load_state(app);
    if !state.allow_internet {
        return Err("Internet is disabled. Enable Allow Internet in Settings to use OpenAI.".into());
    }

    // Gate 3: API key must exist
    let api_key = get_secret_internal(app, "OPENAI_API_KEY")
        .ok_or_else(|| "No OpenAI API key found. Add it in Settings → Secrets.".to_string())?;

    // Build request body
    let messages: Vec<serde_json::Value> = request.messages.iter().map(|m| {
        serde_json::json!({
            "role": m.role,
            "content": m.content,
        })
    }).collect();

    let body = serde_json::json!({
        "model": request.model,
        "messages": messages,
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Read response failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("OpenAI API error ({}): {}", status.as_u16(), text));
    }

    let parsed: OpenAIResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Parse OpenAI response failed: {}", e))?;

    let content = parsed.choices.first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let usage = parsed.usage.map(|u| ChatUsage {
        prompt_tokens: u.prompt_tokens,
        completion_tokens: u.completion_tokens,
        total_tokens: u.total_tokens,
    });

    Ok(ChatResponse {
        message: ChatMessage {
            role: "assistant".into(),
            content,
        },
        provider: "openai".into(),
        model: request.model.clone(),
        usage,
        error: None,
    })
}

async fn chat_lmstudio(request: &ChatRequest) -> Result<ChatResponse, String> {
    let endpoint = request.api_base
        .clone()
        .unwrap_or_else(|| "http://127.0.0.1:1234/v1".to_string());

    let url = format!("{}/chat/completions", endpoint.trim_end_matches('/'));

    let messages: Vec<serde_json::Value> = request.messages.iter().map(|m| {
        serde_json::json!({
            "role": m.role,
            "content": m.content,
        })
    }).collect();

    let body = serde_json::json!({
        "model": request.model,
        "messages": messages,
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LM Studio request failed: {}. Is it running at {}?", e, endpoint))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Read response failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("LM Studio API error ({}): {}", status.as_u16(), text));
    }

    let parsed: OpenAIResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Parse LM Studio response failed: {}", e))?;

    let content = parsed.choices.first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let usage = parsed.usage.map(|u| ChatUsage {
        prompt_tokens: u.prompt_tokens,
        completion_tokens: u.completion_tokens,
        total_tokens: u.total_tokens,
    });

    Ok(ChatResponse {
        message: ChatMessage {
            role: "assistant".into(),
            content,
        },
        provider: "lmstudio".into(),
        model: request.model.clone(),
        usage,
        error: None,
    })
}

async fn chat_ollama(request: &ChatRequest) -> Result<ChatResponse, String> {
    let endpoint = request.ollama_endpoint
        .clone()
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string());

    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));

    let messages: Vec<serde_json::Value> = request.messages.iter().map(|m| {
        serde_json::json!({
            "role": m.role,
            "content": m.content,
        })
    }).collect();

    let body = serde_json::json!({
        "model": request.model,
        "messages": messages,
        "stream": false,
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}. Is Ollama running at {}?", e, endpoint))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Read response failed: {}", e))?;

    if !status.is_success() {
        return Err(format!("Ollama API error ({}): {}", status.as_u16(), text));
    }

    let parsed: OllamaResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Parse Ollama response failed: {}", e))?;

    if let Some(err) = parsed.error {
        return Err(format!("Ollama error: {}", err));
    }

    let content = parsed.message
        .and_then(|m| m.content)
        .unwrap_or_default();

    Ok(ChatResponse {
        message: ChatMessage {
            role: "assistant".into(),
            content,
        },
        provider: "ollama".into(),
        model: request.model.clone(),
        usage: None,
        error: None,
    })
}
// ── Chat Persistence ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub messages: Vec<ChatMessage>,
}

fn get_chats_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = get_app_data_dir(app)?;
    path.push("chats");
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }
    Ok(path)
}

#[tauri::command]
pub async fn list_chats(app: AppHandle) -> Result<Vec<ChatSession>, String> {
    let dir = get_chats_dir(&app)?;
    let mut sessions = Vec::new();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map_or(false, |ext| ext == "json") {
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    if let Ok(mut session) = serde_json::from_str::<ChatSession>(&content) {
                        // Empty messages list for listing to save memory
                        session.messages = vec![];
                        sessions.push(session);
                    }
                }
            }
        }
    }
    
    // Sort descending by updated_at
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sessions)
}

#[tauri::command]
pub async fn get_chat(app: AppHandle, id: String) -> Result<ChatSession, String> {
    let dir = get_chats_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read chat {}: {}", id, e))?;
        
    let session = serde_json::from_str::<ChatSession>(&content)
        .map_err(|e| format!("Failed to parse chat {}: {}", id, e))?;
        
    Ok(session)
}

#[tauri::command]
pub async fn save_chat(app: AppHandle, session: ChatSession) -> Result<(), String> {
    let dir = get_chats_dir(&app)?;
    let path = dir.join(format!("{}.json", session.id));
    
    let content = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize chat: {}", e))?;
        
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write chat to disk: {}", e))?;
        
    Ok(())
}

#[tauri::command]
pub async fn delete_chat(app: AppHandle, id: String) -> Result<(), String> {
    let dir = get_chats_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete chat file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn test_ollama_connection(endpoint: Option<String>) -> Result<bool, String> {
    let endpoint = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    match client.get(&url).send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn lmstudio_list_models(endpoint: Option<String>) -> Result<Vec<String>, String> {
    let base = endpoint.unwrap_or_else(|| "http://127.0.0.1:1234/v1".to_string());
    let url = format!("{}/models", base.trim_end_matches('/'));
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    match client.get(&url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                let text = res.text().await.unwrap_or_default();
                if let Ok(parsed) = serde_json::from_str::<OpenAIModelsResponse>(&text) {
                    Ok(parsed.data.into_iter().map(|m| m.id).collect())
                } else {
                    Err("Failed to parse LM Studio /models JSON".to_string())
                }
            } else {
                Err(format!("Status: {}", res.status()))
            }
        },
        Err(e) => Err(format!("Connection failed: {}", e))
    }
}

// ── Additional Ollama Wizard Commands ───────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModelItem {
    pub name: String,
    pub size: u64,
    pub digest: String,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelItem>,
}

#[tauri::command]
pub async fn ollama_test(endpoint: Option<String>) -> Result<String, String> {
    let endpoint = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let url = format!("{}/api/version", endpoint.trim_end_matches('/'));
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
        
    let res = client.get(&url).send().await.map_err(|e| format!("Connection failed: {}", e))?;
    let text = res.text().await.unwrap_or_default();
    Ok(text)
}

#[tauri::command]
pub async fn ollama_list_models(endpoint: Option<String>) -> Result<Vec<OllamaModelItem>, String> {
    let endpoint = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
        
    let res = client.get(&url).send().await.map_err(|e| format!("Connection failed: {}", e))?;
    if !res.status().is_success() {
        return Err(format!("Ollama error: {}", res.status()));
    }
    let parsed: OllamaTagsResponse = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    Ok(parsed.models)
}

#[tauri::command]
pub async fn ollama_pull_model(endpoint: Option<String>, model: String) -> Result<(), String> {
    let endpoint = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let url = format!("{}/api/pull", endpoint.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        // 10 minute timeout for large model downloads
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let body = serde_json::json!({
        "name": model,
        "stream": false
    });

    let res = client.post(&url).json(&body).send().await.map_err(|e| format!("Pull block failed: {}", e))?;
    
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Pull failed ({}): {}", status, text));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn ollama_run_test_completion(endpoint: Option<String>, model: String) -> Result<String, String> {
    let req = ChatRequest {
        provider: "ollama".to_string(),
        model,
        messages: vec![ChatMessage { 
            role: "user".to_string(), 
            content: "Hi. Reply with the exact word 'READY' and nothing else.".to_string() 
        }],
        ollama_endpoint: endpoint.clone(),
        api_base: None,
    };
    
    let res = chat_ollama(&req).await?;
    Ok(res.message.content)
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_message_serialization() {
        let msg = ChatMessage {
            role: "user".into(),
            content: "Hello".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("\"content\":\"Hello\""));
    }

    #[test]
    fn test_chat_response_with_usage() {
        let resp = ChatResponse {
            message: ChatMessage { role: "assistant".into(), content: "Hi".into() },
            provider: "openai".into(),
            model: "gpt-4".into(),
            usage: Some(ChatUsage {
                prompt_tokens: Some(10),
                completion_tokens: Some(5),
                total_tokens: Some(15),
            }),
            error: None,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"totalTokens\":15"));
    }

    #[test]
    fn test_chat_request_deserialization() {
        let json = r#"{"provider":"ollama","model":"llama3","messages":[{"role":"user","content":"hi"}]}"#;
        let req: ChatRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.provider, "ollama");
        assert_eq!(req.model, "llama3");
        assert_eq!(req.messages.len(), 1);
        assert!(req.ollama_endpoint.is_none());
    }

    #[test]
    fn test_openai_response_parsing() {
        let json = r#"{"choices":[{"message":{"content":"Hello!"}}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}"#;
        let parsed: OpenAIResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.choices[0].message.content, Some("Hello!".into()));
        assert_eq!(parsed.usage.unwrap().total_tokens, Some(8));
    }

    #[test]
    fn test_ollama_response_parsing() {
        let json = r#"{"message":{"content":"Hi there!"}}"#;
        let parsed: OllamaResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.message.unwrap().content, Some("Hi there!".into()));
        assert!(parsed.error.is_none());
    }

    #[test]
    fn test_ollama_response_with_error() {
        let json = r#"{"error":"model not found"}"#;
        let parsed: OllamaResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.error, Some("model not found".into()));
    }
}
