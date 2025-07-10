async function uploadPDF() {
  const input = document.getElementById('pdfInput');
  const formData = new FormData();
  formData.append('file', input.files[0]);

  await fetch('/upload', {
    method: 'POST',
    body: formData,
  });

  input.value = '';
  loadFiles();
}

async function loadFiles() {
  const res = await fetch('/files');
  const files = await res.json();

  const list = document.getElementById('fileList');
  list.innerHTML = '';
  files.forEach(name => {
    const div = document.createElement('div');
    div.textContent = name;

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      await fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      loadFiles();
    };

    div.appendChild(del);
    list.appendChild(div);
  });
}

async function askSortir() {
  const question = document.getElementById('question').value;

  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: question }),
  });

  const answer = await res.text();
  document.getElementById('response').textContent = answer;
}

window.onload = loadFiles;
