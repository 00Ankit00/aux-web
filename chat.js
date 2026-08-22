/* ---------------- join / presence / chat (Firebase Realtime Database) ----------------
   Anyone with the tab open counts toward "listening" (anonymous, via a random session id).
   Chat requires picking a name once — stored in sessionStorage so it sticks for the tab. */

(function () {
  const joinOverlay = document.getElementById('joinOverlay');
  const joinNameInput = document.getElementById('joinNameInput');
  const joinBtn = document.getElementById('joinBtn');
  const joinSkipBtn = document.getElementById('joinSkipBtn');
  const listenerPill = document.getElementById('listenerPill');
  const listenerCountEl = document.getElementById('listenerCount');
  const chatFab = document.getElementById('chatFab');
  const chatPanel = document.getElementById('chatPanel');
  const chatCloseBtn = document.getElementById('chatCloseBtn');
  const chatMessagesEl = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  const isConfigured = typeof firebaseConfig === 'object' && firebaseConfig && firebaseConfig.apiKey;

  if (!isConfigured) {
    // Not wired up yet — keep the rest of the site exactly as-is, just hide this feature.
    [joinOverlay, listenerPill, chatFab, chatPanel].forEach((el) => { if (el) el.style.display = 'none'; });
    console.info('Live listener count / chat isn\'t configured yet — add your Firebase config in firebase-config.js to turn it on.');
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  const sessionId = 'u_' + Math.random().toString(36).slice(2, 10);
  let myName = sessionStorage.getItem('auxName') || '';

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function setPresenceName(name) {
    const presenceRef = db.ref('presence/' + sessionId);
    presenceRef.set({ name: name || 'Listener', joinedAt: firebase.database.ServerValue.TIMESTAMP });
    presenceRef.onDisconnect().remove();
  }

  // Anyone with the tab open is "listening," named or not.
  setPresenceName(myName);

  db.ref('presence').on('value', (snap) => {
    listenerCountEl.textContent = snap.numChildren();
  });

  function showJoin() {
    joinOverlay.classList.remove('hidden');
    joinNameInput.focus();
  }
  function hideJoin() {
    joinOverlay.classList.add('hidden');
  }

  if (!myName) {
    showJoin();
  }

  function submitJoin() {
    const name = joinNameInput.value.trim().slice(0, 24);
    if (!name) { joinNameInput.focus(); return; }
    myName = name;
    sessionStorage.setItem('auxName', name);
    setPresenceName(name);
    hideJoin();
  }

  joinBtn.addEventListener('click', submitJoin);
  joinNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitJoin(); });
  joinSkipBtn.addEventListener('click', hideJoin);

  function openChat() {
    chatPanel.classList.add('open');
    chatPanel.setAttribute('aria-hidden', 'false');
    if (!myName) showJoin();
    chatInput.focus();
  }
  function closeChat() {
    chatPanel.classList.remove('open');
    chatPanel.setAttribute('aria-hidden', 'true');
  }
  chatFab.addEventListener('click', () => {
    chatPanel.classList.contains('open') ? closeChat() : openChat();
  });
  chatCloseBtn.addEventListener('click', closeChat);

  db.ref('chat').limitToLast(50).on('child_added', (snap) => {
    const msg = snap.val();
    const li = document.createElement('li');
    li.className = 'chat-msg';
    li.innerHTML = `<span class="chat-msg-name">${escapeHtml(msg.name || 'Listener')}</span><span class="chat-msg-text">${escapeHtml(msg.text || '')}</span>`;
    chatMessagesEl.appendChild(li);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim().slice(0, 240);
    if (!text) return;
    if (!myName) { showJoin(); return; }
    db.ref('chat').push({ name: myName, text, ts: firebase.database.ServerValue.TIMESTAMP });
    chatInput.value = '';
  });
})();
