// sessions.js
import { formatTimestamp } from './utils.js';
import { updateLayout } from './navigation.js';
import { setPresets } from './presets.js';
import { determineSvgFile } from './utils.js';

export let sessions = [];
export let currentSessionIndex = 0;
export let currentCardIndex = 0;

const summarizeToggleBtn = document.getElementById('customBtn3');


// Add these functions
export function setSessions(newSessions) {
  sessions = newSessions;
}

export function setCurrentSessionIndex(newIndex) {
  currentSessionIndex = newIndex;
}

export function renderSessionListFromData(sessions) {
  const sessionList = document.getElementById('sessionList');
  sessionList.innerHTML = "";

  sessions.forEach((session, index) => {
    const li = document.createElement('li');
    li.classList.add("session-item");

    // Add "active" class if this session is currently selected.
    if (index === currentSessionIndex) {
      li.classList.add("active");
    }

    // Create a span for the session name.
    const nameSpan = document.createElement('span');
    nameSpan.textContent = session.title;
    li.appendChild(nameSpan);

    // Create the "x" button to remove the session.
    const removeBtn = document.createElement('button');
    removeBtn.className = "remove-session";
    removeBtn.textContent = "𝘅";  // or use an icon if desired
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering the li click event.
      console.log("Remove session", index);
      removeSession(index);
    });
    li.appendChild(removeBtn);

    // When the li is clicked, update the active session.
    li.addEventListener('click', () => {
      setCurrentSessionIndex(index);
      // Re-render the session list to update the active class.
      renderSessionListFromData(sessions);
      // Render the selected session's conversation.
      renderCurrentSession();
    });

    sessionList.appendChild(li);
  });

  // If no active session is set yet, select the first one.
  if (sessions.length > 0 && currentSessionIndex === undefined) {
    console.log("Setting current session index to 0");
    setCurrentSessionIndex(0);
    renderCurrentSession();
  }
}

export function renderSessionList() {
  const sessionList = document.getElementById('sessionList');
  sessionList.innerHTML = "";
  sessions.forEach((session, index) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    console.log("session.title", session.title);
    nameSpan.textContent = session.title;
    li.appendChild(nameSpan);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = "𝘅";
    removeBtn.className = "remove-session";
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log("index", index);
      removeSession(index);
    });

    li.appendChild(removeBtn);
    li.addEventListener('click', () => {
      currentSessionIndex = index;
      currentCardIndex = 0;

      renderSessionList();
      renderCurrentSession();

      const preset1 = document.getElementById('preset1');
      const preset2 = document.getElementById('preset2');

      preset1.value = sessions[currentSessionIndex].settings.modelPreset1;
      preset2.value = sessions[currentSessionIndex].settings.modelPreset2;
      console.log(preset1.value);
      console.log(preset2.value);

      preset2.classList.remove('active');
      preset1.classList.remove('active');
    });

    if (index === currentSessionIndex) li.classList.add('active');
    sessionList.appendChild(li);
  });
}

export async function removeSession(index) {
  console.log("index", index);

  // Send request to backend to remove session
  const response = await fetch('http://127.0.0.1:8000/remove_session', {
    method: 'POST',
    headers: {
      'X-Session-ID': sessions[index].id
    }
  });
  const data = await response.json();

  // Parse attachments JSON string in messages if present
  data.sessions.forEach(session => {
    session.messages.forEach(message => {
      if (message.attachments) {
        try {
          message.attachments = JSON.parse(message.attachments);
        } catch (e) {
          console.error("Error parsing attachments JSON:", e);
          message.attachments = [];
        }
      }
    });
  });

  setSessions(data.sessions.map(s => ({
    id: s.sessionId,
    name: s.name,
    title: s.title,
    messages: s.messages,
    summary: s.summary,
    settings: {
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      persona: s.persona,
      model: s.model,
      summarizingModel: s.summarizingModel,
      modelPreset1: s.modelPreset1,
      modelPreset2: s.modelPreset2,
      enableSummarization: s.enableSummarization
    }
  })));

  console.log("sessions", sessions);

  // Use the setter function for currentSessionIndex
  setCurrentSessionIndex(sessions.length - 1);
  renderSessionListFromData(sessions);
  renderCurrentSession();
}

export function renderCurrentSession() {
  const session = sessions[currentSessionIndex];
  const carousel = document.getElementById('carousel');

  setPresets(session.settings.modelPreset1, session.settings.modelPreset2);
  const preset1 = document.getElementById('preset1');
  const preset2 = document.getElementById('preset2');
  const modelSelect = document.getElementById('modelSelect');

  preset1.value = session.settings.modelPreset1;
  preset2.value = session.settings.modelPreset2;
  modelSelect.value = session.settings.model;

  document.getElementById('chatTitle').value = session.title;
  document.getElementById('summarizingModelSelect').value = session.settings.summarizingModel;  

  preset2.classList.remove('active');
  preset1.classList.remove('active');
  // preset1.classList.add('active');

  if (modelSelect.value == preset1.value) {
    preset1.classList.add('active');
  } else if (modelSelect.value == preset2.value) {
    preset2.classList.add('active');
  }

  carousel.innerHTML = "";
  session.messages.forEach(message => {
    const card = document.createElement('div');
    card.className = 'card';
    let attachmentHTML = "";
    if (message.attachments && message.attachments.length > 0) {
      console.log("message.attachments", message.attachments);
      console.log("message.attachments type:", typeof message.attachments);
      attachmentHTML = `
        <div class="vertical-file-list">
          ${message.attachments.map(file => `<div class="file-item-vertical">${file.name}</div>`).join("")}
        </div>
      `;
    }

    const svg_file = determineSvgFile(message.model);
    card.innerHTML = `
      <div class="conversation">
        <div class="message user">
          ${attachmentHTML}
          <div class="message-text markdown-body">${marked.parse(message.userText)}</div>
        </div>
        <div class="message ai">
          <div class="message-text markdown-body">${marked.parse(message.aiResponse)}</div>
          <div class="ai-meta">
            <span class="ai-model"><img src="${svg_file}" width="14" height="14" style="vertical-align: middle; margin-right: 5px;" alt="icon">${message.model}</span>
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

  // Re-highlight code blocks and add copy buttons.
  document.querySelectorAll('.markdown-body pre code').forEach((block) => {
    hljs.highlightElement(block);
  });
  addCopyButtons();

  summarizeToggleBtn.classList.toggle('active', session.settings.enableSummarization);

  // Toggle visibility of download button based on messages
  const downloadBtn = document.getElementById('customBtn4');
  if (session.messages && session.messages.length > 0) {
    downloadBtn.classList.add('active');
  } else {
    downloadBtn.classList.remove('active');
  }
}

export function updateCarousel() {
  const carousel = document.getElementById('carousel');
  if (!window.isTraditionalLayout) {
    const cards = document.querySelectorAll('.card');
    carousel.style.transform = `translateX(-${currentCardIndex * 100}%)`;
  }
  updateTurnLabel(sessionMessagesCount());
}

export function getCurrentCardIndex() {
  return currentCardIndex;
}

export function setCurrentCardIndex(newIndex) {
  currentCardIndex = newIndex;
  updateCarousel();
}

export function sessionMessagesCount() {
  return sessions[currentSessionIndex].messages.length;
}

export function updateTurnLabel(totalCards) {
  const turnLabel = document.getElementById('turnLabel');
  if (window.isTraditionalLayout) {
    turnLabel.textContent = `Turn: ${totalCards} / ${totalCards}`;
  } else {
    turnLabel.textContent = totalCards ? `Turn: ${currentCardIndex + 1} / ${totalCards}` : "Turn: 0 / 0";
  }
}

export function processMessage(messageEl) {
  if (messageEl.dataset.processed) return;
  const textEl = messageEl.querySelector('.message-text');
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

export function processMessagesInContainer(container) {
  container.querySelectorAll('.message').forEach(processMessage);
}

/**
 * Adds copy buttons to code blocks in rendered markdown.
 */
export function addCopyButtons() {
  document.querySelectorAll('.markdown-body pre').forEach((pre) => {
    if (pre.querySelector('.copy-button')) return;
    pre.style.position = "relative";
    const button = document.createElement("button");
    button.className = "copy-button";
    button.innerText = "Copy";
    pre.appendChild(button);
    button.addEventListener("click", () => {
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

document.getElementById('newSessionBtn').addEventListener('click', () => {
  const response = fetch('http://127.0.0.1:8000/add_session', {
    method: 'POST'
  });
  response.then(res => {
    if (res.status === 200) {
      return res.json();
    } else {
      console.error('Failed to create new session:', res.status);
    }
  }).then(data => {
    if (data) {
      sessions.push({
        id: data.sessionId,
        name: data.name,
        title: data.title,
        messages: [],
        summary: data.summary,
        settings: {
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          persona: data.persona,
          model: data.model,
          summarizingModel: data.summarizingModel,
          modelPreset1: data.modelPreset1,
          modelPreset2: data.modelPreset2,
          enableSummarization: data.enableSummarization
        }
      });
      currentSessionIndex = sessions.length - 1;
      currentCardIndex = 0;

      summarizeToggleBtn.classList.remove('active');

      renderSessionList();
      renderCurrentSession();
    }
  }).catch(err => {
    console.error('Error creating new session:', err);
  });
});
