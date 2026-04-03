/**
 * PDF Processor Service - Handles PDF parsing and text extraction
 * Uses local pdfjs-dist (no CDN required)
 */

import * as pdfjsLib from 'pdfjs-dist';

// CRITICAL: Point to local worker file in /public folder
// Vite hashes worker files which breaks PDF.js - use static public asset instead
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Extract text content from a PDF file
 * @param {File|ArrayBuffer} input - PDF file or ArrayBuffer
 * @returns {Promise<{text: string, pageCount: number, pages: string[]}>}
 */
export async function extractTextFromPDF(input) {
  let arrayBuffer;
  
  if (input instanceof File) {
    arrayBuffer = await input.arrayBuffer();
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else {
    throw new Error('Input must be a File or ArrayBuffer');
  }
  
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    pages.push(pageText);
    fullText += pageText + '\n\n';
  }
  
  return {
    text: fullText.trim(),
    pageCount: pdf.numPages,
    pages
  };
}

/**
 * Get metadata from a PDF file
 * @param {File|ArrayBuffer} input - PDF file or ArrayBuffer
 * @returns {Promise<Object>} - PDF metadata
 */
export async function getPDFMetadata(input) {
  let arrayBuffer;
  
  if (input instanceof File) {
    arrayBuffer = await input.arrayBuffer();
  } else {
    arrayBuffer = input;
  }
  
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const metadata = await pdf.getMetadata();
  
  return {
    title: metadata.info?.Title || 'Unknown',
    author: metadata.info?.Author || 'Unknown',
    subject: metadata.info?.Subject || '',
    creator: metadata.info?.Creator || '',
    producer: metadata.info?.Producer || '',
    creationDate: metadata.info?.CreationDate || '',
    pageCount: pdf.numPages
  };
}

/**
 * Validate if a file is a valid PDF
 * @param {File} file - File to validate
 * @returns {Promise<boolean>}
 */
export async function isValidPDF(file) {
  if (!file) return false;
  
  // Check MIME type
  if (file.type !== 'application/pdf') {
    return false;
  }
  
  // Check file signature (magic bytes)
  try {
    const buffer = await file.slice(0, 5).arrayBuffer();
    const header = new Uint8Array(buffer);
    const signature = String.fromCharCode(...header);
    return signature === '%PDF-';
  } catch {
    return false;
  }
}
