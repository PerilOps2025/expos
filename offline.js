// ============================================================
// ExPOS — offline.js
// IndexedDB offline capture queue + auto-sync
// ============================================================

const Offline = {
  db: null,

  init: function () {
    const req = indexedDB.open('ExPOS_Offline', 1);
    req.onupgradeneeded = e =>
      e.target.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => {
      this.db = e.target.result;
      this.syncIfOnline();
      this.updateIndicator();
    };
    req.onerror = () => console.warn('[ExPOS] IndexedDB unavailable');

    window.addEventListener('online',  () => { this.syncIfOnline(); this.updateIndicator(); });
    window.addEventListener('offline', () => this.updateIndicator());
  },

  enqueue: function (transcript) {
    if (!this.db) return;
    const tx = this.db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ transcript, ts: Date.now() });
    tx.oncomplete = () => this.updateIndicator();
  },

  syncIfOnline: function () {
    if (!navigator.onLine || !this.db) return;
    const tx = this.db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.getAll().onsuccess = e => {
      const items = e.target.result;
      if (!items.length) return;
      items.forEach(item => {
        API.call('parseTranscript', { transcript: item.transcript, source: 'offline_sync' })
          .then(() => {
            const del = this.db.transaction('queue', 'readwrite');
            del.objectStore('queue').delete(item.id);
            del.oncomplete = () => {
              this.updateIndicator();
              if (typeof Pending !== 'undefined') Pending.load();
              if (typeof App !== 'undefined') App.updatePendingBadge();
            };
          })
          .catch(err => console.warn('[ExPOS] Sync failed:', err));
      });
    };
  },

  updateIndicator: function () {
    const indicator = document.getElementById('offline-indicator');
    const queueEl   = document.getElementById('queue-count');
    if (!indicator) return;

    if (!this.db) { indicator.style.display = 'none'; return; }

    const tx = this.db.transaction('queue', 'readonly');
    tx.objectStore('queue').count().onsuccess = e => {
      const count = e.target.result;
      const show  = !navigator.onLine || count > 0;
      indicator.style.display = show ? 'block' : 'none';
      if (queueEl) queueEl.textContent = count;
    };
  }
};
