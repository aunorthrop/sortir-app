document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");
  const fileInput = document.getElementById("fileInput");
  const fileListContainer = document.getElementById("fileListContainer");
  const askForm = document.getElementById("askForm");
  const questionInput = document.getElementById("questionInput");
  const answerBox = document.getElementById("answerBox");
  const loadingIndicator = document.getElementById("loadingIndicator");

  function fetchFiles() {
    fetch("/files")
      .then(res => res.json())
      .then(files => displayFiles(files))
      .catch(err => console.error("Error fetching files:", err));
  }

  function displayFiles(files) {
    fileListContainer.innerHTML = "";
    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "file-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "file-name-display";
      nameSpan.textContent = file;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-button";
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = () => {
        fetch(`/delete/${file}`, { method: "DELETE" })
          .then(() => fetchFiles())
          .catch(err => console.error("Error deleting file:", err));
      };

      item.appendChild(nameSpan);
      item.appendChild(deleteBtn);
      fileListContainer.appendChild(item);
    });
  }

  uploadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return alert("Please select a file.");
    const formData = new FormData();
    formData.append("file", file);

    fetch("/upload", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          fetchFiles();
          fileInput.value = "";
        } else {
          alert(result.error || "Upload failed");
        }
      })
      .catch((err) => {
        console.error("Upload error:", err);
        alert("Upload failed");
      });
  });

  askForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;
    loadingIndicator.style.display = "inline";
    fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })
      .then((res) => res.json())
      .then((data) => {
        answerBox.textContent = data.answer || data.error || "No response.";
      })
      .catch((err) => {
        console.error("Ask error:", err);
        answerBox.textContent = "Something went wrong.";
      })
      .finally(() => {
        loadingIndicator.style.display = "none";
      });
  });

  fetchFiles();
});
