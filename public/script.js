// Handle file list display
async function fetchFiles() {
  const res = await fetch("/files");
  const files = await res.json();
  displayFiles(files);
}

function displayFiles(files) {
  const container = document.getElementById("fileListContainer");
  container.innerHTML = "";

  files.forEach((file) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name-display";
    nameSpan.textContent = file;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-button";
    delBtn.textContent = "Delete";
    delBtn.onclick = () => deleteFile(file);

    item.appendChild(nameSpan);
    item.appendChild(delBtn);
    container.appendChild(item);
  });
}

// Upload file
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("fileInput");
  const file = input.files[0];
  if (!file) return alert("Please select a PDF file.");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const result = await res.json();
  if (result.success) {
    fetchFiles();
    input.value = "";
  } else {
    alert(result.error || "Upload failed");
  }
});

// Delete file
async function deleteFile(filename) {
  await fetch(`/delete/${filename}`, { method: "DELETE" });
  fetchFiles();
}

// Ask Sortir
document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value.trim();
  if (!question) return;

  const loading = document.getElementById("loadingIndicator");
  loading.style.display = "inline";

  const res = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = await res.json();
  document.getElementById("answerBox").textContent = data.answer || data.error || "No response.";

  loading.style.display = "none";
});

// On load
window.onload = () => {
  fetchFiles();
};
