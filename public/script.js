// Add this entire block inside your 'DOMContentLoaded' event listener in script.js

// --- DASHBOARD PAGE LOGIC ---

// Function to fetch and display files
const loadFiles = async () => {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;

    try {
        const response = await fetch('/api/files');
        const data = await response.json();

        fileList.innerHTML = ''; // Clear the list first
        if (data.success && data.files.length > 0) {
            data.files.forEach(filename => {
                const li = document.createElement('li');
                li.className = 'file-item';
                li.innerHTML = `
                    <span>${filename}</span>
                    <button class="delete-btn" data-filename="${filename}">Delete</button>
                `;
                fileList.appendChild(li);
            });
        } else {
            fileList.innerHTML = '<li>No files uploaded yet.</li>';
        }
    } catch (error) {
        fileList.innerHTML = '<li>Error loading files.</li>';
    }
};

// --- Event Handlers for Dashboard ---
const uploadForm = document.getElementById('upload-form');
if (uploadForm) {
    const fileInput = document.getElementById('file-input');
    const fileNameDisplay = document.getElementById('file-name-display');

    fileInput.addEventListener('change', () => {
        fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file selected';
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (response.ok) {
                loadFiles(); // Refresh the file list on successful upload
                uploadForm.reset(); // Clear the form
                fileNameDisplay.textContent = 'No file selected';
            } else {
                alert(result.message || 'Upload failed.');
            }
        } catch (error) {
            alert('An error occurred during upload.');
        }
    });
}

// Event delegation for delete buttons
const fileListContainer = document.getElementById('file-list');
if(fileListContainer) {
    fileListContainer.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('delete-btn')) {
            const filename = e.target.dataset.filename;
            if (confirm(`Are you sure you want to delete ${filename}?`)) {
                try {
                    const response = await fetch('/api/delete-file', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename })
                    });
                    const result = await response.json();
                    if(response.ok) {
                        loadFiles(); // Refresh list on successful delete
                    } else {
                        alert(result.message || 'Failed to delete file.');
                    }
                } catch (error) {
                     alert('An error occurred while deleting the file.');
                }
            }
        }
    });
}

// Handler for the "Ask Sortir" form
const askForm = document.getElementById('ask-form');
if (askForm) {
    askForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = document.getElementById('question-input').value;
        const answerContainer = document.getElementById('answer-container');
        answerContainer.innerHTML = '<p>Thinking...</p>';

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });
            const result = await response.json();
            if(result.success) {
                answerContainer.innerHTML = `<p>${result.answer}</p>`;
            } else {
                answerContainer.innerHTML = `<p class="error-text">${result.message || 'Failed to get an answer.'}</p>`;
            }
        } catch (error) {
            answerContainer.innerHTML = `<p class="error-text">An error occurred.</p>`;
        }
    });
}

// Initial load of files when the dashboard page loads
if (window.location.pathname.endsWith('dashboard.html')) {
    loadFiles();
}
