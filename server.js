const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
const { OpenAI } = require("openai");
const path = require("path");

const app = express();

// --- Configuration for Local File Storage ---
const UPLOAD_DIR = path.join(__dirname, "uploads"); // Directory to store uploaded PDFs
const DOCUMENTS_DB_PATH = path.join(__dirname, "documents.json"); // Path for our simple JSON DB

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Multer Configuration for Disk Storage ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR); // Store files in the 'uploads' directory
  },
  filename: function (req, file, cb) {
    // Create a unique filename by appending a timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
        "-" +
        uniqueSuffix +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static("public"));
app.use(express.json());

// --- Persistent Storage for Extracted Text and File Metadata ---
// We'll use an object where keys are file IDs (or paths) and values are extracted text.
// For a real app, this would be a database like MongoDB or PostgreSQL.
let documentsStore = {}; // In-memory cache for text content
let documentMetadata = []; // In-memory cache for document metadata (for frontend display)

// --- Function to load documents from our "database" (JSON file) ---
const loadDocumentsFromDisk = async () => {
  if (fs.existsSync(DOCUMENTS_DB_PATH)) {
    const dbRaw = fs.readFileSync(DOCUMENTS_DB_PATH, "utf8");
    documentMetadata = JSON.parse(dbRaw);

    // Re-extract text for existing documents on server start
    // This can be slow for many large documents. In a production app,
    // you might only load text for the *active* document or when queried.
    documentsStore = {}; // Clear previous store
    for (const doc of documentMetadata) {
      const filePath = doc.filePath;
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        documentsStore[doc.id] = data.text; // Store text by document ID
        console.log(`Re-extracted text for: ${doc.originalName}`);
      } catch (error) {
        console.error(`Error re-extracting text for ${doc.originalName}:`, error);
        // Optionally remove corrupted entry
        documentMetadata = documentMetadata.filter(d => d.id !== doc.id);
      }
    }
  } else {
    documentMetadata = []; // Initialize empty if file doesn't exist
  }
};

// --- Function to save document metadata to our "database" (JSON file) ---
const saveDocumentsToDisk = () => {
  fs.writeFileSync(DOCUMENTS_DB_PATH, JSON.stringify(documentMetadata, null, 2), "utf8");
};

// Load documents when the server starts
loadDocumentsFromDisk().then(() => {
    console.log("Documents loaded from disk:", documentMetadata.length);
});


// We need to keep track of the currently active document for the /ask endpoint
let currentActiveDocumentId = null;

// --- API Endpoints ---

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const originalName = req.file.originalname;
    const filePath = req.file.path; // Multer (disk storage) provides the file path

    // Extract text from the newly uploaded PDF
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const extractedText = data.text;

    // Generate a unique ID for the document
    const docId = Date.now().toString();

    // Store the extracted text in our in-memory store
    documentsStore[docId] = extractedText;

    // Store metadata in our in-memory list
    documentMetadata.push({
      id: docId,
      originalName: originalName,
      filePath: filePath, // Store the path for later re-extraction if needed
      uploadedAt: new Date().toISOString(),
    });

    // Save the updated metadata to our JSON "database"
    saveDocumentsToDisk();

    // Set the newly uploaded document as the active one
    currentActiveDocumentId = docId;

    res.json({
      message: "File uploaded successfully and text extracted.",
      id: docId,
      fileName: originalName,
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    // If saving fails, consider cleaning up the uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Failed to process PDF upload." });
  }
});

// Endpoint to get a list of all uploaded documents
app.get("/documents", (req, res) => {
    // Return only necessary metadata to the frontend
    const docsForFrontend = documentMetadata.map(doc => ({
        id: doc.id,
        fileName: doc.originalName,
        uploadedAt: doc.uploadedAt
    }));
    res.json(docsForFrontend);
});

// Endpoint to set the active document (e.g., when a user clicks on one from the list)
app.post("/select-document/:id", (req, res) => {
    const { id } = req.params;
    if (documentsStore[id]) {
        currentActiveDocumentId = id;
        res.json({ message: `Document ${id} selected.`, fileName: documentMetadata.find(d => d.id === id)?.originalName });
    } else {
        res.status(404).json({ error: "Document not found." });
    }
});


app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!currentActiveDocumentId || !documentsStore[currentActiveDocumentId]) {
      return res.json({ answer: "Please upload or select a PDF first." });
    }

    const activeExtractedText = documentsStore[currentActiveDocumentId];

    if (!question || question.trim() === "") {
      return res.json({ answer: "Please provide a question." });
    }

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for answering questions about internal company documents. Provide concise and relevant answers based solely on the provided document content. If the answer is not in the document, state that you cannot find the information.",
        },
        {
          role: "user",
          content: `Document content:\n${activeExtractedText}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const answer = chatCompletion.choices[0].message.content || "No answer returned";
    res.json({ answer });
  } catch (error) {
    console.error("Error getting answer from OpenAI:", error);
    res.status(500).json({ error: "Failed to get answer from AI" });
  }
});

app.post("/delete-document/:id", (req, res) => {
    const { id } = req.params;
    console.log(`DELETE request received for document ID: ${id}`);
    try {
        const index = documentMetadata.findIndex(doc => doc.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Document not found." });
        }

        const docToDelete = documentMetadata[index];

        // 1. Delete the actual file from disk
        if (fs.existsSync(docToDelete.filePath)) {
            fs.unlinkSync(docToDelete.filePath);
            console.log(`Deleted file from disk: ${docToDelete.filePath}`);
        }

        // 2. Remove from in-memory store
        delete documentsStore[id];

        // 3. Remove from metadata list
        documentMetadata.splice(index, 1);

        // 4. Update the "database"
        saveDocumentsToDisk();

        // If the deleted document was the active one, clear the active ID
        if (currentActiveDocumentId === id) {
            currentActiveDocumentId = null;
        }

        res.json({ message: `Document '${docToDelete.originalName}' deleted successfully.` });
    } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ error: "Failed to delete document." });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
