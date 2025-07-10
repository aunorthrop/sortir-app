document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");
  const formData = new FormData();

  if (fileInput.files.length === 0) {
    alert("Please select a file to upload.");
    return;
  }

  formData.append("file", fileInput.files[0]);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      alert("✅ File uploaded successfully");
      displayFileName(data.fileName); // Display the uploaded file name
    } else {
      // Improved error message for upload failure
      const errorData = await response.json();
      alert(`❌ File upload failed: ${errorData.error || response.statusText}`);
    }
  } catch (error) {
    console.error("Error during file upload:", error);
    alert("An error occurred during file upload.");
  } finally {
    // Crucial: Clear the file input value after submission attempt
    // This can help with the "only works on second try" issue
    fileInput.value = ''; 
  }
});

document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value;
  const loadingIndicator = document.getElementById("loadingIndicator");
  const answerBox = document.getElementById("answerBox");

  if (!question.trim()) {
    alert("Please enter a question.");
    return;
  }

  loadingIndicator.style.display = "inline"; // Show "thinking..."
  answerBox.innerText = ""; // Clear previous answer

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    const data = await response.json();
    answerBox.innerText = data.answer || "No answer returned";
  } catch (error) {
    console.error("Error asking Sortir:", error);
    answerBox.innerText = "An error occurred while getting an answer.";
  } finally {
    loadingIndicator.style.display = "none"; // Hide "thinking..."
  }
});

// New: Event Delegation for Delete Button
document.getElementById("fileListContainer").addEventListener("click", async (e) => {
    // Check if the clicked element has the class "delete-button"
    if (e.target.classList.contains("delete-button")) {
        try {
            const response = await fetch("/delete", {
                method: "POST",
            });

            if (response.ok) {
                alert("✅ File deleted successfully.");
                // Remove the parent element (file-item div) of the clicked delete button
                e.target.closest(".file-item").remove(); 
                document.getElementById("answerBox").innerText = ""; // Clear answer box
            } else {
                const errorData = await response.json();
                alert(`❌ Failed to delete file: ${errorData.error || response.statusText}`);
            }
        } catch (error) {
            console.error("Error deleting file:", error);
            alert("An error occurred during file deletion.");
        }
    }
});

// Original displayFileName function - now it just creates elements, no event listener here
function displayFileName(fileName) {
  const fileListContainer = document.getElementById("fileListContainer");
  fileListContainer.innerHTML = ''; // Clear previous file display to ensure only one file is shown

  if (fileName) {
    const fileDiv = document.createElement("div");
    fileDiv.className = "file-item";

    const fileNameSpan = document.createElement("span");
    fileNameSpan.className = "file-name-display";
    fileNameSpan.textContent = fileName;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    // *** REMOVED: deleteButton.addEventListener(...) from here ***

    fileDiv.appendChild(fileNameSpan);
    fileDiv.appendChild(deleteButton);
    fileListContainer.appendChild(fileDiv);
  }
}
