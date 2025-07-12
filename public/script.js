document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const forgotLink = document.getElementById("forgotLink");
  const authError = document.getElementById("authError");
  const authSection = document.getElementById("authSection");
  const mainApp = document.getElementById("mainApp");

  function showError(message) {
    authError.textContent = message;
  }

  async function handleAuth(endpoint, email, password) {
    try {
      const res = await fetch(`/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const error = await res.text();
        showError(error);
      } else {
        authSection.style.display = "none";
        mainApp.style.display = "block";
      }
    } catch (err) {
      showError("Server error. Please try again.");
    }
  }

  if (signupForm) {
    signupForm.addEventListener("submit", e => {
      e.preventDefault();
      const email = document.getElementById("signupEmail").value;
      const password = document.getElementById("signupPassword").value;
      handleAuth("signup", email, password);
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;
      handleAuth("login", email, password);
    });
  }

  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      if (!email) return showError("Enter your email first.");
      fetch("/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      }).then(res => {
        if (res.ok) {
          alert("Password reset link sent.");
        } else {
          showError("Failed to send reset link.");
        }
      }).catch(() => showError("Error sending request."));
    });
  }
});
