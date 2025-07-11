document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const uploadForm = document.getElementById("uploadForm");
  const askForm = document.getElementById("askForm");
  const fileList = document.getElementById("fileList");
  const answerBox = document.getElementById("answerBox");
  const authMessage = document.getElementById("auth-message");
  const loadingIndicator = document.getElementById("loadingIndicator");

  let isAuthenticated = false;

  function showAuthMessage(message, isError = true) {
    authMessage.textContent = message;
    authMessage.style.color = isError ? "#ff4d4d" : "#00ffcc";
    setTimeout(() => {
      authMessage.textContent = "";
    }, 3000);
  }

  // SIGNUP
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("signupEmail").value;
      const password = document.getElementById("signupPassword").value;

      const res = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        showAuthMessage(data.message, false);
      } else {
        showAuthMessage(data.error || "Signup failed.");
      }
    });
  }

  // LOGIN
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        showAuthMessage("Login successful!", false);
        location.reload();
      } else {
        showAuthMessage(data.error || "Login failed.");
      }
    });
  }

  // FILE UPLOAD
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("fileInput");
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);

      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fileInput.value = "";
        await fetchFiles();
      } else {
        alert("Upload failed.");
      }
    });
  }

  // FETCH FILES
  async function fetchFiles() {
    const res = await fetch("/files");
    const files = await res.json();

    fileList.innerHTML = "";
    files.forEach((filename) => {
      const div = document.createElement("div");
      div.className = "file-item";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = filename;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete-button";
      deleteBtn.onclick = async () => {
        await fetch(`/delete/${filename}`, { method: "DELETE" });
        await fetchFiles();
      };

      div.appendChild(nameSpan);
      div.appendChild(deleteBtn);
      fileList.appendChild(div);
    });
  }

  // ASK SORTIR
  if (askForm) {
    askForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const question = document.getElementById("questionInput").value;

      loadingIndicator.style.display = "inline";
      answerBox.textContent = "";

      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      loadingIndicator.style.display = "none";

      if (res.ok) {
        answerBox.textContent = data.answer;
      } else {
        answerBox.textContent = "Error getting answer.";
      }
    });
  }

  // INIT
  if (fileList) {
    fetchFiles();
  }
});
