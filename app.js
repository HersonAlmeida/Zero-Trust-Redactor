// IMPORT LIBRARIES VIA CDN
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// CONFIGURATION
env.allowLocalModels = false; // Force download from HuggingFace
const LLAMA_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// STATE VARIABLES
let bertClassifier = null;
let llamaEngine = null;
let currentMode = 'fast';

// UI ELEMENTS
const statusBert = document.getElementById("bert-status");
const statusLlama = document.getElementById("llama-status");
const redactBtn = document.getElementById("btn-redact");
const inputText = document.getElementById("input-text");
const outputArea = document.getElementById("output-area");
const fileInput = document.getElementById("file-upload");

// --- 1. INITIALIZATION (Loads BERT Immediately) ---
(async function init() {
    try {
        console.log("Initializing BERT...");
        // Load the tiny BERT model for Named Entity Recognition (NER)
        bertClassifier = await pipeline('token-classification', 'Xenova/bert-base-NER', {
            quantized: true // Use the smaller version
        });
        
        statusBert.innerText = "🟢 Fast AI Ready";
        statusBert.className = "status-pill status-ready";
        redactBtn.disabled = false;
        console.log("BERT Loaded!");
    } catch (err) {
        console.error(err);
        statusBert.innerText = "❌ BERT Failed";
    }
})();

// --- 2. SWITCHING MODES ---
window.selectMode = async (mode, element) => {
    currentMode = mode;
    
    // Visual Update
    document.querySelectorAll('.switch-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    element.querySelector('input').checked = true;

    if (mode === 'deep') {
        if (!llamaEngine) {
            await loadLlama();
        }
    }
};

async function loadLlama() {
    statusLlama.innerText = "⏳ Downloading 1GB...";
    statusLlama.className = "status-pill status-loading";
    redactBtn.disabled = true;

    try {
        llamaEngine = await CreateMLCEngine(LLAMA_MODEL_ID, {
            initProgressCallback: (report) => {
                statusLlama.innerText = `Downloading... ${Math.round(report.text * 100)}%`;
            }
        });
        
        statusLlama.innerText = "🟢 Deep AI Ready";
        statusLlama.className = "status-pill status-ready";
        redactBtn.disabled = false;
    } catch (err) {
        console.error(err);
        statusLlama.innerText = "❌ Download Failed";
        alert("Could not load Llama 3. Your GPU might not be supported.");
    }
}

/// --- UPDATED HYBRID LOGIC ---
window.runRedaction = async () => {
    const text = inputText.value;
    const file = fileInput.files[0];
    
    if (!file) return alert("Please upload a PDF for this Layout-Preserving mode.");

    outputArea.innerText = "1. AI is analyzing text to find secrets...";

    // 1. USE LOCAL AI TO FIND THE WORDS (Not redact them, just find them)
    let badWords = [];
    
    if (currentMode === 'fast') {
        // Use BERT to find names/locations
        if (bertClassifier) {
            const output = await bertClassifier(text, { ignore_labels: [] });
            // Extract the actual words BERT found (e.g., "London", "John")
            badWords = output
                .filter(item => item.score > 0.85)
                .map(item => text.substring(item.index, item.index + item.word.length));
        }
        // Add Regex (Emails/Phones)
        const emails = text.match(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g) || [];
        const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];
        badWords = [...badWords, ...emails, ...phones];

    } else {
        // Use Llama (Deep Scan)
        // We ask Llama to just output a comma-separated list of secrets
        const prompt = `
            List all sensitive names, dates, and locations in the text below.
            Format: comma-separated list.
            Example: John Smith, London, 2025
            Text: "${text}"
        `;
        const reply = await llamaEngine.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
        });
        badWords = reply.choices[0].message.content.split(',');
    }

    // Clean up the list
    const uniqueWords = [...new Set(badWords.map(w => w.trim()))].join(',');
    
    outputArea.innerText = `2. Sending PDF to Local Python Core...\nRedacting: ${uniqueWords}`;

    // 2. SEND TO PYTHON SERVER
    const formData = new FormData();
    formData.append('file', file);
    formData.append('words', uniqueWords);

    try {
        const response = await fetch('/redact', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            // 3. DOWNLOAD THE RESULT
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "redacted_pro_layout.pdf";
            document.body.appendChild(a);
            a.click();
            outputArea.innerText = "✅ Success! PDF downloaded with original layout.";
        } else {
            outputArea.innerText = "❌ Server Error.";
        }
    } catch (err) {
        outputArea.innerText = "❌ Error: Ensure server.py is running.";
    }
};

// --- 4. UTILITIES ---
window.clearText = () => {
    inputText.value = "";
    outputArea.innerText = "Safe text will appear here...";
};

window.copyOutput = () => {
    const text = outputArea.innerText;
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
};

// PDF Reader Logic
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/pdf") {
        outputArea.innerText = "Reading PDF...";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(" ") + "\n";
        }
        inputText.value = fullText;
        outputArea.innerText = "PDF Loaded. Ready to redact.";
    } else {
        const text = await file.text();
        inputText.value = text;
    }
});
// --- 5. DOWNLOAD PDF LOGIC ---
window.downloadPDF = () => {
    const text = outputArea.innerText;
    if (!text || text.includes("Safe text will appear here")) {
        return alert("Nothing to download yet!");
    }

    // Access the jsPDF library
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Set font (Courier is good for "Redacted" look)
    doc.setFont("courier", "normal");
    doc.setFontSize(12);

    // 2. Wrap text so it doesn't go off the page
    // 180 is the width, 10,10 is the margin
    const splitText = doc.splitTextToSize(text, 180);

    // 3. Add text to page
    doc.text(splitText, 10, 10);

    // 4. Save the file
    doc.save("secure-redacted-document.pdf");
};