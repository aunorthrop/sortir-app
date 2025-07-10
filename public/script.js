document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById("fileInput");
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  alert("✅ File uploaded successfully");
});

document.getElementById("askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("questionInput").value;

  const response = await fetch("/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  const data = await response.json();
  document.getElementById("answerBox").innerText = data.answer || "No answer returned.";
});
