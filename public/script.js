const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
let uploadedFiles = [];

function uploadFile() {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64 = e.target.result.split(',')[1];
    const fileData = {
      name: file.name,
      content: base64
    };

    fetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fileData)
    })
    .then(res => res.json())
    .then(data => {
      uploadedFiles.push(file.name);
      updateFileList();
    });
  };
  reader.readAsDataURL(file);
}

function updateFileList() {
  fileList.innerHTML = '';
  uploadedFiles.forEach(name => {
    const div = document.createElement('div');
    div.textContent = name;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteFile(name);
    div.appendChild(delBtn);
    fileList.appendChild(div);
  });
}

function deleteFile(name) {
  fetch('/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  }).then(() => {
    uploadedFiles = uploadedFiles.filter(f => f !== name);
    updateFileList();
  });
}

function askSortir() {
  const userPrompt = document.getElementById("userPrompt").value;
  fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById("responseContainer").innerText = data.response;
  });
}
