// Signup function
async function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const errorDiv = document.getElementById('signup-error');

  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (res.ok) {
    alert('Signup successful. Check your email.');
    window.location.href = '/dashboard.html';
  } else {
    errorDiv.textContent = data.error || 'Signup failed';
  }
}

// Login function
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (res.ok) {
    window.location.href = '/dashboard.html';
  } else {
    errorDiv.textContent = data.error || 'Login failed';
  }
}

// Logout function
async function logout() {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/';
}

// Handle document upload
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      fileInput.value = '';
      loadFiles(); // refresh file list
    } else {
      alert('Upload failed');
    }
  });

  // Load uploaded file list
  async function loadFiles() {
    const res = await fetch('/files');
    const files = await res.json();
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';

    files.forEach(file => {
      const li = document.createElement('li');
      li.textContent = file;
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.onclick = async () => {
        await fetch(`/delete/${file}`, { method: 'DELETE' });
        loadFiles();
      };
      li.appendChild(delBtn);
      fileList.appendChild(li);
    });
  }

  loadFiles();
}

// Ask Sortir
async function askSortir() {
  const question = document.getElementById('ask-input').value;
  const answerArea = document.getElementById('answer-area');

  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  const data = await res.json();

  if (res.ok) {
    answerArea.textContent = data.answer;
  } else {
    answerArea.textContent = data.error || 'Something went wrong.';
  }
}
