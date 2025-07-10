const fileListKey = "uploadedFiles";

function updateLocalFileList(fileName) {
  const list = JSON.parse(localStorage.getItem(fileListKey)) || [];
  list.push(fileName);
  localStorage.setItem(fileListKey, JSON.stringify([...new Set(list)]));
}

function loadFilesFromLocalStorage() {
  const list = JSON.parse(localStorage.getItem(fileListKey)) || [];
  list.forEach(displayFileName);
}

document.addEventListener("DOMContentLoaded", loadFilesFromLocalStorage);

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");

  if (fileInput.files.length === 0) return alert("Please select a file to upload.");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const res = await fetch("/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Uploaded");
      updateLocalFileList(data.fileName);
      displayFileName(data.fileName);
    } else {
      alert(`❌ Upload failed: ${data.error || res.statusText}`);
    }
  } catch (err) {
    console.error(err);
    alert("Error uploading.");
  }

  fileInput.value = "";
});

document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = document.getElementById("questionInput").value;
  const indicator = document.getElementById("loadingIndicator");
  const box = document.getElementById("answerBox");

  if (!q.trim()) return alert("Enter a question.");

  indicator.style.display = "inline";
  box.innerText = "";

  try {
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    box.innerText = data.answer || "No answer.";
  } catch (err) {
    console.error("Ask error:", err);
    box.innerText = "Error getting answer.";
  } finally {
    indicator.style.display = "none";
  }
});

document.getElementById("fileListContainer").addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-button")) {
    try {
      const res = await fetch("/delete", { method: "POST" });
      if (res.ok) {
        alert("✅ Deleted");
        localStorage.removeItem(fileListKey);
        document.getElementById("fileListContainer").innerHTML = "";
        document.getElementById("answerBox").innerText = "";
      } else {
        const err = await res.json();
        alert(`❌ Delete failed: ${err.error}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Delete failed.");
    }
  }
});

function displayFileName(name) {
  const container = document.getElementById("fileListContainer");
  const div = document.createElement("div");
  div.className = "file-item";

  const span = document.createElement("span");
  span.className = "file-name-display";
  span.textContent = name;

  const btn = document.createElement("button");
  btn.className = "delete-button";
  btn.textContent = "Delete";

  div.appendChild(span);
  div.appendChild(btn);
  container.appendChild(div);
}
