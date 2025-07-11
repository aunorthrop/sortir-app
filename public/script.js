document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");

  async function showApp() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("app").style.display = "block";
    listFiles();
  }

  async function checkSession() {
    const res = await fetch("/session");
    const data = await res.json();
    if (data.loggedIn) showApp();
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (data.success) {
      alert("Signup successful!");
      showApp();
    } else {
      alert(data.error || "Signup failed.");
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (data.success) {
      alert("Login successful!");
      showApp();
    } else {
      alert(data.error || "Login failed.");
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await fetch("/logout", { method: "POST" });
    location.reload();
  });

  checkSession();
});
