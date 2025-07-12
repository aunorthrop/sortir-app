document.addEventListener('DOMContentLoaded', () => {
  fetch('/files')
    .then(res => res.json())
    .then(files => {
      const list = document.getElementById('fileList');
      list.innerHTML = '';
      files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file;

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.onclick = () => {
          fetch('/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ filename: file })
          }).then(() => location.reload());
        };

        li.appendChild(delBtn);
        list.appendChild(li);
      });
    });

  const askBtn = document.getElementById('askBtn');
  if (askBtn) {
    askBtn.onclick = () => alert('Ask functionality coming soon.');
  }
});
