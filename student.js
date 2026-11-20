// First Light — Student portal (login with Student ID + password)

const ENDPOINT =
  'https://script.google.com/macros/s/AKfycbxosr3sBT3MF7hzZgjEFiACJPxyN2jKKXnRgeSyJaGdEzqDWh6lKjDbGjBk4J56suA/exec';

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (v, time) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    (time ? ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
};

// Session token kept only for this browser tab
const store = {
  get: () => { try { return sessionStorage.getItem('fl_token') || ''; } catch (e) { return ''; } },
  set: (t) => { try { sessionStorage.setItem('fl_token', t); } catch (e) {} },
  clear: () => { try { sessionStorage.removeItem('fl_token'); } catch (e) {} },
};
let token = store.get();

async function api(body) {
  const res = await fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(body) });
  return res.json();
}

function show(view) {
  $('#loginView').hidden = view !== 'login';
  $('#dashView').hidden = view !== 'dash';
  $('#loadingView').hidden = view !== 'loading';
  $('#logoutBtn').hidden = view !== 'dash';
}

/* ---------- Login ---------- */
const form = $('#loginForm');
const status = form.querySelector('.form-status');
const setStatus = (msg, type = '') => { status.textContent = msg; status.className = 'form-status' + (type ? ' ' + type : ''); };

$('#pwToggle').addEventListener('click', () => {
  const pw = $('#spw');
  const showIt = pw.type === 'password';
  pw.type = showIt ? 'text' : 'password';
  $('#pwToggle').textContent = showIt ? 'Hide' : 'Show';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#sid').value.trim().toUpperCase();
  const password = $('#spw').value.trim();
  if (!/^FL-\d{4}$/.test(id)) return setStatus('Student ID looks like FL-0001.', 'error');
  if (!password) return setStatus('Please enter your password.', 'error');

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  setStatus('Checking…');
  try {
    const r = await api({ action: 'login', id, password });
    if (!r.ok) { setStatus(r.error || 'Login failed.', 'error'); btn.disabled = false; return; }
    token = r.token;
    store.set(token);
    form.reset();
    setStatus('');
    await loadDashboard();
  } catch (err) {
    setStatus('Could not connect. Please check your internet and try again.', 'error');
  }
  btn.disabled = false;
});

/* ---------- Dashboard ---------- */
const friendlyStatus = {
  'Paid': 'Enrolled ✓',
  'Booked': 'Session booked',
  'Session done': 'Session completed ✓',
  'Contacted': 'In touch',
  'New': 'Getting started',
};

async function loadDashboard() {
  show('loading');
  try {
    const r = await api({ action: 'me', token });
    if (!r.ok) { logout(r.error); return; }
    const s = r.student;
    $('#avatar').textContent = s.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    $('#sidLabel').textContent = s.id;
    $('#hello').textContent = 'Hello, ' + s.name.split(' ')[0] + '!';
    $('#progLine').textContent = s.program + (s.sessionDate ? ' · session on ' + fmtDate(s.sessionDate) : '');
    $('#dProgram').textContent = s.program || '—';
    $('#dAge').textContent = s.age || '—';
    $('#dSession').textContent = s.sessionDate ? fmtDate(s.sessionDate) : 'We will confirm soon';
    $('#dStatus').textContent = friendlyStatus[s.status] || s.status || '—';

    $('#files').innerHTML = r.files.length
      ? r.files.map((f) => `
          <div class="sp-file">
            <div class="sp-file-ic">${esc((f.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase())}</div>
            <div class="sp-file-info"><strong>${esc(f.name)}</strong><span>${fmtDate(f.date)} · ${(f.size / 1024 / 1024).toFixed(2)} MB</span></div>
            <button class="btn btn-small btn-ghost" data-file="${esc(f.id)}">Download</button>
          </div>`).join('')
      : '<p class="sp-empty">Your reports will appear here after your session.</p>';
    document.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', () => download(b)));

    $('#messages').innerHTML = r.messages.length
      ? r.messages.map((m) => `
          <article class="sp-msg">
            <header><strong>${esc(m.type)}</strong><span>${fmtDate(m.date, true)}${m.author && m.author !== 'Both' ? ' · ' + esc(m.author) : ''}</span></header>
            <p>${esc(m.text)}</p>
          </article>`).join('')
      : '<p class="sp-empty">No messages yet. Notes and feedback from Neha and Vigneswaran will appear here.</p>';
    show('dash');
  } catch (err) {
    show('login');
    setStatus('Could not load your portal. Please try again.', 'error');
  }
}

async function download(btn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const r = await api({ action: 'file', token, fileId: btn.dataset.file });
    if (!r.ok) { if (r.expired) return logout(r.error); alert(r.error || 'Download failed.'); return; }
    const bytes = Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: r.mime || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    alert('Download failed. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function logout(message) {
  if (token) api({ action: 'logout', token }).catch(() => {});
  token = '';
  store.clear();
  show('login');
  if (message) setStatus(message, 'error');
}
$('#logoutBtn').addEventListener('click', () => logout());

/* ---------- Start ---------- */
document.getElementById('year').textContent = new Date().getFullYear();
if (token) loadDashboard();
else show('login');
