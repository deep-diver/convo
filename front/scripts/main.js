// main.js
import { sessions, currentSessionIndex, renderCurrentSession, setSessions, setCurrentSessionIndex, renderSessionListFromData } from './sessions.js';
import { updateHamburgerPosition } from './navigation.js';
import { initPresets } from './presets.js';

// Import events so they register their listeners.
import './events.js';
// Import utilities to set marked options.
import './utils.js';

// Initialize sessions
// initSessions();
updateHamburgerPosition();
initPresets();

// Attach sessions-related variables to the window for global access
window.sessions = sessions;
window.currentSessionIndex = currentSessionIndex;
window.renderCurrentSession = renderCurrentSession;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('http://127.0.0.1:8000/sessions');
        const data = await response.json();
        console.log("Recovered sessions:", data.sessions);

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

        console.log("data.sessions", data.sessions);
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
    } catch (err) {
        console.error("Error loading sessions:", err);
    }
});

const preset1 = document.getElementById('preset1');
const preset2 = document.getElementById('preset2');
const tooltip = document.getElementById('tooltip');

function showTooltip(target, tooltipText) {
    const rect = target.getBoundingClientRect(); // Get accurate position
    tooltip.style.visibility = 'visible';
    tooltip.style.position = 'absolute'; // Ensure it's positioned correctly
    tooltip.style.top = `${window.scrollY + rect.top - tooltip.offsetHeight - 5}px`; // Above the element
    tooltip.style.left = `${window.scrollX + rect.left + 100}px`; // Align left with the element
    tooltip.textContent = tooltipText;
    tooltip.classList.add('visible'); // Add animation class
}

function hideTooltip() {
    tooltip.classList.remove('visible'); // Remove animation class
    tooltip.style.visibility = 'hidden';
}

preset1.addEventListener('mouseenter', () => showTooltip(preset1, "⌘ + Shift + 1"));
preset1.addEventListener('mouseleave', hideTooltip);

preset2.addEventListener('mouseenter', () => showTooltip(preset2, "⌘ + Shift + 2"));
preset2.addEventListener('mouseleave', hideTooltip);
