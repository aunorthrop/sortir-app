document.getElementById('uploadForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function () {
      localStorage.setItem(file.name, reader.result); // Store base64
      alert("File saved locally!");
      fileInput.value = ""; // Clear selection
      listStoredFiles(); // Refresh list
    };
    reader.readAsDataURL(file); // Read as base64
  }
});

function listStoredFiles() {
  const container = document.getElementById('fileListContainer');
  container.innerHTML = '';

  Object.keys(localStorage).forEach((key) => {
    const dataURL = localStorage.getItem(key);
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = key;
    link.textContent = `Download ${key}`;
    container.appendChild(link);
    container.appendChild(document.createElement('br'));
  });
}

window.onload = listStoredFiles;

document.getElementById('askForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const question = document.getElementById('questionInput').value.trim();
  if (question) {
    alert("You asked: " + question); // Placeholder response
  }
});
