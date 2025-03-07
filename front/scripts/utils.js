// utils.js

// Set marked options (for syntax highlighting)
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

/**
 * Format an ISO timestamp to a friendly date + time string.
 */
export function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Updates the last message in the current session.
 * If isStreaming is true, a blinking cursor is appended.
 */
export function updateLastMessage(session, content, isStreaming = false) {
  // Update the last message in the specified session.
  session.messages[session.messages.length - 1].aiResponse =
    isStreaming ? content + `<span class="blinking-cursor"></span>` : content;

  renderCurrentSession();

  // Wait until the DOM updates, then re-highlight code blocks and adjust scroll.
  requestAnimationFrame(() => {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    const lastCard = document.querySelector('.card:last-child');
    if (lastCard) {
      lastCard.scrollTop = isStreaming ? lastCard.scrollHeight : lastCard.scrollTop;
    }
  });
}

/**
 * Auto-resize a textarea based on its content.
 */
export function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function check_mistral_model(model) {
  if (model == 'mistral-large-latest' || 
      model == 'mistral-codestral-latest' || 
      model == 'mistral-ministral-8b-latest' || 
      model == 'mistral-ministral-3b-latest') {
    return true;
  }
  return false;
}

function check_openai_model(model) {
  if (model == 'gpt-4o' || 
      model == 'gpt-4o-mini') {
    return true;
  }
  return false;
}

function check_anthropic_model(model) {
  if (model == 'claude-3.5-sonnet-latest' || 
      model == 'claude-3.7-sonnet-latest') {
    return true;
  }
  return false;
}

function check_google_model(model) {
  if (model == 'gemini-2.0-flash' || 
      model == 'gemini-2.0-flash-lite') {
    return true;
  }
  return false;
}

function check_deepseek_model(model) {
  if (model == 'huggingface/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B') {
    return true;
  }
  return false;
}

function check_qwen_model(model) {
  if (model == 'huggingface/Qwen/Qwen2.5-72B-Instruct') {
    return true;
  }
  return false;
}

function check_llama_model(model) {
  if (model == 'huggingface/meta-llama/Llama-3.3-70B-Instruct') {
    return true;
  }
  return false;
}

export function determineSvgFile(model) {
  if (check_mistral_model(model)) {
    return 'assets/mistral.svg';
  }
  else if (check_openai_model(model)) {
    return 'assets/openai.svg';
  }
  else if (check_anthropic_model(model)) {
    return 'assets/anthropic.svg';
  }
  else if (check_google_model(model)) {
    return 'assets/google.svg';
  }
  else if (check_deepseek_model(model)) {
    return 'assets/deepseek.svg';
  }
  else if (check_qwen_model(model)) {
    return 'assets/qwen.svg';
  }
  else if (check_llama_model(model)) {
    return 'assets/meta.svg';
  }
  return 'assets/mistral.svg';
}
