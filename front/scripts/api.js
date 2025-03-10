// api.js
import { updateLastMessage } from './utils.js';
import { sessions, currentSessionIndex } from './sessions.js';

/**
 * Chooses the correct API function based on the model setting.
 */
export async function callLLMStream(conversation, signal) {
  const session = sessions[currentSessionIndex];
  const { model, temperature, maxTokens } = session.settings;

  if (model.startsWith("gpt-4o")) {
    return callOpenAIStream(session, conversation, model, temperature, maxTokens, signal);
  } else if (model.startsWith("claude")) {
    return callAnthropicStream(session, conversation, model, temperature, maxTokens, signal);
  } else if (model.startsWith("gemini")) {
    return callGoogleStream(session, conversation, model, temperature, maxTokens, signal);
  } else if (model.startsWith("huggingface")) {
    return callHuggingFaceStream(session, conversation, model, temperature, maxTokens, signal);
  } else if (model.startsWith("mistral")) {
    return callMistralStream(session, conversation, model, temperature, maxTokens, signal);
  } else if (model.startsWith("upstage")) {
    return callUpstageStream(session, conversation, model, temperature, maxTokens, signal);
  } else {
    throw new Error("Unsupported model: " + model);
  }
}

/**
 * Process streaming response from LLM APIs
 */
async function processStream(reader, decoder, session, errorPrefix = "Stream") {
  let done = false;
  let aiMessage = "";
  let buffer = "";
  
  updateLastMessage(session, aiMessage, true);
  
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    
    // Decode the chunk and append it to the buffer
    buffer += decoder.decode(value, { stream: true });
    
    // Process the buffer based on newline delimiters
    const parts = buffer.split("\n\n");
    // Keep the last part in buffer as it might be incomplete
    buffer = parts.pop();
    
    // Process complete parts
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith("data:")) continue;
      
      const dataStr = trimmed.substring(5).trim(); // Remove "data:" prefix
      if (dataStr === "[DONE]") {
        done = true;
        break;
      }
      
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices[0].delta.content;
        if (delta) {
          aiMessage += delta;
          updateLastMessage(session, aiMessage, true);
        }
      } catch (err) {
        console.error(`${errorPrefix} parsing error:`, err, "Chunk:", dataStr);
      }
    }
  }
  
  // Process any remaining buffered data
  if (buffer.trim()) {
    try {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.substring(5).trim();
        if (dataStr !== "[DONE]") {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices[0].delta.content;
          if (delta) {
            aiMessage += delta;
            updateLastMessage(session, aiMessage, true);
          }
        }
      }
    } catch (err) {
      console.error(`Final buffer parsing error:`, err, "Buffer:", buffer);
    }
  }
  
  updateLastMessage(session, aiMessage, false);
  return aiMessage;
}

/**
 * Helper function to create API request options
 */
function createRequestOptions(session, payload, signal) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": session.id,
    },
    body: JSON.stringify(payload),
    signal: signal,
  };
}

export async function callOpenAIStream(session, conversation, model, temperature, maxTokens, signal) {
  const response = await fetch("http://127.0.0.1:8000/openai_stream", 
    createRequestOptions(session, {
      conversation: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    }, signal)
  );
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return processStream(reader, decoder, session, "OpenAI stream");
}

export async function callAnthropicStream(session, conversation, model, temperature, maxTokens, signal) {
  console.log(`Calling Anthropic API with model: ${model}`);
  
  const response = await fetch("http://127.0.0.1:8000/anthropic_stream", 
    createRequestOptions(session, {
      messages: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    }, signal)
  );
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return processStream(reader, decoder, session, "Anthropic stream");
}

export async function callGoogleStream(session, conversation, model, temperature, maxTokens, signal) {
  model = model.toLowerCase().replace(/\s+/g, '-');
  console.log(`Calling Google (Gemini) API with model: ${model}`);
  
  const response = await fetch("http://127.0.0.1:8000/gemini_stream", 
    createRequestOptions(session, {
      messages: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    }, signal)
  );
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return processStream(reader, decoder, session, "Gemini stream");
}

export async function callHuggingFaceStream(session, conversation, model, temperature, maxTokens, signal) {
  console.log(`Calling Hugging Face API with model: ${model}`);
  
  const response = await fetch("http://127.0.0.1:8000/huggingface_stream", 
    createRequestOptions(session, {
      messages: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    }, signal)
  );
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return processStream(reader, decoder, session, "Hugging Face stream");
}

export async function callMistralStream(session, conversation, model, temperature, maxTokens, signal) {
  console.log(`Calling Mistral API with model: ${model}`);
  
  const response = await fetch("http://127.0.0.1:8000/mistral_stream", 
    createRequestOptions(session, {
      conversation: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    }, signal)
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return processStream(reader, decoder, session, "Mistral stream");
}

export async function callUpstageStream(session, conversation, model, temperature, maxTokens, signal) {
  console.log(`Calling Upstage API with model: ${model}`);
  
  const response = await fetch("http://127.0.0.1:8000/upstage_stream", 
    createRequestOptions(session, { 
      conversation: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    }, signal)
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return processStream(reader, decoder, session, "Upstage stream");
}



/**
 * Makes a batch request to generate a summary of the conversation
 */
export async function callLLMSummaryBatch(sessionId, conversation, model, temperature, maxTokens) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingOverlayText = document.getElementById("loadingOverlayText");
  loadingOverlay.classList.add("active");
  loadingOverlayText.innerHTML = "Generating summary by " + model + "...";

  // Determine the appropriate endpoint based on the model
  const modelToEndpoint = {
    "gpt-4o": "openai_summary",
    "claude": "anthropic_summary",
    "gemini": "gemini_summary",
    "huggingface": "huggingface_summary",
    "mistral": "mistral_summary"
  };
  
  // Find the matching prefix
  const modelPrefix = Object.keys(modelToEndpoint).find(prefix => model.startsWith(prefix));
  if (!modelPrefix) {
    throw new Error("Unsupported model for summary: " + model);
  }
  
  const endpoint = `http://127.0.0.1:8000/${modelToEndpoint[modelPrefix]}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-ID": sessionId,
      },
      body: JSON.stringify({
        conversation: conversation,
        temperature: temperature,
        max_tokens: maxTokens,
        model: model,
      }),
    });

    const responseData = await response.json();
    const summaryText = responseData.summary;
    sessions[currentSessionIndex].summary = summaryText;

    const summaryOverlay = document.getElementById('summaryOverlay');
    if (summaryOverlay.classList.contains('active')) {
      document.getElementById('summaryContent').innerHTML = marked.parse(summaryText);
    }
    
    return summaryText;
  } finally {
    loadingOverlay.classList.remove("active");
  }
}
