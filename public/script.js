let uploadedFiles = [];

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");
  const formData = new FormData();

  if (fileInput.files.length === 0) {
    alert("Please select a file to upload.");
    return;
  }

  const file = fileInput.files[0];
  formData.append("file", file);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      alert("✅ File uploaded successfully");
      uploadedFiles.push(data.fileName);
      renderFileList();
    } else {
      alert(`❌ Upload failed: ${data.error || response.statusText}`);
    }
  } catch (err) {
    alert("Upload error.");
    console.error(err);
  } finally {
    fileInput.value = '';
  }
});

document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value.trim();
  const loadingIndicator = document.getElementById("loadingIndicator");
  const answerBox = document.getElementById("answerBox");

  if (!question) {
    alert("Please enter a question.");
    return;
  }

  loadingIndicator.style.display = "inline";
  answerBox.innerText = "";

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await response.json();
    answerBox.innerText = data.answer || "No answer returned";
  } catch (err) {
    answerBox.innerText = "Error asking question.";
    console.error(err);
  } finally {
    loadingIndicator.style.display = "none";
  }
});

document.getElementById("fileListContainer").addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-button")) {
    try {
      const response = await fetch("/delete", { method: "POST" });
      if (response.ok) {
        uploadedFiles = [];
        renderFileList();
        document.getElementById("answerBox").innerText = "";
        alert("✅ All files deleted.");
      } else {
        const data = await response.json();
        alert(`❌ Delete failed: ${data.error || response.statusText}`);
      }
    } catch (err) {
      alert("Error deleting file.");
      console.error(err);
    }
  }
});

function renderFileList() {
  const container = document.getElementById("fileListContainer");
  container.innerHTML = '';

  uploadedFiles.forEach((fileName) => {
    const div = document.createElement("div");
    div.className = "file-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name-display";
    nameSpan.textContent = fileName;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-button";
    deleteBtn.textContent = "Delete";

    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
}
