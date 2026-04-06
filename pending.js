// ============================================================
// ExPOS — pending.js
// Pending Room — editable cards, bulk actions, draft saving
// ============================================================

const Pending = {
  items:        [],
  drafts:       {},
  feedbackTarget: null,
  draftKey:     'expos_pending_drafts',

  load: function () {
    this._loadDrafts();
    API.call('getInboxItems')
      .then(items => {
        this.items = items || [];
        this.render();
        App.updatePendingBadge();
      })
      .catch(err => Toast.show('Failed to load pending items: ' + err.message, 'error'));
  },

  _loadDrafts: function () {
    try { this.drafts = JSON.parse(localStorage.getItem(this.draftKey) || '{}'); }
    catch (e) { this.drafts = {}; }
  },

  _saveDrafts: function () {
    localStorage.setItem(this.draftKey, JSON.stringify(this.drafts));
  },

  saveDraft: function (id, field, value) {
    if (!this.drafts[id]) this.drafts[id] = {};
    this.drafts[id][field] = value;
    this._saveDrafts();
  },

  _getField: function (item, field) {
    const id = item.InboxID;
    return (this.drafts[id] && this.drafts[id][field] !== undefined)
      ? this.drafts[id][field]
      : item[field];
  },

  _activeItems: function () {
    return this.items.filter(i => i.Status === 'Pending');
  },

  render: function () {
    const container = document.getElementById('pending-items');
    const empty     = document.getElementById('pending-empty');
    const label     = document.getElementById('pending-count-label');
    const active    = this._activeItems();

    label.textContent = active.length;

    if (!active.length) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    container.innerHTML = active.map(item => this._renderCard(item)).join('');
  },

  _renderCard: function (item) {
    const id       = item.InboxID;
    const type     = this._getField(item, 'Type')         || 'Task';
    const priority = this._getField(item, 'Priority')     || 'Med';
    const text     = this._getField(item, 'ParsedText')   || '';
    const person   = this._getField(item, 'Person')       || '';
    const team     = this._getField(item, 'Team')         || '';
    const project  = this._getField(item, 'ProjectTag')   || '';
    const dueDate  = this._getField(item, 'DueDate')      || '';
    const dueTime  = this._getField(item, 'DueTime')      || '';
    const isMC     = this._getField(item, 'IsMeetingContext');
    const isNew    = item.PersonIsNew    === 'TRUE' || item.PersonIsNew    === true;
    const isCol    = item.PersonCollision=== 'TRUE' || item.PersonCollision=== true;
    const teamNew  = item.TeamIsNew      === 'TRUE' || item.TeamIsNew      === true;

    const badgeClass  = type === 'Decision' ? 'badge-decision'
                      : type === 'CalendarEvent' ? 'badge-calendar'
                      : 'badge-task';
    const typeLabel   = type === 'CalendarEvent' ? 'Calendar Event' : type;
    const prioEmoji   = priority === 'High' ? '🔴' : priority === 'Med' ? '🟡' : '🟢';
    const mcChecked   = (isMC === 'TRUE' || isMC === true) ? 'checked' : '';

    const alerts = [
      isNew ? `<div class="entity-alert">
        ⚠️ New person detected: <strong>${this._esc(person)}</strong>
        <div class="mt-2 d-flex gap-2 flex-wrap">
          <button class="btn-entity-yes" onclick="Pending.confirmNewPerson('${id}','${this._esc(person)}')">✓ Add as member</button>
          <button class="btn-entity-no"  onclick="Pending.markAsProject('${id}','${this._esc(person)}')">↳ It's a project</button>
        </div></div>` : '',
      isCol ? `<div class="entity-alert">
        ⚠️ Name collision: <strong>${this._esc(person)}</strong> matches multiple people — resolve below.</div>` : '',
      teamNew ? `<div class="entity-alert">
        🏢 New team: <strong>${this._esc(team)}</strong> — will be added to registry on confirm.</div>` : ''
    ].filter(Boolean).join('');

    return `<div class="inbox-card priority-${priority}" id="card-${id}">

      <div class="card-header-row">
        <div class="d-flex gap-2 align-items-center">
          <span class="type-badge ${badgeClass}">${typeLabel}</span>
          <span class="inbox-id-label">${id}</span>
        </div>
        <div class="feedback-row">
          <button class="feedback-btn" id="up-${id}"  onclick="Pending.thumbs('${id}','up')"   title="Looks good">👍</button>
          <button class="feedback-btn" id="dn-${id}"  onclick="Pending.thumbs('${id}','down')" title="Something wrong">👎</button>
        </div>
      </div>

      ${alerts}

      <div class="field-group">
        <div class="field-label">Task / Description</div>
        <textarea class="field-input" rows="2"
          onchange="Pending.saveDraft('${id}','ParsedText',this.value)">${this._esc(text)}</textarea>
      </div>

      <div class="row g-2 mb-2">
        <div class="col-6">
          <div class="field-label">Person(s)</div>
          <input class="field-input" value="${this._esc(person)}"
            placeholder="Names, comma separated"
            onchange="Pending.saveDraft('${id}','Person',this.value)">
        </div>
        <div class="col-6">
          <div class="field-label">Team</div>
          <input class="field-input" value="${this._esc(team)}"
            placeholder="e.g. Procurement team"
            onchange="Pending.saveDraft('${id}','Team',this.value)">
        </div>
      </div>

      <div class="row g-2 mb-2">
        <div class="col-6">
          <div class="field-label">Project Tag</div>
          <input class="field-input" value="${this._esc(project)}"
            placeholder="e.g. Finance app"
            onchange="Pending.saveDraft('${id}','ProjectTag',this.value)">
        </div>
        <div class="col-6">
          <div class="field-label">Type</div>
          <select class="field-input"
            onchange="Pending.saveDraft('${id}','Type',this.value)">
            <option ${type==='Task'          ?'selected':''}>Task</option>
            <option ${type==='Decision'      ?'selected':''}>Decision</option>
            <option value="CalendarEvent" ${type==='CalendarEvent'?'selected':''}>Calendar Event</option>
          </select>
        </div>
      </div>

      <div class="row g-2 mb-2">
        <div class="col-6">
          <div class="field-label">Due Date</div>
          <input type="date" class="field-input" value="${dueDate}"
            onchange="Pending.saveDraft('${id}','DueDate',this.value)">
        </div>
        <div class="col-6">
          <div class="field-label">Due Time</div>
          <input type="time" class="field-input" value="${dueTime}"
            onchange="Pending.saveDraft('${id}','DueTime',this.value)">
        </div>
      </div>

      <div class="field-group">
        <div class="field-label">Priority</div>
        <div class="priority-row">
          ${['High','Med','Low'].map(p =>
            `<button class="priority-btn ${priority===p ? 'active-'+p : ''}"
              onclick="Pending.setPriority('${id}','${p}',this)">
              ${p==='High'?'🔴':p==='Med'?'🟡':'🟢'} ${p}
            </button>`).join('')}
        </div>
      </div>

      <div class="field-group">
        <label class="toggle-label">
          <input type="checkbox" class="toggle-check" ${mcChecked}
            onchange="Pending.saveDraft('${id}','IsMeetingContext',this.checked)">
          <span class="toggle-track"></span>
          Meeting Context
        </label>
      </div>

      <div class="card-actions">
        <button class="btn-discard" onclick="Pending.discard('${id}')">✗ Discard</button>
        <button class="btn-confirm" id="confirm-${id}" onclick="Pending.confirm('${id}')">✓ Confirm</button>
      </div>
    </div>`;
  },

  _esc: function (str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  setPriority: function (id, priority, btn) {
    this.saveDraft(id, 'Priority', priority);
    const card = document.getElementById('card-' + id);
    card.className = `inbox-card priority-${priority}`;
    card.querySelectorAll('.priority-btn').forEach(b => {
      b.className = 'priority-btn';
      ['High','Med','Low'].forEach(p => { if (b.textContent.includes(p) && p === priority) b.classList.add('active-' + p); });
    });
  },

  thumbs: function (id, dir) {
    document.getElementById('up-' + id).className = 'feedback-btn' + (dir==='up'   ? ' selected-up'   : '');
    document.getElementById('dn-' + id).className = 'feedback-btn' + (dir==='down' ? ' selected-down' : '');
    this.saveDraft(id, 'GeminiFeedback', dir);
    if (dir === 'down') {
      this.feedbackTarget = id;
      new bootstrap.Modal(document.getElementById('feedbackModal')).show();
    } else {
      API.call('saveFeedback', { inboxID: id, feedback: 'up' }).catch(() => {});
    }
  },

  submitFeedback: function () {
    const type    = document.getElementById('feedback-type').value;
    const correct = document.getElementById('feedback-correct').value;
    const id      = this.feedbackTarget;
    const item    = this.items.find(i => i.InboxID === id);
    API.call('saveFeedback', {
      inboxID:    id,
      feedback:   'down',
      transcript: item ? item.RawFragment : '',
      wrong:      type,
      correct
    }).then(() => Toast.show('Feedback saved — AI will improve 🧠', 'success'))
      .catch(() => {});
    bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
  },

  confirmNewPerson: function (id, name) {
    this.saveDraft(id, 'PersonIsNew', false);
    API.call('updateEntityRegistry', { people: [{ name, email: '', team: '', aliases: [] }] })
      .then(() => Toast.show(name + ' added to registry', 'success'))
      .catch(() => {});
    this.render();
  },

  markAsProject: function (id, name) {
    this.saveDraft(id, 'PersonIsNew', false);
    this.saveDraft(id, 'Person', '');
    this.saveDraft(id, 'ProjectTag', name);
    this.render();
  },

  confirm: function (id) {
    const item = this.items.find(i => i.InboxID === id);
    if (!item) return;
    const merged = { ...item, ...(this.drafts[id] || {}) };

    const btn = document.getElementById('confirm-' + id);
    btn.innerHTML = '<span class="spinner-sm"></span>';
    btn.disabled  = true;

    API.call('confirmInboxItem', { inboxID: id, data: merged })
      .then(() => {
        document.getElementById('card-' + id).remove();
        this.items = this.items.filter(i => i.InboxID !== id);
        delete this.drafts[id];
        this._saveDrafts();
        App.updatePendingBadge();
        this._updateCountLabel();
        if (!this._activeItems().length)
          document.getElementById('pending-empty').style.display = 'block';
        Toast.show('Item confirmed ✓', 'success');
      })
      .catch(err => {
        btn.innerHTML = '✓ Confirm';
        btn.disabled  = false;
        Toast.show('Error: ' + err.message, 'error');
      });
  },

  discard: function (id) {
    API.call('discardInboxItem', id)
      .then(() => {
        document.getElementById('card-' + id).remove();
        this.items = this.items.filter(i => i.InboxID !== id);
        delete this.drafts[id];
        this._saveDrafts();
        App.updatePendingBadge();
        this._updateCountLabel();
        if (!this._activeItems().length)
          document.getElementById('pending-empty').style.display = 'block';
        Toast.show('Item discarded', 'info');
      })
      .catch(err => Toast.show('Error: ' + err.message, 'error'));
  },

  _updateCountLabel: function () {
    const count = this._activeItems().length;
    document.getElementById('pending-count-label').textContent = count;
  },

  confirmAll: function () {
    const active = this._activeItems();
    if (!active.length) return;
    if (!confirm(`Confirm all ${active.length} items?`)) return;
    Promise.all(active.map(item => {
      const merged = { ...item, ...(this.drafts[item.InboxID] || {}) };
      return API.call('confirmInboxItem', { inboxID: item.InboxID, data: merged });
    }))
    .then(() => {
      this.drafts = {};
      this._saveDrafts();
      this.load();
      Toast.show('All items confirmed ✓', 'success');
    })
    .catch(err => Toast.show('Error: ' + err.message, 'error'));
  },

  discardAll: function () {
    const active = this._activeItems();
    if (!active.length) return;
    if (!confirm(`Discard all ${active.length} items?`)) return;
    Promise.all(active.map(item => API.call('discardInboxItem', item.InboxID)))
    .then(() => { this.load(); Toast.show('All items discarded', 'info'); })
    .catch(err => Toast.show('Error: ' + err.message, 'error'));
  }
};
