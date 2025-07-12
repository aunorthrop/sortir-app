document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;

  const response = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (response.ok) {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    loadDocuments();
  } else {
    document.getElementById('authError').textContent = data.error || 'Signup failed';
  }
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (response.ok) {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    loadDocuments();
  } else {
    document.getElementById('authError').textContent = data.error || 'Login failed';
  }
});

document.getElementById('forgotLink')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = prompt('Enter your email for password reset:');
  if (!email) return;

  const response = await fetch('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const data = await response.json();
  alert(response.ok ? 'Reset email sent!' : (data.error || 'Reset failed'));
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  location.reload();
});

document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert('No file selected');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  if (response.ok) {
    loadDocuments();
  } else {
    alert('Upload failed');
  }
});

document.getElementById('askForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('questionInput').value;

  const response = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  const data = await response.json();
  document.getElementById('responseContainer').textContent = data.answer || 'No response';
});

async function loadDocuments() {
  const res = await fetch('/files');
  const files = await res.json();
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';

  files.forEach(filename => {
    const li = document.createElement('li');
    li.textContent = filename;

    const del = document.createElement('button');
    del.textContent = '❌';
    del.onclick = async () => {
      await fetch(`/delete?file=${encodeURIComponent(filename)}`, { method: 'DELETE' });
      loadDocuments();
    };

    li.appendChild(del);
    fileList.appendChild(li);
  });
}
