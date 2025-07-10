document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");
    const uploadButton = document.getElementById("uploadButton");
    const questionInput = document.getElementById("questionInput");
    const askButton = document.getElementById("askButton");
    const answerText = document.getElementById("answerText");
    const documentList = document.getElementById("documentList");
    const activeFileNameSpan = document.getElementById("activeFileName");

    // Function to load and display documents
    async function loadDocuments() {
        try {
            const response = await fetch('/documents');
            if (!response.ok) {
                throw new Error('Failed to fetch documents');
            }
            const documents = await response.json();
            documentList.innerHTML = ''; // Clear existing list

            if (documents.length === 0) {
                documentList.innerHTML = '<li>No documents uploaded yet.</li>';
                activeFileNameSpan.textContent = "None"; // Reset active document display
            } else {
                documents.forEach(doc => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <span>${doc.fileName} (Uploaded: ${new Date(doc.uploadedAt).toLocaleString()})</span>
                        <button class="select-btn" data-id="${doc.id}">Select</button>
                        <button class="delete-btn" data-id="${doc.id}">Delete</button>
                    `;
                    documentList.appendChild(listItem);
                });
                // After loading, potentially select the first document or previously active one
                // This logic depends on whether you want to persist active document on frontend as well
                if (documents.length > 0) {
                    // This is a simple auto-select for demonstration
                    // In a real app, you might persist the last active doc's ID in localStorage
                    // and try to select it.
                    const firstDoc = documents[0];
                    selectDocument(firstDoc.id, firstDoc.fileName);
                }
            }
        } catch (error) {
            console.error("Error loading documents:", error);
            documentList.innerHTML = '<li>Error loading documents.</li>';
        }
    }

    // Function to select a document
    async function selectDocument(docId, fileName) {
        try {
            const response = await fetch(`/select-document/${docId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to select document');
            }
            const data = await response.json();
            activeFileNameSpan.textContent = fileName;
            answerText.textContent = `Document '${fileName}' is now active.`;
            console.log(data.message);
        } catch (error) {
            console.error("Error selecting document:", error);
            answerText.textContent = "Failed to select document.";
        }
    }

    // Function to delete a document
    async function deleteDocument(docId) {
        if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
            return;
        }
        try {
            const response = await fetch(`/delete-document/${docId}`, {
                method: 'POST', // Using POST for deletion as it modifies state
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to delete document');
            }
            const data = await response.json();
            alert(data.message);
            loadDocuments(); // Reload the list after deletion
        } catch (error) {
            console.error("Error deleting document:", error);
            alert("Failed to delete document.");
        }
    }


    uploadButton.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) {
            answerText.textContent = "Please choose a file first.";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            answerText.textContent = "Uploading and extracting text...";
            const response = await fetch("/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                answerText.textContent = `File uploaded: ${data.fileName}. Ready to ask questions.`;
                loadDocuments(); // Reload document list after successful upload
                fileInput.value = ''; // Clear file input
            } else {
                answerText.textContent = `Error: ${data.error}`;
            }
        } catch (error) {
            console.error("Upload error:", error);
            answerText.textContent = "Upload failed. Please try again.";
        }
    });

    askButton.addEventListener("click", async () => {
        const question = questionInput.value.trim();
        if (!question) {
            answerText.textContent = "Please enter a question.";
            return;
        }

        answerText.textContent = "Getting answer...";
        try {
            const response = await fetch("/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ question }),
            });

            const data = await response.json();
            if (response.ok) {
                answerText.textContent = data.answer;
            } else {
                answerText.textContent = `Error: ${data.error}`;
            }
        } catch (error) {
            console.error("Ask error:", error);
            answerText.textContent = "Failed to get answer. Please try again.";
        }
    });

    // Event delegation for document list buttons
    documentList.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('select-btn')) {
            const docId = target.dataset.id;
            const fileName = target.previousElementSibling.textContent.split(' (')[0]; // Get filename from span
            selectDocument(docId, fileName);
        } else if (target.classList.contains('delete-btn')) {
            const docId = target.dataset.id;
            deleteDocument(docId);
        }
    });

    // Initial load of documents when the page loads
    loadDocuments();
});
