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
