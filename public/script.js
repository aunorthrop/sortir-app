document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");
  const uploadForm = document.getElementById("uploadForm");
  const askForm = document.getElementById("askForm");

  const fileInput = document.getElementById("fileInput");
  const fileListContainer = document.getElementById("fileListContainer");
  const questionInput = document.getElementById("questionInput");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const answerBox = document.getElementById("answerBox");

  async function fetchFiles() {
    const res = await fetch("/files");
    const files = await res.json();
    displayFiles(files);
  }

  function displayFiles(files) {
    fileListContainer.innerHTML = "";
    files.forEach(file => {
      const fileItem = document.createElement("div");
      fileItem.classList.add("file-item");

      const fileNameSpan = document.createElement("span");
      fileNameSpan.classList.add("file-name-display");
      fileNameSpan.textContent = file;

      const deleteButton = document.createElement("button");
      deleteButton.classList.add("delete-button");
      deleteButton.textContent = "Delete";
      deleteButton.onclick = async () => {
        await fetch(`/delete/${file}`, { method: "DELETE" });
        fetchFiles();
      };

      fileItem.appendChild(fileNameSpan);
      fileItem.appendChild(deleteButton);
      fileListContainer.appendChild(fileItem);
    });
  }

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return alert("Please choose a PDF");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      fileInput.value = "";
      fetchFiles();
    } else {
      alert(data.error || "Upload failed");
    }
  });

  askForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = questionInput.value;
    if (!question) return;

    loadingIndicator.style.display = "inline";
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    loadingIndicator.style.display = "none";
    answerBox.textContent = data.answer || data.error || "No response.";
  });

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
    if (data.success) {
      alert("Signup successful, please log in.");
    } else {
      alert(data.error || "Signup failed");
    }
  });

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
    if (data.success) {
      showApp();
    } else {
      alert(data.error || "Login failed");
    }
  });

  logoutButton.addEventListener("click", async () => {
    await fetch("/logout", { method: "POST" });
    location.reload();
  });

  async function checkSession() {
    const res = await fetch("/check-session");
    const data = await res.json();
    if (data.loggedIn) {
      showApp();
    }
  }

  function showApp() {
    signupForm.style.display = "none";
    loginForm.style.display = "none";
    logoutButton.style.display = "inline-block";
    uploadForm.style.display = "block";
    askForm.style.display = "block";
    fetchFiles();
  }

  checkSession();
});
