let db;

const request = indexedDB.open("SortirVault", 1);
request.onerror = (e) => console.error("IndexedDB error:", e);
request.onsuccess = (e) => {
  db = e.target.result;
  displayAllFiles();
};
request.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore("files", { keyPath: "name" });
};

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");
  if (fileInput.files.length === 0) return alert("Please select a file.");

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    store.put({ name: file.name, content: reader.result });
    transaction.oncomplete = displayAllFiles;
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});

function displayAllFiles() {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = "";
  const transaction = db.transaction(["files"], "readonly");
  const store = transaction.objectStore("files");
  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const fileDiv = document.createElement("div");
      fileDiv.className = "file-item";

      const fileNameSpan = document.createElement("span");
      fileNameSpan.className = "file-name-display";
      fileNameSpan.textContent = cursor.value.name;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        const delTx = db.transaction(["files"], "readwrite");
        const store = delTx.objectStore("files");
        store.delete(cursor.value.name);
        delTx.oncomplete = displayAllFiles;
      });

      fileDiv.appendChild(fileNameSpan);
      fileDiv.appendChild(deleteButton);
      fileListContainer.appendChild(fileDiv);

      cursor.continue();
    }
  };
}

// 🔁 Ask Sortir button logic: sends question + latest PDF to backend
document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value.trim();
  const loadingIndicator = document.getElementById("loadingIndicator");
  const answerBox = document.getElementById("answerBox");

  if (!question) return alert("Please enter a question.");

  loadingIndicator.style.display = "inline";
  answerBox.innerText = "";

  // Get the latest stored file from IndexedDB
  const tx = db.transaction(["files"], "readonly");
  const store = tx.objectStore("files");
  const requestAll = store.getAll();
  requestAll.onsuccess = async () => {
    const files = requestAll.result;
    if (!files || files.length === 0) {
      loadingIndicator.style.display = "none";
      return alert("Please upload a PDF first.");
    }

    // We'll just use the most recently added file
    const latestFile = files[files.length - 1];

    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: question,
          base64pdf: latestFile.content
        })
      });

      const data = await response.json();
      answerBox.innerText = data.answer || "No answer returned";
    } catch (err) {
      console.error("Error asking Sortir:", err);
      answerBox.innerText = "An error occurred.";
    } finally {
      loadingIndicator.style.display = "none";
    }
  };
});
