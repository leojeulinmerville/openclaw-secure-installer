use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::gateway::ensure_gateway_ready;
use crate::secrets::get_secret_internal;
use crate::state_manager::load_state;

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

async fn chat_ollama(request: &ChatRequest) -> Result<ChatResponse, String> {
    let endpoint = request.ollama_endpoint
        .clone()
        .unwrap_or_else(|| "http://localhost:11434".to_string());

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

#[tauri::command]
pub async fn test_ollama_connection(endpoint: Option<String>) -> Result<bool, String> {
    let endpoint = endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
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
