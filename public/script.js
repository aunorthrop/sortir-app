const fileInput = document.getElementById("fileInput");
const deleteFileBtn = document.getElementById("deleteFileBtn");
const fileStatus = document.getElementById("fileStatus");
const downloadLink = document.getElementById("downloadLink");
const askBtn = document.getElementById("askBtn");
const questionInput = document.getElementById("questionInput");
const responseModal = document.getElementById("responseModal");
const responseText = document.getElementById("responseText");
const closeModal = document.getElementById("closeModal");

let uploadedFile = null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function () {
    uploadedFile = reader.result.split(",")[1];
    const blob = b64toBlob(uploadedFile, "application/pdf");
    const url = URL.createObjectURL(blob);
    downloadLink.innerHTML = `<a href="${url}" download="${file.name}">Download ${file.name}</a>`;
    fileStatus.innerText = `Loaded: ${file.name}`;
  };

  if (file) {
    reader.readAsDataURL(file);
  }
});

deleteFileBtn.addEventListener("click", () => {
  uploadedFile = null;
  downloadLink.innerHTML = "";
  fileStatus.innerText = "No file uploaded.";
});

askBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question || !uploadedFile) return;

  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileData: uploadedFile,
      fileName: "uploaded.pdf",
      question: question,
    }),
  });

  const data = await response.json();
  responseText.innerText = data.answer || "No answer received.";
  responseModal.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  responseModal.classList.add("hidden");
});

function b64toBlob(b64Data, contentType = "", sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = Array.from(slice).map(c => c.charCodeAt(0));
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
}
