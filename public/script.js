document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const res = await fetch('/signup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    location.reload();
  } else {
    document.getElementById('signup-error').textContent = data.message;
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch('/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('file-section').style.display = 'block';
    listFiles();
  } else {
    document.getElementById('login-error').textContent = data.message;
  }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('fileInput');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  await fetch('/upload', { method: 'POST', body: formData });
  listFiles();
});

document.getElementById('ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('question').value;
  const res = await fetch('/ask', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ question })
  });
  const data = await res.json();
  document.getElementById('response').textContent = data.answer;
});

async function listFiles() {
  const res = await fetch('/files');
  const files = await res.json();
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  files.forEach(file => {
    const div = document.createElement('div');
    div.textContent = file;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.onclick = async () => {
      await fetch('/delete/' + file, { method: 'DELETE' });
      listFiles();
    };
    div.appendChild(btn);
    list.appendChild(div);
  });
}

function logout() {
  fetch('/logout').then(() => location.reload());
}

window.onload = async () => {
  const res = await fetch('/check-session');
  const data = await res.json();
  if (data.loggedIn) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('file-section').style.display = 'block';
    listFiles();
  }
};
