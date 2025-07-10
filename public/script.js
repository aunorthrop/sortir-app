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
      const file = cursor.value;

      const fileDiv = document.createElement("div");
      fileDiv.className = "file-item";

      const fileNameSpan = document.createElement("span");
      fileNameSpan.className = "file-name-display";
      fileNameSpan.textContent = file.name;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.textContent = "Delete";

      deleteButton.onclick = () => {
        const delTx = db.transaction(["files"], "readwrite");
        delTx.objectStore("files").delete(file.name);
        delTx.oncomplete = displayAllFiles;
      };

      fileDiv.appendChild(fileNameSpan);
      fileDiv.appendChild(deleteButton);
      fileListContainer.appendChild(fileDiv);

      cursor.continue();
    }
  };
}

document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value.trim();
  const loadingIndicator = document.getElementById("loadingIndicator");
  const answerBox = document.getElementById("answerBox");

  if (!question) return alert("Please enter a question.");

  loadingIndicator.style.display = "inline";
  answerBox.innerText = "";

  const tx = db.transaction(["files"], "readonly");
  const store = tx.objectStore("files");
  const getAll = store.getAll();

  getAll.onsuccess = async () => {
    const files = getAll.result;
    if (!files || files.length === 0) {
      loadingIndicator.style.display = "none";
      return alert("Please upload at least one PDF first.");
    }

    const allBase64PDFs = files.map(file => file.content);

    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          pdfs: allBase64PDFs,
        }),
      });

      const data = await response.json();
      answerBox.innerText = data.answer || "No answer returned from AI.";
    } catch (err) {
      console.error("Ask Sortir error:", err);
      answerBox.innerText = "An error occurred.";
    } finally {
      loadingIndicator.style.display = "none";
    }
  };
});
