document.addEventListener("DOMContentLoaded", () => {
  fetch("/files")
    .then((res) => res.json())
    .then((files) => {
      files.forEach(addFileToList);
    });
});

function uploadFile() {
  const input = document.getElementById("fileInput");
  const file = input.files[0];
  if (!file) return alert("Please select a file.");

  const formData = new FormData();
  formData.append("file", file);

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        addFileToList(file.name);
      } else {
        alert("Upload failed: " + data.error);
      }
    })
    .catch((err) => {
      console.error(err);
      alert("Error uploading file.");
    });
}

function addFileToList(filename) {
  const fileList = document.getElementById("fileList");
  const li = document.createElement("li");
  li.textContent = filename;

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "delete-button";
  deleteBtn.onclick = () => {
    fetch(`/delete/${filename}`, { method: "DELETE" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          li.remove();
        } else {
          alert("Delete failed.");
        }
      });
  };

  li.appendChild(deleteBtn);
  fileList.appendChild(li);
}

function askSortir() {
  const question = document.getElementById("questionInput").value;
  if (!question) return;

  fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  })
    .then((res) => res.json())
    .then((data) => {
      document.getElementById("response").textContent = data.answer || "No response.";
    })
    .catch((err) => {
      console.error(err);
      alert("Error asking question.");
    });
}
