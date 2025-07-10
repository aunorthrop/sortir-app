let db;

// Open (or create) IndexedDB
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
        delTx.objectStore("files").delete(cursor.value.name);
        delTx.oncomplete = displayAllFiles;
      });

      fileDiv.appendChild(fileNameSpan);
      fileDiv.appendChild(deleteButton);
      fileListContainer.appendChild(fileDiv);

      cursor.continue();
    }
  };
}
