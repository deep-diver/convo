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
        const models = await fetch('http://127.0.0.1:8000/list_models');
        const modelsData = await models.json();
        console.log("Models:", modelsData);

        // Clear existing options
        const preset1Select = document.getElementById('preset1');
        const preset2Select = document.getElementById('preset2');
        const modelSelect = document.getElementById('modelSelect');

        modelSelect.innerHTML = '';
        preset1Select.innerHTML = '';
        preset2Select.innerHTML = '';

        // Add options for each provider's models
        for (const [provider, models] of Object.entries(modelsData)) {
            if (models.length > 0) {
                const group1 = document.createElement('optgroup');
                const group2 = document.createElement('optgroup');
                const group3 = document.createElement('optgroup');
                group1.label = provider;
                group2.label = provider;
                group3.label = provider;

                models.forEach(model => {
                    const option1 = document.createElement('option');
                    const option2 = document.createElement('option');
                    const option3 = document.createElement('option');
                    option1.value = model.code;
                    option2.value = model.code;
                    option3.value = model.code;
                    option1.textContent = model.name;
                    option2.textContent = model.name;
                    option3.textContent = model.name;
                    group1.appendChild(option1);
                    group2.appendChild(option2);
                    group3.appendChild(option3);
                });

                preset1Select.appendChild(group1);
                preset2Select.appendChild(group2);
                modelSelect.appendChild(group3);
            }
        }
    } catch (err) {
        console.error("Error loading models:", err);
    }

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
const hamburgerBtn = document.getElementById('hamburgerBtn');
const newSessionBtn = document.getElementById('newSessionBtn');
const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');

const tooltip = document.getElementById('tooltip');

function showTooltip(target, tooltipText, top, yOffset) {
    const rect = target.getBoundingClientRect(); // Get accurate position
    tooltip.style.visibility = 'visible';
    tooltip.style.position = 'absolute'; // Ensure it's positioned correctly
    if (top) {
        tooltip.style.top = `${window.scrollY + rect.top - tooltip.offsetHeight - 5}px`; // Above the element
    } else {
        tooltip.style.top = `${window.scrollY + rect.top + rect.height + 5}px`; // Below the element
    }
    tooltip.style.left = `${window.scrollX + rect.left + yOffset}px`; // Align left with the element
    tooltip.textContent = tooltipText;
    tooltip.classList.add('visible'); // Add animation class
}

function hideTooltip() {
    tooltip.classList.remove('visible'); // Remove animation class
    tooltip.style.visibility = 'hidden';
}

preset1.addEventListener('mouseenter', () => showTooltip(preset1, "⌘ + Shift + 1", true, 50));
preset1.addEventListener('mouseleave', hideTooltip);

preset2.addEventListener('mouseenter', () => showTooltip(preset2, "⌘ + Shift + 2", true, 50));
preset2.addEventListener('mouseleave', hideTooltip);

hamburgerBtn.addEventListener('mouseenter', () => showTooltip(hamburgerBtn, "toggle collapsed sidebar", false, 100));
hamburgerBtn.addEventListener('mouseleave', hideTooltip);

newSessionBtn.addEventListener('mouseenter', () => showTooltip(newSessionBtn, "new chat", false, 50));
newSessionBtn.addEventListener('mouseleave', hideTooltip);

toggleLayoutBtn.addEventListener('mouseenter', () => showTooltip(toggleLayoutBtn, "toggle layout", false, 60));
toggleLayoutBtn.addEventListener('mouseleave', hideTooltip);
