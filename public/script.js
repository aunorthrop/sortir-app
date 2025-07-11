async function checkSession() {
  const res = await fetch('/check-session');
  const data = await res.json();
  if (data.loggedIn) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    listFiles();
  }
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.success) {
    location.reload();
  } else {
    document.getElementById('signup-error').textContent = data.message || "Signup failed.";
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.success) {
    location.reload();
  } else {
    document.getElementById('login-error').textContent = data.message || "Login failed.";
  }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('fileInput');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  listFiles();
});

document.getElementById('ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('questionInput').value;
  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  const data = await res.json();
  document.getElementById('response').textContent = data.answer || 'No answer.';
});

async function listFiles() {
  const res = await fetch('/files');
  const files = await res.json();
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';

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
    fileList.appendChild(div);
  });
}

checkSession();
