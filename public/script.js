document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const uploadForm = document.getElementById("upload-form");
  const askForm = document.getElementById("ask-form");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("file-list");
  const questionInput = document.getElementById("questionInput");
  const responseOutput = document.getElementById("responseOutput");
  const logoutButton = document.getElementById("logout-button");
  const authSection = document.getElementById("auth-section");
  const appSection = document.getElementById("app-section");

  async function checkSession() {
    const res = await fetch("/check-session");
    const data = await res.json();
    if (data.loggedIn) {
      showApp();
      listFiles();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    authSection.style.display = "block";
    appSection.style.display = "none";
  }

  function showApp() {
    authSection.style.display = "none";
    appSection.style.display = "block";
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      showApp();
      listFiles();
    } else {
      alert(data.error || "Signup failed");
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      showApp();
      listFiles();
    } else {
      alert(data.error || "Login failed");
    }
  });

  logoutButton.addEventListener("click", async () => {
    await fetch("/logout", { method: "POST" });
    location.reload();
  });

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });
    if (res.ok) listFiles();
    else alert("Upload failed");
  });

  askForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = questionInput.value;
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    responseOutput.textContent = data.answer || "No answer found.";
  });

  async function listFiles() {
    const res = await fetch("/files");
    const files = await res.json();
    fileList.innerHTML = "";
    files.forEach(file => {
      const div = document.createElement("div");
      div.textContent = file;
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = async () => {
        await fetch(`/delete/${file}`, { method: "DELETE" });
        listFiles();
      };
      div.appendChild(delBtn);
      fileList.appendChild(div);
    });
  }

  checkSession();
});
