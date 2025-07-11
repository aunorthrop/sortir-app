document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  signupForm.onsubmit = async (e) => {
    e.preventDefault();
    const [email, password] = signupForm.querySelectorAll("input");
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value, password: password.value })
    });
    if (res.ok) showMainUI();
  };

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const [email, password] = loginForm.querySelectorAll("input");
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value, password: password.value })
    });
    if (res.ok) showMainUI();
  };

  document.getElementById("upload-form").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await fetch("/upload", { method: "POST", body: formData });
    listFiles();
  };

  window.askSortir = async () => {
    const q = document.getElementById("question").value;
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    document.getElementById("answer").textContent = data.answer;
  };

  function showMainUI() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("main-app").style.display = "block";
    listFiles();
  }

  async function listFiles() {
    const res = await fetch("/files");
    const files = await res.json();
    const div = document.getElementById("file-list");
    div.innerHTML = "";
    files.forEach(file => {
      const el = document.createElement("div");
      el.textContent = file;
      div.appendChild(el);
    });
  }
});
