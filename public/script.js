async function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const result = await res.json();
  document.getElementById('signup-message').textContent = result.message;
  if (result.success) window.location.reload();
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const result = await res.json();
  document.getElementById('login-message').textContent = result.message;
  if (result.success) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('ask-section').style.display = 'block';
    listFiles();
  }
}

function showReset() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('reset-section').style.display = 'block';
}

async function requestReset() {
  const email = document.getElementById('reset-email').value;
  const res = await fetch('/request-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const result = await res.json();
  document.getElementById('reset-request-message').textContent = result.message;
}

async function askSortir() {
  const question = document.getElementById('question').value;
  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
  const data = await res.json();
  document.getElementById('response').textContent = data.answer;
}

async function listFiles() {
  const res = await fetch('/files');
  const files = await res.json();
  const container = document.getElementById('fileList');
  container.innerHTML = '';
  files.forEach(file => {
    const div = document.createElement('div');
    div.textContent = file;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.onclick = async () => {
      await fetch(`/delete/${file}`, { method: 'DELETE' });
      listFiles();
    };
    div.appendChild(btn);
    container.appendChild(div);
  });
}

document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('file', document.getElementById('fileInput').files[0]);
  await fetch('/upload', { method: 'POST', body: formData });
  listFiles();
});
