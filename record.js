// ============================================================
// ExPOS — record.js
// Direct SpeechRecognition — no iframe restriction on GitHub Pages
// ============================================================

const Record = {
  recognition: null,
  isRecording:  false,
  transcript:   '',
  draftKey:     'expos_draft_transcript',

  init: function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this._setStatus('⚠️ Use Chrome or Edge for voice recording.');
      document.getElementById('record-btn').disabled = true;
      return;
    }

    this.recognition = new SR();
    this.recognition.continuous     = true;
    this.recognition.interimResults = true;
    this.recognition.lang           = 'en-IN';

    this.recognition.onresult = e => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        e.results[i].isFinal
          ? final   += e.results[i][0].transcript
          : interim += e.results[i][0].transcript;
      }
      this.transcript += final;
      document.getElementById('transcript-box').innerHTML =
        `<span class="transcript-final">${this.transcript}</span>` +
        `<span class="transcript-interim"> ${interim}</span>`;
      localStorage.setItem(this.draftKey, this.transcript);
    };

    this.recognition.onerror = e => {
      Toast.show('Mic error: ' + e.error, 'error');
      this._stop();
    };

    // Keep alive while recording
    this.recognition.onend = () => {
      if (this.isRecording) this.recognition.start();
    };

    // Restore any unsent draft
    const draft = localStorage.getItem(this.draftKey);
    if (draft && draft.trim()) {
      this.transcript = draft;
      document.getElementById('transcript-box').textContent = draft;
      document.getElementById('send-btn').style.display = 'inline-flex';
    }
  },

  toggle: function () {
    this.isRecording ? this._stop() : this._start();
  },

  _start: function () {
    if (!this.recognition) { Toast.show('Voice not available — use Chrome', 'error'); return; }
    this.transcript = '';
    document.getElementById('transcript-box').innerHTML =
      '<span class="transcript-interim">Listening...</span>';
    this.recognition.start();
    this.isRecording = true;

    const btn = document.getElementById('record-btn');
    btn.classList.add('recording');
    document.getElementById('record-icon').className = 'bi bi-stop-fill';
    this._setStatus('🔴 Recording...');
    document.getElementById('send-btn').style.display = 'none';
  },

  _stop: function () {
    if (!this.recognition) return;
    this.isRecording = false;
    this.recognition.stop();

    const btn = document.getElementById('record-btn');
    btn.classList.remove('recording');
    document.getElementById('record-icon').className = 'bi bi-mic-fill';
    this._setStatus('');

    if (this.transcript.trim()) {
      document.getElementById('send-btn').style.display = 'inline-flex';
      this.send();
    }
  },

  send: function () {
    const text = this.transcript.trim();
    if (!text) return;

    if (!navigator.onLine) {
      Offline.enqueue(text);
      Toast.show('Offline — transcript queued for sync', 'info');
      this.reset();
      return;
    }

    this._showProcessing();
    this._setStep(1);
    setTimeout(() => this._setStep(2), 400);

    API.call('parseTranscript', { transcript: text, source: 'voice' })
      .then(result => {
        this._setStep(3);
        setTimeout(() => this._setStep(4), 300);
        setTimeout(() => {
          const count = result.inboxIDs ? result.inboxIDs.length : 0;
          this._setStep(5, count);
          this.reset();
          Pending.load();
          App.updatePendingBadge();
          setTimeout(() => {
            document.getElementById('processing-card').style.display = 'none';
          }, 2500);
        }, 400);
      })
      .catch(err => {
        document.getElementById('processing-card').style.display = 'none';
        Toast.show('AI error: ' + err.message, 'error', 7000);
      });
  },

  sendManual: function () { this.send(); },

  reset: function () {
    this.transcript = '';
    localStorage.removeItem(this.draftKey);
    document.getElementById('transcript-box').innerHTML =
      '<span class="placeholder-text">Your transcript will appear here...</span>';
    document.getElementById('send-btn').style.display = 'none';
    this._setStatus('');
  },

  _setStatus: function (msg) {
    const el = document.getElementById('record-status');
    if (el) el.textContent = msg;
  },

  _showProcessing: function () {
    document.getElementById('processing-card').style.display = 'block';
    const steps = [
      ['Transcribing', '1'],
      ['Sending to AI', '2'],
      ['Parsing', '3'],
      ['Saving to Pending Room', '4'],
      ['Ready!', '5']
    ];
    document.getElementById('processing-steps').innerHTML = steps
      .map(([label, n]) =>
        `<div class="processing-step step-wait" id="step-${n}">
          <span class="step-icon" id="step-icon-${n}">○</span>${label}
        </div>`)
      .join('');
  },

  _setStep: function (n, count) {
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById('step-' + i);
      const ic = document.getElementById('step-icon-' + i);
      if (!el) continue;
      if (i < n) {
        el.className = 'processing-step step-done';
        ic.textContent = '✅';
      } else if (i === n) {
        el.className = 'processing-step step-active';
        ic.innerHTML  = i === 5 ? '✅' : '<span class="spinner-sm"></span>';
        if (i === 5 && count !== undefined)
          el.insertAdjacentHTML('beforeend',
            ` <strong>${count} item${count !== 1 ? 's' : ''} ready in Pending Room</strong>`);
      } else {
        el.className = 'processing-step step-wait';
        ic.textContent = '○';
      }
    }
  }
};
