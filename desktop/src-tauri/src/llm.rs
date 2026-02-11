use serde::{Deserialize, Serialize};
use serde_json::json;
use std::error::Error;

#[derive(Debug, Clone)]
pub struct LlmClient {
    pub provider: String, // "openai" | "ollama"
    pub model: String,
    pub api_base: Option<String>, // e.g. "http://localhost:11434"
    pub api_key: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Debug)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f32,
}

#[derive(Deserialize, Debug)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Deserialize, Debug)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OpenAIUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Deserialize, Debug)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub digest: String,
}

#[tauri::command]
pub async fn ollama_test(endpoint: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    // Just check version or tags to verify connectivity
    let url = format!("{}/api/version", endpoint.trim_end_matches('/'));
    
    match client.get(&url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                Ok("ok".to_string())
            } else {
                Err(format!("Ollama returned status: {}", res.status()))
            }
        },
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}

#[tauri::command]
pub async fn ollama_list_models(endpoint: String) -> Result<Vec<OllamaModel>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));
    
    match client.get(&url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                let tags: OllamaTagsResponse = res.json().await.map_err(|e| e.to_string())?;
                Ok(tags.models)
            } else {
                Err(format!("Ollama returned status: {}", res.status()))
            }
        },
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}

#[tauri::command]
pub async fn ollama_pull_model(app: tauri::AppHandle, endpoint: String, model: String) -> Result<(), String> {
    // This needs to be a long-running task that emits events
    use tauri::Emitter;
    use futures_util::StreamExt;

    let client = reqwest::Client::new();
    let url = format!("{}/api/pull", endpoint.trim_end_matches('/'));
    let body = json!({ "name": model }); // keep struct simple for now

    let res = client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
         return Err(format!("Pull failed with status: {}", res.status()));
    }

    let mut stream = res.bytes_stream();
    
    while let Some(item) = stream.next().await {
        match item {
            Ok(chunk) => {
                // Parse potential multiple JSON objects in one chunk
                let s = String::from_utf8_lossy(&chunk);
                for line in s.lines() {
                    if !line.trim().is_empty() {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                             let _ = app.emit("ollama-pull-progress", val); 
                        }
                    }
                }
            },
            Err(_) => break, // stream error
        }
    }

    Ok(())
}

impl LlmClient {
    pub fn new(provider: &str, model: &str, api_base: Option<String>, api_key: Option<String>) -> Self {
        Self {
            provider: provider.to_string(),
            model: model.to_string(),
            api_base,
            api_key,
        }
    }

    pub async fn complete(&self, system_prompt: &str, user_prompt: &str) -> Result<(String, Option<OpenAIUsage>), Box<dyn Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let messages = vec![
            OpenAIMessage { role: "system".to_string(), content: system_prompt.to_string() },
            OpenAIMessage { role: "user".to_string(), content: user_prompt.to_string() },
        ];

        if self.provider == "openai" {
            let url = "https://api.openai.com/v1/chat/completions";
            let api_key = self.api_key.as_deref().ok_or("OpenAI API key not found")?;

            let body = OpenAIRequest {
                model: self.model.clone(),
                messages,
                temperature: 0.0, // structured output requires deterministic
            };

            let res = client.post(url)
                .bearer_auth(api_key)
                .json(&body)
                .send()
                .await?;

            if !res.status().is_success() {
                 let status = res.status();
                 let err_text = res.text().await?;
                 
                 // User-friendly error mapping
                 if status == reqwest::StatusCode::UNAUTHORIZED {
                     return Err(format!("Invalid API Key. Please check your settings. Details: {}", err_text).into());
                 } else if status == reqwest::StatusCode::TOO_MANY_REQUESTS || status.as_u16() == 429 {
                      if err_text.contains("insufficient_quota") {
                           return Err("Insufficient Quota. Please add consumption credits at platform.openai.com.".into());
                      }
                      return Err("Rate Limit Exceeded. Please try again later.".into());
                 }

                 return Err(format!("OpenAI API Error ({}): {}", status, err_text).into());
            }

            let response: OpenAIResponse = res.json().await?;
            let content = response.choices.first().map(|c| c.message.content.clone()).unwrap_or_default();
            
            Ok((content, response.usage))

        } else if self.provider == "ollama" {
            let base = self.api_base.clone().unwrap_or_else(|| "http://localhost:11434".to_string());
            let url = format!("{}/api/chat", base); // Ollama chat endpoint
            
            // Ollama request format is similar but check docs
            // { "model": "llama3", "messages": [...], "stream": false }
            let body = json!({
                "model": self.model,
                "messages": messages,
                "stream": false
            });

            let res = client.post(&url)
                .json(&body)
                .send()
                .await?;
            
            if !res.status().is_success() {
                 let err_text = res.text().await?;
                 return Err(format!("Ollama API Error: {}", err_text).into());
            }

            // Ollama response structure
            #[derive(Deserialize)]
            struct OllamaIO {
                message: OpenAIMessage,
                prompt_eval_count: Option<u32>,
                eval_count: Option<u32>,
            }
            
            let response: OllamaIO = res.json().await?;
            let usage = Some(OpenAIUsage {
                prompt_tokens: response.prompt_eval_count.unwrap_or(0),
                completion_tokens: response.eval_count.unwrap_or(0),
                total_tokens: response.prompt_eval_count.unwrap_or(0) + response.eval_count.unwrap_or(0),
            });
            
            Ok((response.message.content, usage))

        } else {
            Err(format!("Unsupported provider: {}", self.provider).into())
        }
    }
}
