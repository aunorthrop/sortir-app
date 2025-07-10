async function login(email, password) {
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.ok;
}

async function signup(email, password) {
  const res = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.ok;
}

async function logout() {
  await fetch('/logout', { method: 'POST' });
  location.reload();
}

function showApp() {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
  fetchFiles();
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (await login(email, password)) showApp();
  else alert("Login failed");
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  if (await signup(email, password)) alert("Signed up! You can now log in.");
  else alert("Signup failed");
});

document.getElementById("logoutBtn").addEventListener("click", logout);

async function fetchFiles() {
  const res = await fetch("/files");
  const files = await res.json();
  displayFiles(files);
}

function displayFiles(files) {
  const list = document.getElementById("fileListContainer");
  list.innerHTML = "";
  files.forEach(file => {
    const div = document.createElement("div");
    div.className = "file-item";

    const span = document.createElement("span");
    span.className = "file-name-display";
    span.textContent = file;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-button";
    delBtn.textContent = "Delete";
    delBtn.onclick = () => deleteFile(file);

    div.appendChild(span);
    div.appendChild(delBtn);
    list.appendChild(div);
  });
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files.length) return alert("Select a file");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const res = await fetch("/upload", { method: "POST", body: formData });
  const result = await res.json();
  if (result.success) {
    fileInput.value = "";
    fetchFiles();
  } else alert(result.error || "Upload failed");
});

async function deleteFile(name) {
  await fetch(`/delete/${name}`, { method: "DELETE" });
  fetchFiles();
}

document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value;
  if (!question) return;

  document.getElementById("loadingIndicator").style.display = "inline";

  const res = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  const data = await res.json();
  document.getElementById("answerBox").textContent = data.answer || data.error || "No response.";
  document.getElementById("loadingIndicator").style.display = "none";
});

window.onload = async () => {
  const res = await fetch("/check");
  if (res.ok) showApp();
};
