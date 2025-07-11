document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const uploadForm = document.getElementById("upload-form");
  const fileInput = document.getElementById("file");
  const fileList = document.getElementById("file-list");
  const authMessage = document.getElementById("auth-message");

  async function checkSession() {
    const res = await fetch("/check-session");
    const data = await res.json();
    if (data.loggedIn) {
      document.getElementById("auth-section").style.display = "none";
      uploadForm.style.display = "block";
      listFiles();
    }
  }

  signupForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 200) {
      checkSession();
    } else {
      authMessage.textContent = await res.text();
    }
  };

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 200) {
      checkSession();
    } else {
      authMessage.textContent = "Invalid login credentials.";
    }
  };

  uploadForm.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    await fetch("/upload", { method: "POST", body: formData });
    listFiles();
  };

  async function listFiles() {
    const res = await fetch("/files");
    const files = await res.json();
    fileList.innerHTML = "";
    files.forEach((file) => {
      const div = document.createElement("div");
      div.textContent = file;
      const btn = document.createElement("button");
      btn.textContent = "Delete";
      btn.onclick = async () => {
        await fetch(`/delete/${file}`, { method: "DELETE" });
        listFiles();
      };
      div.appendChild(btn);
      fileList.appendChild(div);
    });
  }

  checkSession();
});
