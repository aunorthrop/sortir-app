async function fetchFiles() {
  const res = await fetch("/files");
  const files = await res.json();
  localStorage.setItem("storedFiles", JSON.stringify(files));
  displayFiles(files);
}

function displayFiles(files) {
  const list = document.getElementById("fileDisplay");
  list.innerHTML = "";

  files.forEach((file) => {
    const li = document.createElement("li");
    li.textContent = file;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = () => deleteFile(file);

    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

async function uploadFile() {
  const input = document.getElementById("fileInput");
  const file = input.files[0];
  if (!file) return alert("Please select a file.");

  const formData = new FormData();
  formData.append("file", file);

  try {
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
  } catch (err) {
    alert("Upload error");
    console.error(err);
  }
}

async function deleteFile(filename) {
  await fetch(`/delete/${filename}`, { method: "DELETE" });
  fetchFiles();
}

async function askSortir() {
  const question = document.getElementById("questionInput").value;
  if (!question) return;

  const res = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = await res.json();
  document.getElementById("responseText").textContent = data.answer || data.error || "No response.";
}

window.onload = () => {
  const cached = localStorage.getItem("storedFiles");
  if (cached) {
    try {
      displayFiles(JSON.parse(cached));
    } catch (e) {
      console.error("Invalid localStorage data");
    }
  }
  fetchFiles();
};
