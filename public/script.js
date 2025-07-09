const fileInput = document.getElementById("fileInput");
const deleteFileBtn = document.getElementById("deleteFileBtn");
const fileStatus = document.getElementById("fileStatus");
const downloadLink = document.getElementById("downloadLink");
const askBtn = document.getElementById("askBtn");
const questionInput = document.getElementById("questionInput");
const responseModal = document.getElementById("responseModal");
const responseText = document.getElementById("responseText");
const closeModal = document.getElementById("closeModal");

// Load file from localStorage on refresh
window.onload = () => {
  const storedFile = localStorage.getItem("uploadedFile");
  const fileName = localStorage.getItem("fileName");
  if (storedFile && fileName) {
    showDownloadLink(fileName, storedFile);
  }
};

// Upload handler
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function () {
    const base64Data = reader.result.split(",")[1];
    localStorage.setItem("uploadedFile", base64Data);
    localStorage.setItem("fileName", file.name);
    showDownloadLink(file.name, base64Data);
  };

  if (file) {
    reader.readAsDataURL(file);
  }
});

// Delete file
deleteFileBtn.addEventListener("click", () => {
  localStorage.removeItem("uploadedFile");
  localStorage.removeItem("fileName");
  downloadLink.innerHTML = "";
  fileStatus.innerText = "No file uploaded.";
});

// Show link
function showDownloadLink(name, data) {
  const blob = b64toBlob(data, "application/pdf");
  const url = URL.createObjectURL(blob);
  downloadLink.innerHTML = `<a href="${url}" download="${name}">Download ${name}</a>`;
  fileStatus.innerText = `Loaded: ${name}`;
}

// Ask question
askBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  const file = localStorage.getItem("uploadedFile");
  const fileName = localStorage.getItem("fileName") || "document.pdf";

  if (!question || !file) return;

  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileData: file,
      fileName: fileName,
      question: question,
    }),
  });

  const data = await response.json();
  responseText.innerText = data.answer || "No answer received.";
  responseModal.classList.remove("hidden");
});

// Close modal
closeModal.addEventListener("click", () => {
  responseModal.classList.add("hidden");
});

// Convert base64 to Blob
function b64toBlob(b64Data, contentType = "", sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = Array.from(slice).map((char) => char.charCodeAt(0));
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
}
