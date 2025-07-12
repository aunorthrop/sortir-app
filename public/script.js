async function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  alert(res.status === 200 ? 'Signed up!' : 'Signup failed');
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (res.status === 200) {
    loadFiles();
  } else {
    alert('Login failed');
  }
}

function logout() {
  window.location.href = '/logout';
}

async function upload() {
  const file = document.getElementById('file').files[0];
  const formData = new FormData();
  formData.append('file', file);
  await fetch('/upload', { method: 'POST', body: formData });
  loadFiles();
}

async function loadFiles() {
  const res = await fetch('/files');
  const files = await res.json();
  const list = document.getElementById('file-list');
  list.innerHTML = '';
  files.forEach(f => {
    const li = document.createElement('li');
    li.textContent = f;
    const btn = document.createElement('button');
    btn.textContent = '❌';
    btn.onclick = async () => {
      await fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f })
      });
      loadFiles();
    };
    li.appendChild(btn);
    list.appendChild(li);
  });
}

async function forgotPassword() {
  const email = prompt('Enter your email for reset');
  if (!email) return;
  const res = await fetch('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  alert(res.status === 200 ? 'Email sent' : 'Failed to send');
}

async function ask() {
  const q = document.getElementById('question').value;
  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q })
  });
  const answer = await res.text();
  document.getElementById('answer').textContent = answer;
}
