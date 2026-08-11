(() => {
  if (window.VoiceInput) return;

  class VoiceInput {
    constructor(inputId = 'chat-input', btnId = 'mic-btn', lang = 'fr-FR', autoSend = true) {
      this.inputId = inputId;
      this.btnId = btnId;
      this.lang = lang;
      this.autoSend = autoSend;
      this.isListening = false;
      this.recognition = null;
      this.hasDictatedText = false;
      this.silenceTimer = null; // Timer de détection de silence

      this.init();
    }

    get input() {
      let el = document.getElementById(this.inputId);
      if (!el) el = document.getElementById('user-input') || document.getElementById('message-input');
      if (!el) el = document.querySelector('textarea') || document.querySelector('input[type="text"]');
      return el;
    }

    get btn() {
      return document.getElementById(this.btnId) || document.querySelector('.mic-btn');
    }

    get isCapacitor() {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform());
    }

    init() {
      const button = this.btn;
      if (button) {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggle();
        });
      }
    }

    async toggle() {
      this.isListening ? await this.stop(true) : await this.start();
    }

    async start() {
      const inputEl = this.input;
      if (!inputEl) return;

      this.baseText = inputEl.value ? inputEl.value.trim() : '';
      this.hasDictatedText = false;

      if (this.isCapacitor) {
        await this.startCapacitor();
      } else {
        await this.startWeb();
      }
    }

    updateInputText(transcript) {
      const el = this.input;
      if (!el) return;

      const fullText = this.baseText ? `${this.baseText} ${transcript}` : transcript;
      el.value = fullText;

      if (transcript.trim().length > 0) {
        this.hasDictatedText = true;
      }

      ['input', 'change', 'keyup'].forEach(eventName => {
        el.dispatchEvent(new Event(eventName, { bubbles: true }));
      });

      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;

      // Réinitialise le timer de silence à chaque mot prononcé
      this.resetSilenceTimer();
    }

    // Réinitialise le timer : attend 2.5 secondes de silence complet avant d'envoyer
    resetSilenceTimer() {
      if (!this.autoSend) return;
      clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => {
        if (this.isListening) {
          console.log("🎤 Fin de parole détectée (2.5s de silence). Envoi...");
          this.stop(true);
        }
      }, 2500); // 2500 ms = 2.5 secondes
    }

    triggerSend() {
      if (!this.autoSend || !this.hasDictatedText) return;

      const inputEl = this.input;
      if (!inputEl || !inputEl.value.trim()) return;

      const sendBtn = document.getElementById('send-btn') || 
                      document.getElementById('submit-btn') || 
                      document.querySelector('button[type="submit"]') ||
                      document.querySelector('.send-btn');

      if (sendBtn) {
        sendBtn.click();
      } else {
        const form = inputEl.closest('form');
        if (form) {
          form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
      }
    }

    async startCapacitor() {
      const SpeechRecognition = window.Capacitor?.Plugins?.SpeechRecognition;
      if (!SpeechRecognition) return;

      try {
        const hasPermission = await SpeechRecognition.hasPermission();
        if (!hasPermission.permission) {
          await SpeechRecognition.requestPermission();
        }

        this.isListening = true;
        if (this.btn) this.btn.classList.add('listening');

        await SpeechRecognition.addListener('partialResults', (data) => {
          if (data.matches && data.matches.length > 0) {
            this.updateInputText(data.matches[0]);
          }
        });

        await SpeechRecognition.start({
          language: this.lang,
          maxResults: 1,
          prompt: "Parlez maintenant...",
          partialResults: true,
          popup: false
        });
      } catch (err) {
        console.error("Erreur SpeechRecognition Natif:", err);
        await this.stop(false);
      }
    }

    async startWeb() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      this.recognition = new SpeechRecognition();
      this.recognition.lang = this.lang;
      this.recognition.interimResults = true;
      this.recognition.continuous = true; // Mode CONTINU activé

      this.recognition.onstart = () => {
        this.isListening = true;
        if (this.btn) this.btn.classList.add('listening');
      };

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this.updateInputText(transcript);
      };

      this.recognition.onerror = (err) => {
        console.error("Erreur Web Speech:", err);
        this.stop(false);
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Relance si déconnexion involontaire du navigateur pendant qu'on parle
          try {
            this.recognition.start();
          } catch(e) {
            this.stop(true);
          }
        }
      };

      try {
        this.recognition.start();
      } catch (err) {
        console.error(err);
        this.stop(false);
      }
    }

    async stop(shouldSend = true) {
      clearTimeout(this.silenceTimer);
      this.isListening = false;

      if (this.isCapacitor) {
        const SpeechRecognition = window.Capacitor?.Plugins?.SpeechRecognition;
        if (SpeechRecognition) {
          try {
            await SpeechRecognition.stop();
            await SpeechRecognition.removeAllListeners();
          } catch (e) {}
        }
      } else if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {}
        this.recognition = null;
      }

      if (this.btn) this.btn.classList.remove('listening');

      if (shouldSend) {
        setTimeout(() => this.triggerSend(), 300);
      }
    }
  }

  window.VoiceInput = VoiceInput;

  document.addEventListener('DOMContentLoaded', () => {
    window.voiceInput = new VoiceInput('chat-input', 'mic-btn', 'fr-FR', true);
  });
})();