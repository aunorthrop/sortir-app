let uploadedFiles = [];

function uploadPDF() {
  const input = document.getElementById("pdfInput");
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("pdf", file);

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        uploadedFiles.push(file.name);
        renderFileList();
      }
    });
}

function renderFileList() {
  const list = document.getElementById("fileList");
  list.innerHTML = "";

  uploadedFiles.forEach((name) => {
    const row = document.createElement("div");
    row.className = "file-entry";
    row.innerHTML = `
      ${name}
      <button onclick="deleteFile('${name}')">Delete</button>
    `;
    list.appendChild(row);
  });
}

function deleteFile(name) {
  fetch("/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: name }),
  }).then((res) => {
    uploadedFiles = uploadedFiles.filter((f) => f !== name);
    renderFileList();
  });
}

function askSortir() {
  const prompt = document.getElementById("userPrompt").value;

  fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
    .then((res) => res.json())
    .then((data) => {
      document.getElementById("responseBox").innerText = data.answer || "No answer found.";
    });
}
