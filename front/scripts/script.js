let isStreaming = false;
let currentStreamController = null;

marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Modified to scroll the current card to the bottom after updating the message.
function updateLastMessage(content, isStreaming = false) {
  const session = sessions[currentSessionIndex];
  const cursorHTML = `<span class="blinking-cursor"></span>`;
  session.messages[session.messages.length - 1].aiResponse = isStreaming ? content + cursorHTML : content;

  // Re-render the entire conversation
  renderCurrentSession();

  // Wait until the DOM updates, then highlight code blocks
  requestAnimationFrame(() => {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    // Optionally adjust scroll position here as well.
    const lastCard = document.querySelector('.card:last-child');
    if (lastCard) {
      lastCard.scrollTop = isStreaming ? lastCard.scrollHeight : lastCard.scrollTop;
    }
  });
}

// ----------------- Layout and Navigation -----------------
let isTraditionalLayout = false;
const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
const carouselWrapper = document.getElementById('carouselWrapper');
function updateLayout() {
  if (isTraditionalLayout) {
    carousel.classList.add('traditional');
    carouselWrapper.classList.add('traditional-mode');
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    toggleLayoutBtn.innerHTML = `<img src="assets/vertical.svg" alt="Icon" class="svg-icon">`;
  } else {
    carousel.classList.remove('traditional');
    carouselWrapper.classList.remove('traditional-mode');
    prevBtn.style.display = '';
    nextBtn.style.display = '';
    toggleLayoutBtn.innerHTML = `<img src="assets/horizontal.svg" alt="Icon" class="svg-icon">`;
  }
  updateTurnLabel(sessionMessagesCount());
}
toggleLayoutBtn.addEventListener('click', function () {
  isTraditionalLayout = !isTraditionalLayout;
  updateLayout();
});

// This function will move hamburger + new chat button between nav-bar and the chat header

// ----------------- Session Management -----------------
let sessions = [];
let currentSessionIndex = 0;
let currentCardIndex = 0;
function initSessions() {
  sessions.push({
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    name: "Chat Session 1",
    title: "Chat Session 1",
    messages: [],
    summary: "# Chat Summary\n\nThis is the default summary for Chat Session 1.",
    settings: {
      temperature: 0.7,
      maxTokens: 8096,
      persona: "professional",
      model: "gpt-4o-mini",
      enableSummarization: false
    }
  });
  currentSessionIndex = 0;
  currentCardIndex = 0;
  renderSessionList();
  renderCurrentSession();
}
function renderSessionList() {
  const sessionList = document.getElementById('sessionList');
  sessionList.innerHTML = "";
  sessions.forEach((session, index) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = session.name;
    li.appendChild(nameSpan);
    const removeBtn = document.createElement('button');
    removeBtn.textContent = "𝘅";
    removeBtn.className = "remove-session";
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSession(index);
    });
    li.appendChild(removeBtn);
    li.addEventListener('click', () => {
      currentSessionIndex = index;
      currentCardIndex = 0;
      renderSessionList();
      renderCurrentSession();
    });
    if (index === currentSessionIndex) li.classList.add('active');
    sessionList.appendChild(li);
  });
}
document.getElementById('newSessionBtn').addEventListener('click', () => {
  const newSession = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    name: "Chat Session " + (sessions.length + 1),
    title: "Chat Session " + (sessions.length + 1),
    messages: [],
    summary: "# Chat Summary\n\nThis is the default summary for Chat Session " + (sessions.length + 1) + ".",
    settings: {
      temperature: 0.7,
      maxTokens: 8096,
      persona: "professional",
      model: "gpt-4o-mini",
      enableSummarization: false
    }
  };

  sessions.push(newSession);
  currentSessionIndex = sessions.length - 1;
  currentCardIndex = 0;
  renderSessionList();
  renderCurrentSession();
});
function removeSession(index) {
  sessions.splice(index, 1);
  if (sessions.length === 0) {
    initSessions();
  } else {
    if (currentSessionIndex >= sessions.length) {
      currentSessionIndex = sessions.length - 1;
    }
    currentCardIndex = 0;
  }
  renderSessionList();
  renderCurrentSession();
}
// ----------------- Carousel Rendering / Traditional Layout -----------------
const carousel = document.getElementById('carousel');
function addCopyButtons() {
  document.querySelectorAll('.markdown-body pre').forEach((pre) => {
    // Avoid adding multiple copy buttons
    if (pre.querySelector('.copy-button')) return;

    // Ensure the pre element can position the button correctly
    pre.style.position = "relative";

    // Create the copy button
    const button = document.createElement("button");
    button.className = "copy-button";
    button.innerText = "Copy";

    // Append the button inside the <pre> element
    pre.appendChild(button);

    // Add click event listener for copying the code
    button.addEventListener("click", () => {
      // Get the code text from the child <code> element
      const codeText = pre.querySelector("code").innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        button.innerText = "Copied!";
        setTimeout(() => {
          button.innerText = "Copy";
        }, 2000);
      }).catch((err) => {
        console.error("Failed to copy code: ", err);
      });
    });
  });
}

function renderCurrentSession() {
  const session = sessions[currentSessionIndex];
  carousel.innerHTML = "";
  session.messages.forEach(message => {
    const card = document.createElement('div');
    card.className = 'card';
    let attachmentHTML = "";
    if (message.attachments && message.attachments.length > 0) {
      attachmentHTML = `
        <div class="vertical-file-list">
          ${message.attachments.map(file => `<div class="file-item-vertical">${file.path}</div>`).join("")}
        </div>
      `;
    }
    // Order: User message then AI message, rendered in Markdown
    card.innerHTML = `
    <div class="conversation">
      <div class="message user">
        ${attachmentHTML}
        <div class="message-text markdown-body">${marked.parse(message.userText)}</div>
      </div>
      <div class="message ai">
        <div class="message-text markdown-body">${marked.parse(message.aiResponse)}</div>
        <div class="ai-meta">
          <span class="ai-model">${message.model}</span>
          <span class="ai-timestamp"> @${formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    </div>
  `;
    carousel.appendChild(card);
    processMessagesInContainer(card);
  });
  currentCardIndex = session.messages.length > 0 ? session.messages.length - 1 : 0;
  updateCarousel();
  updateLayout();
  document.getElementById('chatTitle').textContent = session.title;

  // Re-run syntax highlighting for any new code blocks
  document.querySelectorAll('.markdown-body pre code').forEach((block) => {
    hljs.highlightElement(block);
  });

  // Add copy buttons to each code block
  addCopyButtons();
}

function updateCarousel() {
  if (!isTraditionalLayout) {
    const cards = document.querySelectorAll('.card');
    carousel.style.transform = `translateX(-${currentCardIndex * 100}%)`;
  }
  updateTurnLabel(sessionMessagesCount());
}
function sessionMessagesCount() {
  return sessions[currentSessionIndex].messages.length;
}
function updateTurnLabel(totalCards) {
  const turnLabel = document.getElementById('turnLabel');
  if (isTraditionalLayout) {
    turnLabel.textContent = `Turn: ${totalCards} / ${totalCards}`;
  } else {
    turnLabel.textContent = totalCards ? `Turn: ${currentCardIndex + 1} / ${totalCards}` : "Turn: 0 / 0";
  }
}
// ----------------- Message Processing -----------------
function processMessage(messageEl) {
  if (messageEl.dataset.processed) return;
  const textEl = messageEl.querySelector('.message-text');
  // Only add "Read more" toggle for user messages if text is long.
  if (messageEl.classList.contains('user') && textEl.scrollHeight > 80) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.textContent = 'Read more';
    toggleBtn.addEventListener('click', function () {
      if (messageEl.classList.contains('expanded')) {
        messageEl.classList.remove('expanded');
        toggleBtn.textContent = 'Read more';
      } else {
        messageEl.classList.add('expanded');
        toggleBtn.textContent = 'Read less';
      }
    });
    messageEl.appendChild(toggleBtn);
  }
  messageEl.dataset.processed = 'true';
}
function processMessagesInContainer(container) {
  container.querySelectorAll('.message').forEach(processMessage);
}
// ----------------- Adding Conversation & Stream API Call -----------------
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Get the base64 string (remove the data URL prefix)
      const base64 = reader.result.split(',')[1];
      resolve({
        name: file.name,
        path: file.webkitRelativePath || file.path || file.name,
        size: file.size,
        type: file.type,
        content: base64
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const attachedFiles = [];

async function addConversation(userText) {
  if (userText.trim() === '' && attachedFiles.length === 0) return;

  sessions[currentSessionIndex].messages.push({
    userText,
    aiResponse: "",
    attachments: await Promise.all(attachedFiles.map(fileToBase64)),
    model: sessions[currentSessionIndex].settings.model,
    timestamp: new Date().toISOString(), // Store the timestamp as ISO string 
    maxTokens: sessions[currentSessionIndex].settings.maxTokens,
    temperature: sessions[currentSessionIndex].settings.temperature,
    persona: sessions[currentSessionIndex].settings.persona,
    sessionId: sessions[currentSessionIndex].id
  });

  clearFileAttachments();
  renderCurrentSession();

  const conversation = [];
  sessions[currentSessionIndex].messages.forEach(msg => {
    conversation.push({ role: "user", content: msg.userText, attachments: msg.attachments, sessionId: msg.sessionId });
    if (msg.aiResponse) {
      conversation.push({ role: "assistant", content: msg.aiResponse, sessionId: msg.sessionId });
    }
  });

  // Set up the AbortController for streaming
  currentStreamController = new AbortController();
  isStreaming = true;
  // Change the send button icon to a stop button icon
  sendBtn.innerHTML = `<img src="assets/stop.svg" alt="Stop Icon" class="svg-icon-non-white">`;

  try {
    // Pass the abort signal to your streaming function
    const aiResponse = await callLLMStream(conversation, currentStreamController.signal);
    sessions[currentSessionIndex].messages[sessions[currentSessionIndex].messages.length - 1].aiResponse = aiResponse;
    renderCurrentSession();
    // If summarization is enabled, call it after the stream is complete
    if (sessions[currentSessionIndex].settings.enableSummarization) {
      const session = sessions[currentSessionIndex];
      await callLLMSummaryBatch(
        session.id,
        sessions[currentSessionIndex].messages,
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
      sessions[currentSessionIndex].messages[sessions[currentSessionIndex].messages.length - 1].aiResponse = "Error: " + err.message;
      renderCurrentSession();
    }
  } finally {
    // Revert the button icon to send after streaming stops/aborts
    sendBtn.innerHTML = `<img src="assets/send.svg" alt="Send Icon" class="svg-icon-non-white">`;
    isStreaming = false;
  }
}

function clearFileAttachments() {
  attachedFiles.length = 0;
  updateFileAttachments();
}
// ----------------- Auto-resize Textarea -----------------
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = this.scrollHeight + 'px';
});
function resetTextarea() {
  chatInput.style.height = '36px';
}
// ----------------- Send Message -----------------
const sendBtn = document.getElementById('sendBtn');
sendBtn.addEventListener('click', async () => {
  // If streaming is already in progress, stop it.
  if (isStreaming) {
    if (currentStreamController) {
      currentStreamController.abort();  // Abort the streaming fetch
    }
    // Remove blinking cursor from the last message:
    const session = sessions[currentSessionIndex];
    const lastIndex = session.messages.length - 1;
    const currentContent = session.messages[lastIndex].aiResponse;
    // Remove the blinking cursor element from the string if present
    const cleanedContent = currentContent.replace(`<span class="blinking-cursor"></span>`, '');
    updateLastMessage(cleanedContent, false);

    // Revert the button back to the send icon
    sendBtn.innerHTML = `<img src="assets/send.svg" alt="Send Icon" class="svg-icon-non-white">`;
    isStreaming = false;
    return;
  }

  // Otherwise, start sending the message
  const text = chatInput.value;
  if (text.trim() !== '') {
    await addConversation(text);
    chatInput.value = '';
    resetTextarea();
  }
});


chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendBtn.click();
  }
});
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
prevBtn.addEventListener('click', () => {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    updateCarousel();
  }
});
nextBtn.addEventListener('click', () => {
  const cards = document.querySelectorAll('.card');
  if (currentCardIndex < cards.length - 1) {
    currentCardIndex++;
    updateCarousel();
  }
});
// ----------------- File Attachment Handling -----------------
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const fileAttachments = document.getElementById('fileAttachments');
attachBtn.addEventListener('click', () => {
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    attachedFiles.push(file);
    // Display the file path in the console
  }
  fileInput.value = "";
  updateFileAttachments();
});

function updateFileAttachments() {
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
// ----------------- Summary Overlay -----------------
const summaryOverlay = document.getElementById('summaryOverlay');
const closeSummaryBtn = document.getElementById('closeSummaryBtn');
const summaryContent = document.getElementById('summaryContent');
const downloadSummaryBtn = document.getElementById('downloadSummary');
closeSummaryBtn.addEventListener('click', () => {
  summaryOverlay.classList.remove('active');
});
downloadSummaryBtn.addEventListener('click', () => {
  const blob = new Blob([sessions[currentSessionIndex].summary], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "summary.md";
  a.click();
  URL.revokeObjectURL(url);
});
// ----------------- Settings Overlay -----------------
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const temperatureInput = document.getElementById('temperature');
const temperatureValue = document.getElementById('temperatureValue');
const maxTokensInput = document.getElementById('maxTokens');
const personaSelect = document.getElementById('persona');
const saveSettingsBtn = document.getElementById('saveSettings');
closeSettingsBtn.addEventListener('click', () => {
  settingsOverlay.classList.remove('active');
});
temperatureInput.addEventListener('input', () => {
  temperatureValue.textContent = temperatureInput.value;
});
saveSettingsBtn.addEventListener('click', () => {
  const sessionSettings = sessions[currentSessionIndex].settings;
  sessionSettings.temperature = parseFloat(temperatureInput.value);
  sessionSettings.maxTokens = parseInt(maxTokensInput.value);
  sessionSettings.persona = personaSelect.value;
  sessionSettings.model = modelSelect.value;
  // Read the summarization toggle value
  sessionSettings.enableSummarization = document.getElementById('toggleSummarization').checked;

  console.log('Session settings saved:', sessions[currentSessionIndex].settings);
  settingsOverlay.classList.remove('active');
});

// ----------------- Title Editing -----------------
const editTitleBtn = document.getElementById('editTitleBtn');
editTitleBtn.addEventListener('click', () => {
  const currentTitle = sessions[currentSessionIndex].title;
  const newTitle = prompt("Enter new chat title:", currentTitle);
  if (newTitle !== null && newTitle.trim() !== "") {
    sessions[currentSessionIndex].title = newTitle.trim();
    document.getElementById('chatTitle').textContent = newTitle.trim();
  }
});
// ----------------- Auto-Dismiss Overlays -----------------
document.addEventListener('click', (e) => {
  if (summaryOverlay.classList.contains('active') && !summaryOverlay.contains(e.target)) {
    summaryOverlay.classList.remove('active');
  }
  if (settingsOverlay.classList.contains('active') && !settingsOverlay.contains(e.target)) {
    settingsOverlay.classList.remove('active');
  }
});
// ----------------- Global Keyboard Navigation -----------------
document.addEventListener('keydown', (e) => {
  if (document.activeElement !== chatInput) {
    if (e.key === 'ArrowLeft' && currentCardIndex > 0) {
      currentCardIndex--;
      updateCarousel();
    } else if (e.key === 'ArrowRight') {
      const cards = document.querySelectorAll('.card');
      if (currentCardIndex < cards.length - 1) {
        currentCardIndex++;
        updateCarousel();
      }
    }
  }
});
// ----------------- Hamburger Toggle -----------------
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navBar = document.getElementById('navBar');
hamburgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  navBar.classList.toggle('hidden');
  updateHamburgerPosition();
});

// ----------------- Custom Button Event Listeners -----------------
const customBtn1 = document.getElementById('customBtn1');
const customBtn2 = document.getElementById('customBtn2');

customBtn1.addEventListener('click', (e) => {
  e.stopPropagation();
  // Open the summary overlay for the current session
  document.getElementById('summaryContent').innerHTML = marked.parse(sessions[currentSessionIndex].summary);
  summaryOverlay.classList.add('active');
  settingsOverlay.classList.remove('active');
});

customBtn2.addEventListener('click', (e) => {
  e.stopPropagation();
  // Open the settings overlay for the current session and fill in the fields
  const settings = sessions[currentSessionIndex].settings;
  temperatureInput.value = settings.temperature;
  temperatureValue.textContent = settings.temperature;
  maxTokensInput.value = settings.maxTokens;
  personaSelect.value = settings.persona;
  settingsOverlay.classList.add('active');
  summaryOverlay.classList.remove('active');
});

// Get reference to the new select element
const modelSelect = document.getElementById('modelSelect');

function openSettingsForCurrentSession() {
  const settings = sessions[currentSessionIndex].settings;
  // Existing lines for temperature, maxTokens, persona...
  modelSelect.value = settings.model; // Populate the dropdown with the current model
}

// When opening the settings overlay:
customBtn2.addEventListener('click', (e) => {
  e.stopPropagation();
  // ...
  openSettingsForCurrentSession(); // load session settings into the UI
  settingsOverlay.classList.add('active');
  summaryOverlay.classList.remove('active');
});

// Saving:
saveSettingsBtn.addEventListener('click', () => {
  const sessionSettings = sessions[currentSessionIndex].settings;
  // Existing lines for temperature, maxTokens, persona...
  sessionSettings.model = modelSelect.value; // Save the selected model

  console.log('Session settings saved:', sessions[currentSessionIndex].settings);
  settingsOverlay.classList.remove('active');
});

async function callLLMStream(conversation, signal) {
  const session = sessions[currentSessionIndex];
  const { model, temperature, maxTokens } = session.settings;

  if (model.startsWith("gpt-4o")) {
    // Call OpenAI endpoint
    return callOpenAIStream(session.id, conversation, signal);
  } else if (model.startsWith("claude")) {
    // Call Anthropic endpoint
    return callAnthropicStream(session.id, conversation, signal);
  } else if (model.startsWith("gemini")) {
    // Call Google endpoint
    return callGoogleStream(session.id, conversation, signal);
  } else if (model.startsWith("huggingface")) {
    // Call Hugging Face endpoint
    return callHuggingFaceStream(session.id, conversation, model.replace("huggingface/", ""), signal);
  } else if (model.startsWith("mistral")) {
    // Call Mistral endpoint
    return callMistralStream(session.id, conversation, model, signal);
  } else {
    throw new Error("Unsupported model: " + model);
  }
}

async function callLLMSummaryBatch(sessionId, conversation, model, temperature, maxTokens) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.classList.add("active");

  let endpoint = "";
  if (model.startsWith("gpt-4o")) {
    endpoint = "http://127.0.0.1:8000/openai_summary";
  } else if (model.startsWith("claude")) {
    endpoint = "http://127.0.0.1:8000/anthropic_summary";
  } else if (model.startsWith("gemini")) {
    endpoint = "http://127.0.0.1:8000/gemini_summary";
  } else if (model.startsWith("huggingface")) {
    endpoint = "http://127.0.0.1:8000/huggingface_summary";
  } else if (model.startsWith("mistral")) {
    endpoint = "http://127.0.0.1:8000/mistral_summary";
  } else {
    throw new Error("Unsupported model for summary: " + model);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify({
      conversation: conversation,
      temperature: temperature,
      max_tokens: maxTokens,
      model: model,
    })
  });

  // Since the summary endpoint returns batch data,
  // wait for the full response text.
  const responseData = await response.json();
  const summaryText = responseData.summary;
  sessions[currentSessionIndex].summary = summaryText;

  // Optionally update the summary overlay if it is open
  const summaryOverlay = document.getElementById('summaryOverlay');
  if (summaryOverlay.classList.contains('active')) {
    document.getElementById('summaryContent').innerHTML = marked.parse(summaryText);
  }

  loadingOverlay.classList.remove("active");

  return summaryText;
}


async function callMistralStream(sessionId, conversation, signal) {
  console.log(`Calling Mistral API with model: ${model}`);
  const response = await fetch("http://127.0.0.1:8000/mistral_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify({
      conversation: conversation,
      temperature: sessions[currentSessionIndex].settings.temperature,
      max_tokens: sessions[currentSessionIndex].settings.maxTokens,
      model: sessions[currentSessionIndex].settings.model,
    }),
    signal: signal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let aiMessage = "";

  updateLastMessage(aiMessage, true);
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data:"));
    for (const line of lines) {
      const dataStr = line.replace(/^data:\s*/, "");
      if (dataStr === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices[0].delta.content;
        if (delta) {
          aiMessage += delta;
          updateLastMessage(aiMessage, true);
        }
      } catch (err) {
        console.error("Mistral stream parsing error:", err);
      }
    }
  }
  updateLastMessage(aiMessage, false);
  return aiMessage;
}


async function callOpenAIStream(sessionId, conversation, signal) {
  const response = await fetch("http://127.0.0.1:8000/openai_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
      // Remove the Authorization header since the Python backend handles the API key.
    },
    body: JSON.stringify({
      conversation: conversation,
      temperature: sessions[currentSessionIndex].settings.temperature,
      max_tokens: sessions[currentSessionIndex].settings.maxTokens,
      model: sessions[currentSessionIndex].settings.model,
    }),
    signal: signal
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let aiMessage = "";

  updateLastMessage(aiMessage, true);
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data:"));
    for (const line of lines) {
      const dataStr = line.replace(/^data:\s*/, "");
      if (dataStr === "[DONE]") {
        done = true;
        break;
      }
      try {
        // Parse the JSON returned by the Python backend.
        const parsed = JSON.parse(dataStr);
        // Assuming the payload structure is the same as OpenAI's response.
        const delta = parsed.choices[0].delta.content;
        if (delta) {
          aiMessage += delta;
          updateLastMessage(aiMessage, true);
        }
      } catch (err) {
        console.error("Stream parsing error:", err);
      }
    }
  }
  updateLastMessage(aiMessage, false);
  return aiMessage;
}


async function callAnthropicStream(sessionId, conversation, signal) {
  model = model.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '-');
  console.log(`Calling Anthropic API with model: ${model}`);

  const response = await fetch("http://127.0.0.1:8000/anthropic_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify({
      messages: conversation,
      temperature: sessions[currentSessionIndex].settings.temperature,
      max_tokens: sessions[currentSessionIndex].settings.maxTokens,
      model: sessions[currentSessionIndex].settings.model + "-latest",
    }),
    signal: signal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let aiMessage = "";

  updateLastMessage(aiMessage, true);
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data:"));

    for (const line of lines) {
      const dataStr = line.replace(/^data:\s*/, "");
      if (dataStr === "[DONE]") {
        done = true;
        break;
      }

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices[0].delta.content;
        if (delta) {
          aiMessage += delta;
          updateLastMessage(aiMessage, true);
        }
      } catch (err) {
        console.error("Anthropic stream parsing error:", err);
      }
    }
  }
  updateLastMessage(aiMessage, false);
  return aiMessage;

}

async function callGoogleStream(sessionId, conversation, signal) {
  const response = await fetch("http://127.0.0.1:8000/gemini_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify({
      messages: conversation,
      temperature: sessions[currentSessionIndex].settings.temperature,
      max_tokens: sessions[currentSessionIndex].settings.maxTokens,
      model: sessions[currentSessionIndex].settings.model.toLowerCase().replace(/\s+/g, '-')
    }),
    signal: signal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let aiMessage = "";

  updateLastMessage(aiMessage, true);
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data:"));

    for (const line of lines) {
      const dataStr = line.replace(/^data:\s*/, "");
      if (dataStr === "[DONE]") {
        done = true;
        break;
      }

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices[0].delta.content;
        if (delta) {
          aiMessage += delta;
          updateLastMessage(aiMessage, true);
        }
      } catch (err) {
        console.error("Gemini stream parsing error:", err);
      }
    }
  }
  updateLastMessage(aiMessage, false);
  return aiMessage;
}

async function callHuggingFaceStream(sessionId, conversation, signal) {
  console.log(`Calling Hugging Face API with model: ${model}`);
  const response = await fetch("http://127.0.0.1:8000/huggingface_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId
    },
    body: JSON.stringify({
      messages: conversation,
      temperature: sessions[currentSessionIndex].settings.temperature,
      max_tokens: sessions[currentSessionIndex].settings.maxTokens,
      model: sessions[currentSessionIndex].settings.model,
    }),
    signal: signal
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let done = false;
  let aiMessage = "";

  updateLastMessage(aiMessage, true);
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data:"));

    for (const line of lines) {
      const dataStr = line.replace(/^data:\s*/, "");
      if (dataStr === "[DONE]") {
        done = true;
        break;
      }

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices[0].delta.content;
        if (delta) {
          aiMessage += delta;
          updateLastMessage(aiMessage, true);
        }
      } catch (err) {
        console.error("Hugging Face stream parsing error:", err);
      }
    }
  }
  updateLastMessage(aiMessage, false);
  return aiMessage;
}

// ----------------- Initialization -----------------
initSessions();
updateHamburgerPosition();
