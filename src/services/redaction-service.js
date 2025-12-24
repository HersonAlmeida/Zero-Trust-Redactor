/**
 * Redaction Service - Handles communication with Python backend
 * and coordinates the redaction workflow
 */

/**
 * Send PDF and sensitive words to Python backend for redaction
 * @param {File} file - Original PDF file
 * @param {string[]} sensitiveWords - Array of words to redact
 * @returns {Promise<Blob>} - Redacted PDF as Blob
 */
export async function redactPDF(file, sensitiveWords) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('words', sensitiveWords.join(','));
  
  // Use /api prefix for Vite proxy during development
  const apiUrl = import.meta.env.DEV ? '/api/redact' : '/redact';
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Redaction failed: ${errorText}`);
  }
  
  return await response.blob();
}

/**
 * Download a blob as a file
 * @param {Blob} blob - File blob to download
 * @param {string} filename - Name for the downloaded file
 */
export function downloadBlob(blob, filename = 'redacted_secure.pdf') {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Generate a PDF report of detected entities (using jsPDF)
 * @param {string[]} entities - List of detected entities
 * @param {Object} metadata - Document metadata
 * @returns {Promise<Blob>}
 */
export async function generateReport(entities, metadata = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Zero-Trust Redaction Report', 20, 20);
  
  // Timestamp
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
  
  // Document info
  if (metadata.filename) {
    doc.text(`Original File: ${metadata.filename}`, 20, 38);
  }
  
  // Divider
  doc.setDrawColor(16, 185, 129); // Accent green
  doc.line(20, 45, 190, 45);
  
  // Entities found
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Detected Sensitive Items:', 20, 55);
  
  doc.setFontSize(11);
  doc.setFont('courier', 'normal');
  
  let yPos = 65;
  entities.forEach((entity, index) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(`${index + 1}. ${entity}`, 25, yPos);
    yPos += 8;
  });
  
  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Processed locally - No data uploaded to cloud', 20, 285);
  
  return doc.output('blob');
}
