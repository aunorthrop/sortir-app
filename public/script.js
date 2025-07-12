async function signup() {
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (res.ok) {
    location.reload();
  } else {
    alert(await res.text());
  }
}

async function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (res.ok) {
    location.href = '/vault.html';
  } else {
    document.getElementById('login-error').innerText = 'Incorrect email or password.';
  }
}

async function forgotPassword() {
  const email = document.getElementById("login-email").value;
  if (!email) return alert("Enter your email above first.");
  const res = await fetch('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (res.ok) {
    alert("Reset link sent.");
  } else {
    alert(await res.text());
  }
}
