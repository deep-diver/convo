// events_helper.js
import { updateLastMessage, autoResizeTextarea } from './utils.js';
import { renderCurrentSession, sessions, currentSessionIndex } from './sessions.js';
import { callLLMStream, callLLMSummaryBatch } from './api.js';

export let attachedFiles = [];

/**
 * Convert a file to its Base64 string.
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({
        name: file.name,
        path: file.webkitRelativePath || file.path || file.name,
        size: file.size,
        type: file.type,
        content: base64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Update the file attachments UI.
 */
export function updateFileAttachments() {
  const fileAttachments = document.getElementById('fileAttachments');
  fileAttachments.innerHTML = "";
  attachedFiles.forEach((file, index) => {
    const fileDiv = document.createElement("div");
    fileDiv.className = "file-item";
    fileDiv.innerHTML = `<span>${file.name}</span> <button data-index="${index}">&times;</button>`;
    fileAttachments.appendChild(fileDiv);
  });
  document.querySelectorAll(".file-item button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = e.target.getAttribute("data-index");
      attachedFiles.splice(idx, 1);
      updateFileAttachments();
    });
  });
}

/**
 * Add a new conversation message and stream the AI response.
 */
export async function addConversation(userText) {
  if (userText.trim() === '' && attachedFiles.length === 0) return;
  const session = sessions[currentSessionIndex];
  session.messages.push({
    userText,
    aiResponse: "",
    attachments: await Promise.all(attachedFiles.map(fileToBase64)),
    model: session.settings.model,
    timestamp: new Date().toISOString(),
    maxTokens: session.settings.maxTokens,
    temperature: session.settings.temperature,
    persona: session.settings.persona,
    sessionId: session.id,
  });
  
  // Clear attachments
  attachedFiles.length = 0;
  updateFileAttachments();
  renderCurrentSession();
  
  // Build conversation context for API
  const conversation = [];
  session.messages.forEach(msg => {
    conversation.push({ role: "user", content: msg.userText, attachments: msg.attachments, sessionId: msg.sessionId });
    if (msg.aiResponse) {
      conversation.push({ role: "assistant", content: msg.aiResponse, sessionId: msg.sessionId, model: msg.model, temperature: msg.temperature, max_tokens: msg.maxTokens, timestamp: msg.timestamp });
    }
  });
  
  window.currentStreamController = new AbortController();
  window.isStreaming = true;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.innerHTML = `<img src="assets/stop.svg" alt="Stop Icon" class="svg-icon-non-white">`;
  
  try {
    const aiResponse = await callLLMStream(conversation, window.currentStreamController.signal);
    session.messages[session.messages.length - 1].aiResponse = aiResponse;
    renderCurrentSession();
    if (session.settings.enableSummarization) {
      await callLLMSummaryBatch(
        session.id,
        session.messages,
        session.settings.model,
        session.settings.temperature,
        session.settings.maxTokens
      );
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Streaming aborted by user.');
    } else {
      console.error(err);
      session.messages[session.messages.length - 1].aiResponse = "Error: " + err.message;
      renderCurrentSession();
    }
  } finally {
    sendBtn.innerHTML = `<img src="assets/send.svg" alt="Send Icon" class="svg-icon-non-white">`;
    window.isStreaming = false;
  }
}
