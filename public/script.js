document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const forgotForm = document.getElementById('forgot-form');
  const resetForm = document.getElementById('reset-form');
  const uploadForm = document.getElementById('upload-form');
  const fileList = document.getElementById('file-list');
  const askForm = document.getElementById('ask-form');
  const answerDiv = document.getElementById('answer');
  const errorMsg = document.getElementById('error-msg');

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signupForm.email.value;
      const password = signupForm.password.value;

      const res = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = '/dashboard';
      } else {
        errorMsg.textContent = data.message || 'Signup failed';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value;
      const password = loginForm.password.value;

      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = '/dashboard';
      } else {
        errorMsg.textContent = data.message || 'Login failed';
      }
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = forgotForm.email.value;

      const res = await fetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      errorMsg.textContent = data.success
        ? 'Reset email sent'
        : data.message || 'Error sending reset email';
    });
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const params = new URLSearchParams(window.location.search);
      const email = params.get('email');
      const token = params.get('token');
      const password = resetForm.password.value;

      const res = await fetch('/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password })
      });

      const data = await res.json();
      errorMsg.textContent = data.success
        ? 'Password reset successful'
        : data.message || 'Reset failed';
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(uploadForm);

      const res = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        loadFiles();
      } else {
        alert('Upload failed');
      }
    });
  }

  async function loadFiles() {
    if (!fileList) return;

    const res = await fetch('/files');
    const files = await res.json();
    fileList.innerHTML = '';

    files.forEach((file) => {
      const li = document.createElement('li');
      li.textContent = file;

      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.onclick = async () => {
        await fetch('/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file })
        });
        loadFiles();
      };

      li.appendChild(btn);
      fileList.appendChild(li);
    });
  }

  if (askForm) {
    askForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = askForm.question.value;

      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      const data = await res.json();
      answerDiv.textContent = data.answer || 'Error retrieving answer';
    });
  }

  if (fileList) {
    loadFiles();
  }
});
