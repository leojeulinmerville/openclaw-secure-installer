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
                 let err_text = res.text().await?;
                 return Err(format!("OpenAI API Error: {}", err_text).into());
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
            struct OllamaResponse {
                message: OpenAIMessage,
                // usage fields in ollama are: prompt_eval_count, eval_count
                prompt_eval_count: Option<u32>,
                eval_count: Option<u32>,
            }
            
            let response: OllamaResponse = res.json().await?;
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
