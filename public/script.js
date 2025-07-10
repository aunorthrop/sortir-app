// Load files from localStorage on page load
window.addEventListener("DOMContentLoaded", () => {
  const storedFiles = JSON.parse(localStorage.getItem("uploadedFiles")) || [];
  storedFiles.forEach(fileName => displayFileName(fileName));
});

// Handle Upload
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");

  if (fileInput.files.length === 0) {
    alert("Please select a file to upload.");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      displayFileName(data.fileName);
      saveToLocalStorage(data.fileName);
    } else {
      alert(`❌ Upload failed: ${data.error}`);
    }
  } catch (err) {
    alert("An error occurred during upload.");
    console.error(err);
  } finally {
    fileInput.value = "";
  }
});

// Ask a Question
document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value.trim();
  const loading = document.getElementById("loadingIndicator");
  const answerBox = document.getElementById("answerBox");

  if (!question) return alert("Please enter a question.");
  loading.style.display = "inline";
  answerBox.innerText = "";

  try {
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    answerBox.innerText = data.answer || "No answer returned.";
  } catch (err) {
    answerBox.innerText = "Error getting an answer.";
    console.error(err);
  } finally {
    loading.style.display = "none";
  }
});

// Delete Button Delegation
document.getElementById("fileListContainer").addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-button")) return;

  const fileItem = e.target.closest(".file-item");
  const fileName = fileItem.dataset.name;

  try {
    const res = await fetch("/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName }),
    });

    if (res.ok) {
      fileItem.remove();
      removeFromLocalStorage(fileName);
      document.getElementById("answerBox").innerText = "";
    } else {
      const data = await res.json();
      alert(`❌ Failed to delete: ${data.error}`);
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("An error occurred during deletion.");
  }
});

// Helpers
function displayFileName(name) {
  const container = document.getElementById("fileListContainer");

  const fileDiv = document.createElement("div");
  fileDiv.className = "file-item";
  fileDiv.dataset.name = name;

  const span = document.createElement("span");
  span.className = "file-name-display";
  span.textContent = name;

  const btn = document.createElement("button");
  btn.className = "delete-button";
  btn.textContent = "Delete";

  fileDiv.appendChild(span);
  fileDiv.appendChild(btn);
  container.appendChild(fileDiv);
}

function saveToLocalStorage(fileName) {
  const stored = JSON.parse(localStorage.getItem("uploadedFiles")) || [];
  if (!stored.includes(fileName)) {
    stored.push(fileName);
    localStorage.setItem("uploadedFiles", JSON.stringify(stored));
  }
}

function removeFromLocalStorage(fileName) {
  let stored = JSON.parse(localStorage.getItem("uploadedFiles")) || [];
  stored = stored.filter(name => name !== fileName);
  localStorage.setItem("uploadedFiles", JSON.stringify(stored));
}
