import { renderCurrentSession, sessions, currentSessionIndex } from './sessions.js';

export function setPresets(modelPreset1, modelPreset2) {
    console.log("modelPreset1", modelPreset1);
    console.log("modelPreset2", modelPreset2);

    const preset1 = document.getElementById('preset1');
    const preset2 = document.getElementById('preset2');
    
    preset1.value = modelPreset1;
    preset2.value = modelPreset2;
}

// presets.js
export function initPresets() {
    const presetContainer = document.getElementById('presetContainer');
    if (!presetContainer) return;
  
    const preset1 = document.getElementById('preset1');
    const preset2 = document.getElementById('preset2');
    const modelSelect = document.getElementById('modelSelect');

    preset1.value = "gpt-4o-mini";
    preset2.value = "gpt-4o-mini";

    // Keyboard shortcuts: Ctrl/Cmd + Shift + 1, 2, 3
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            preset2.classList.remove('active');
            preset1.classList.add('active');
            modelSelect.value = preset1.value;
            sessions[currentSessionIndex].settings.model = preset1.value;
            break;
          case '2':
            preset1.classList.remove('active'); 
            preset2.classList.add('active');
            modelSelect.value = preset2.value;
            sessions[currentSessionIndex].settings.model = preset2.value;
            break;
        }
      }
    });

    preset1.addEventListener('change', () => {
      sessions[currentSessionIndex].settings.modelPreset1 = preset1.value;
      fetch('http://127.0.0.1:8000/update_model_preset', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessions[currentSessionIndex].id
        },
        body: JSON.stringify({
          model_preset1: preset1.value,
          model_preset2: preset2.value
        })
      }).catch(err => {
        console.error('Error updating model preset:', err);
      });
    });

    preset2.addEventListener('change', () => {
      sessions[currentSessionIndex].settings.modelPreset2 = preset2.value;
      fetch('http://127.0.0.1:8000/update_model_preset', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessions[currentSessionIndex].id
        },
        body: JSON.stringify({
          model_preset1: preset1.value,
          model_preset2: preset2.value
        })
      }).catch(err => {
        console.error('Error updating model preset:', err);
      });
    });
  }
  