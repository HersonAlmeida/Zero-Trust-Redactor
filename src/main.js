/**
 * Zero-Trust Redactor Pro - Main Application Entry Point
 * A Localhost Privacy Suite for offline PII redaction
 * Professional UI v2.0
 */

import { initAllModels, initBert, initLlama, detectWithBert, detectWithLlama, getModelStatus, getModelSources, detectHardware, canUseProModel, upgradeToPro, getCurrentModelTier } from './services/ai-engine.js';
import { extractTextFromPDF, isValidPDF } from './services/pdf-processor.js';
import { redactPDF, downloadBlob, generateReport } from './services/redaction-service.js';
import {
  getPresets,
  scanWithIntel,
  loadCustomKeywords,
  saveCustomKeywords,
  loadActivePresets,
  saveActivePresets
} from './services/intel-database.js';
import * as pdfjsLib from 'pdfjs-dist';
// CSS is loaded directly in index.html to prevent FOUC (Flash of Unstyled Content)


// ============================================
// STATE
// ============================================
let currentMode = 'fast';
let currentDocType = 'auto'; // Document type for Intel Database
let currentFile = null;
let detectedEntities = [];
let manualEntities = [];
let customKeywords = loadCustomKeywords();
let activePresets = loadActivePresets();
let stats = { scanned: 0, entities: 0, redacted: 0 };

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
  // Loading overlay
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingFill: document.getElementById('loading-fill'),
  loadingText: document.getElementById('loading-text'),
  stepBert: document.getElementById('step-bert'),
  stepLlama: document.getElementById('step-llama'),
  stepReady: document.getElementById('step-ready'),

  // App container
  appContainer: document.getElementById('app-container'),

  // Status
  statusCard: document.getElementById('status-card'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  statusDetail: document.getElementById('status-detail'),

  // Stats
  statScanned: document.getElementById('stat-scanned'),
  statEntities: document.getElementById('stat-entities'),
  statRedacted: document.getElementById('stat-redacted'),

  // File handling
  dropZone: document.getElementById('drop-zone'),
  fileUpload: document.getElementById('file-upload'),
  fileInfo: document.getElementById('file-info'),

  // Editor
  inputText: document.getElementById('input-text'),
  outputArea: document.getElementById('output-area'),
  entitiesList: document.getElementById('entities-list'),
  entityCount: document.getElementById('entity-count'),

  // PDF Viewer
  pdfViewerContainer: document.getElementById('pdf-viewer-container'),
  textViewContainer: document.getElementById('text-view-container'),
  pdfViewport: document.getElementById('pdf-viewport'),
  pdfPages: document.getElementById('pdf-pages'),
  pdfZoomLevel: document.getElementById('pdf-zoom-level'),
  pdfPageInfo: document.getElementById('pdf-page-info'),
  viewToggle: document.getElementById('view-toggle'),

  // Buttons
  btnScan: document.getElementById('btn-scan'),
  btnRedact: document.getElementById('btn-redact'),
  btnReport: document.getElementById('btn-report'),

  // Mode options
  modeOptions: document.querySelectorAll('.mode-option'),

  // Toast & Tooltip
  toastContainer: document.getElementById('toast-container'),
  selectionTooltip: document.getElementById('selection-tooltip'),

  // Text overlay for highlighting
  textOverlay: document.getElementById('text-overlay')
};

// PDF Viewer State
let pdfDocument = null;
let pdfZoom = 1.0;
let currentView = 'pdf';
let currentPdfPage = 1; // Track current page for single-page view

const DEBUG_LOGS = false;
const logDebug = (...args) => { if (DEBUG_LOGS) console.log(...args); };

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S = Scan
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentFile && !elements.btnScan?.disabled) {
        window.runScan();
      }
    }
    // Ctrl+R or Cmd+R = Redact (prevent page reload)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      if (currentFile && !elements.btnRedact?.disabled) {
        window.runRedaction();
      }
    }
    // Ctrl+P = Preview
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      if (detectedEntities.length > 0 || manualEntities.length > 0) {
        window.showPreviewModal();
      }
    }
    // Escape = Close modals/tooltips
    if (e.key === 'Escape') {
      elements.selectionTooltip?.classList.add('hidden');
      document.getElementById('preview-modal')?.classList.add('hidden');
    }
    // Ctrl+Z = Undo last manual entity
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (manualEntities.length > 0) {
        e.preventDefault();
        const removed = manualEntities.pop();
        displayEntities();
        if (currentView === 'pdf' && pdfDocument) reRenderPDF();
        showToast('info', 'Undone', `Removed "${removed.substring(0, 20)}..."`);
      }
    }
  });

  logDebug('⌨️ Keyboard shortcuts enabled: Ctrl+S (Scan), Ctrl+R (Redact), Ctrl+P (Preview), Ctrl+Z (Undo)');
}

// ============================================
// INITIALIZATION
// ============================================
async function initialize() {
  console.log('🚀 initialize() called');
  setupKeyboardShortcuts();
  updateLoadingStep('bert', 'active');

  try {
    console.log('🔄 Calling initAllModels...');
    const result = await initAllModels((progress) => {
      // Update loading bar
      if (elements.loadingFill) {
        elements.loadingFill.style.width = `${progress.combined}%`;
      }
      if (elements.loadingText) {
        elements.loadingText.textContent = `Initializing Privacy Engine... ${progress.combined}%`;
      }

      // Update steps
      if (progress.bert >= 100) {
        updateLoadingStep('bert', 'complete');
        updateLoadingStep('llama', 'active');
      }
      if (progress.llama >= 100) {
        updateLoadingStep('llama', 'complete');
      }
    });

    // Check if Llama was loaded
    const status = getModelStatus();

    // Update model status display in sidebar
    updateModelStatusDisplay();

    // Check if hardware supports Pro model upgrade
    checkAndShowUpgradeOption();

    if (status.llama) {
      updateLoadingStep('llama', 'complete');
      updateLoadingStep('ready', 'complete');
      await delay(500);
      hideLoading();
      updateStatus('ready', 'System Secure', 'All AI models loaded');
      showToast('success', 'Ready', 'BERT + Llama models loaded');
    } else {
      // BERT only mode
      updateLoadingStep('llama', 'error');
      updateLoadingStep('ready', 'complete');
      await delay(500);
      hideLoading();
      updateStatus('partial', 'Fast Mode Only', 'WebGPU not available for Deep Scan');
      showToast('warning', 'Limited Mode', 'Deep Scan unavailable - using Fast Mode');

      // Disable deep mode option
      const deepOption = document.querySelector('.mode-option[data-mode="deep"]');
      if (deepOption) {
        deepOption.classList.add('disabled');
        deepOption.title = 'Requires WebGPU support';
      }
    }

    elements.btnRedact.disabled = false;

  } catch (error) {
    console.error('Initialization failed:', error);
    updateLoadingStep('bert', 'error');
    updateLoadingStep('llama', 'error');

    // Show offline fallback option
    if (elements.loadingText) {
      elements.loadingText.innerHTML = `
        <span style="color: #ef4444;">Failed to load AI models</span><br>
        <small style="color: #a1a1aa;">${error.message}</small><br><br>
        <button onclick="window.retryInit()" style="padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px;">
          🔄 Retry
        </button>
        <button onclick="window.downloadModels()" style="padding: 8px 16px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px;">
          ⬇️ Download BERT (50MB)
        </button>
        <button onclick="window.useOfflineMode()" style="padding: 8px 16px; background: #374151; color: white; border: none; border-radius: 6px; cursor: pointer;">
          📴 Use Offline Mode (Patterns Only)
        </button>
      `;
    }
  }
}

// Retry initialization
window.retryInit = async function () {
  if (elements.loadingText) {
    elements.loadingText.textContent = 'Retrying...';
  }
  if (elements.loadingFill) {
    elements.loadingFill.style.width = '0%';
  }
  updateLoadingStep('bert', 'active');
  updateLoadingStep('llama', '');
  updateLoadingStep('ready', '');
  await initialize();
};

// Download models (consented) via backend helper
window.downloadModels = async function () {
  try {
    updateStatus('loading', 'Downloading models', 'Fetching BERT locally...');
    const res = await fetch('/api/download-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'bert' })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Download failed');
    }
    showToast('success', 'Models downloaded', 'BERT model cached locally. Initializing...');
    await delay(300);
    await initialize();
  } catch (e) {
    showToast('error', 'Download failed', e.message || 'Unable to download models');
    updateStatus('error', 'Download failed', e.message || 'Check your connection');
  }
};

// Offline mode - use only Intel Database patterns
window.useOfflineMode = function () {
  hideLoading();
  updateStatus('partial', 'Offline Mode', 'Using pattern-based detection only');
  showToast('warning', 'Offline Mode', 'AI disabled. Using Intel Database patterns only.');

  // Mark deep mode as unavailable
  const deepOption = document.querySelector('.mode-option[data-mode="deep"]');
  if (deepOption) {
    deepOption.classList.add('disabled');
    deepOption.title = 'AI models not loaded';
  }

  // Override scan to use patterns only
  window.offlineMode = true;
}

function updateLoadingStep(step, state) {
  const stepEl = elements[`step${step.charAt(0).toUpperCase() + step.slice(1)}`];
  if (!stepEl) return;

  stepEl.classList.remove('active', 'complete', 'error');
  if (state) stepEl.classList.add(state);
}

function hideLoading() {
  elements.loadingOverlay?.classList.add('hidden');
  elements.appContainer?.classList.add('visible');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// STATUS & UI UPDATES
// ============================================
function updateStatus(state, text, detail) {
  const { statusCard, statusDot, statusText, statusDetail } = elements;

  statusCard?.classList.remove('ready', 'error', 'partial');
  statusDot?.classList.remove('ready', 'error');

  if (state === 'ready') {
    statusCard?.classList.add('ready');
    statusDot?.classList.add('ready');
  } else if (state === 'error') {
    statusCard?.classList.add('error');
    statusDot?.classList.add('error');
  }

  if (statusText) statusText.textContent = text;
  if (statusDetail) statusDetail.textContent = detail;
}

function updateStats() {
  if (elements.statScanned) elements.statScanned.textContent = stats.scanned;
  if (elements.statEntities) elements.statEntities.textContent = stats.entities;
  if (elements.statRedacted) elements.statRedacted.textContent = stats.redacted;
}

function updateEntityCount() {
  const total = detectedEntities.length + manualEntities.length;
  if (elements.entityCount) elements.entityCount.textContent = total;
  stats.entities = total;
  updateStats();
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(type, title, message, duration = 4000) {
  const container = elements.toastContainer;
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// MODE SELECTION
// ============================================
window.setMode = async function (mode, element) {
  currentMode = mode;

  elements.modeOptions.forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  if (mode === 'deep') {
    const status = getModelStatus();
    if (!status.llama) {
      updateStatus('loading', 'Loading Deep Scan...', 'Downloading Llama 3 model');
      elements.btnRedact.disabled = true;

      try {
        await initLlama((progress) => {
          updateStatus('loading', 'Loading Deep Scan...', `${progress.progress}% complete`);
        });
        updateStatus('ready', 'System Secure', 'Deep scan ready');
        elements.btnRedact.disabled = false;
        showToast('success', 'Deep Scan Ready', 'Llama 3 model loaded successfully');
      } catch (error) {
        updateStatus('partial', 'Fast Mode Only', 'Deep scan unavailable');
        currentMode = 'fast';
        document.querySelector('.mode-option[data-mode="fast"]')?.classList.add('active');
        element.classList.remove('active');
        showToast('error', 'Load Failed', 'Could not load Llama 3 model');
      }
    }
  }
};

// ============================================
// DOCUMENT TYPE SELECTION (Intel Database)
// ============================================
window.setDocumentType = function (docType) {
  currentDocType = docType;

  const infoEl = document.getElementById('doc-type-info');
  if (infoEl) {
    if (docType === 'auto') {
      infoEl.classList.remove('active');
      infoEl.querySelector('.info-text').textContent = 'Improves detection accuracy';
    } else {
      infoEl.classList.add('active');
      const preset = getPresets()[docType];
      const patternCount = preset?.patterns?.length || 0;
      const keywordCount = preset?.keywords?.length || 0;
      infoEl.querySelector('.info-text').textContent = `+${patternCount} patterns, +${keywordCount} keywords`;
    }
  }

  logDebug(`📋 Document type set to: ${docType}`);
};

// ============================================
// FILE HANDLING
// ============================================
function setupFileHandlers() {
  const { dropZone, fileUpload, inputText } = elements;

  // File input change
  fileUpload?.addEventListener('change', handleFileSelect);

  // Click browse link or drop zone to upload
  const browseLink = document.querySelector('.browse-link');
  browseLink?.addEventListener('click', () => fileUpload?.click());

  dropZone?.addEventListener('click', (e) => {
    // Only trigger if clicking the drop zone itself, not file info
    if (e.target.closest('.browse-link') || e.target === dropZone || e.target.closest('.drop-content')) {
      fileUpload?.click();
    }
  });

  // Drag and drop
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  });

  // Text selection for text area - also listen for keyboard selection
  inputText?.addEventListener('mouseup', handleTextSelection);
  inputText?.addEventListener('keyup', (e) => {
    // Check for selection after keyboard navigation (Shift+Arrow, Ctrl+Shift+Arrow, etc.)
    if (e.shiftKey || e.key === 'Shift') {
      handleTextSelection();
    }
  });

  // Text selection for PDF viewer - use document level for better capture
  let selectionTimeout = null;
  document.addEventListener('mouseup', (e) => {
    // Check if selection is within PDF viewer
    if (e.target.closest('.pdf-text-layer') || e.target.closest('#pdf-pages')) {
      // Clear any pending selection timeout
      if (selectionTimeout) clearTimeout(selectionTimeout);

      // Use longer delay for more stable selection capture
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const selectedText = selection.toString().trim();
        if (selectedText && selectedText.length > 1) {
          // Validate selection is still within PDF area
          try {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const parent = container.nodeType === 3 ? container.parentElement : container;
            if (parent && (parent.closest('.pdf-text-layer') || parent.closest('#pdf-pages'))) {
              showSelectionTooltip(selectedText, selection, 'pdf');
            }
          } catch (err) {
            console.warn('Selection validation error:', err);
          }
        }
      }, 50); // Longer delay for more stable selection
    }
  });

  // Hide tooltip on scroll and sync overlay scroll
  inputText?.addEventListener('scroll', () => {
    elements.selectionTooltip?.classList.add('hidden');
    // Sync overlay scroll with textarea
    if (elements.textOverlay) {
      elements.textOverlay.scrollTop = inputText.scrollTop;
      elements.textOverlay.scrollLeft = inputText.scrollLeft;
    }
  });

  // Hide tooltip when clicking elsewhere (but not in text areas where selection happens)
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.selection-tooltip') &&
      !e.target.closest('.pdf-text-layer') &&
      !e.target.closest('#input-text') &&
      !e.target.closest('.textarea-wrapper')) {
      elements.selectionTooltip?.classList.add('hidden');
    }
  });
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) await processFile(file);
}

async function processFile(file) {
  const { inputText, fileInfo, dropZone } = elements;

  // Update file info display
  fileInfo.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span>${file.name}</span>
  `;
  fileInfo.classList.add('has-file');
  dropZone?.classList.add('has-file');

  if (file.type === 'application/pdf') {
    if (!await isValidPDF(file)) {
      showToast('error', 'Invalid File', 'The file does not appear to be a valid PDF');
      return;
    }

    showToast('info', 'Processing', 'Loading PDF...');
    currentFile = file;

    try {
      // Extract text for scanning
      const { text, pageCount } = await extractTextFromPDF(file);
      inputText.value = text;

      // Render PDF visually
      await renderPDF(file);

      // Switch to PDF view
      switchView('pdf');

      stats.scanned++;
      updateStats();
      showToast('success', 'PDF Loaded', `${pageCount} page${pageCount > 1 ? 's' : ''} ready for review`);
    } catch (error) {
      showToast('error', 'Read Error', error.message);
      console.error(error);
    }
  } else {
    // Text file - show text view
    currentFile = file;
    pdfDocument = null;
    const text = await file.text();
    inputText.value = text;
    switchView('text');
    stats.scanned++;
    updateStats();
    showToast('success', 'File Loaded', 'Text file loaded successfully');
  }
}

// ============================================
// PDF VIEWER
// ============================================
async function renderPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pagesContainer = elements.pdfPages;
  pagesContainer.innerHTML = '';

  // Reset to first page and render only that page (single-page view)
  currentPdfPage = 1;
  await renderPage(currentPdfPage);

  updatePdfInfo();
}

async function renderPage(pageNum) {
  const page = await pdfDocument.getPage(pageNum);
  const scale = pdfZoom * 1.5; // Base scale for readability
  const viewport = page.getViewport({ scale });

  // Create page wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-page-wrapper';
  wrapper.dataset.page = pageNum;

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  wrapper.appendChild(canvas);

  // Create text layer for selection
  const textLayer = document.createElement('div');
  textLayer.className = 'pdf-text-layer';
  textLayer.style.width = `${viewport.width}px`;
  textLayer.style.height = `${viewport.height}px`;

  const textContent = await page.getTextContent();

  // Render text spans for selection
  textContent.items.forEach(item => {
    const span = document.createElement('span');
    span.textContent = item.str;

    // Position the text
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - item.height * scale}px`;
    span.style.fontSize = `${item.height * scale}px`;
    span.style.fontFamily = item.fontName || 'sans-serif';

    // Check if this text matches any detected entities
    const text = item.str.trim();
    if (text.length > 0) {
      // Normalize for case-insensitive matching
      const textLower = text.toLowerCase();

      // Check manual entities first (green) - case insensitive
      const matchesManual = manualEntities.some(e => {
        const entityLower = e.toLowerCase();
        // Match if this text item is part of the entity
        return textLower.includes(entityLower) ||
          entityLower.includes(textLower) ||
          // Check if entity contains this as a word
          entityLower.split(/\s+/).some(word => word === textLower || textLower.includes(word));
      });

      if (matchesManual) {
        span.classList.add('highlight-manual');
      }
      // Check detected entities (red) - handle both string and object formats
      else {
        const matchesDetected = detectedEntities.some(e => {
          const entityText = typeof e === 'object' ? e.text : e;
          const entityLower = entityText.toLowerCase();
          // Match if this text item is part of the entity
          return textLower.includes(entityLower) ||
            entityLower.includes(textLower) ||
            // Check if entity contains this as a word  
            entityLower.split(/\s+/).some(word => word === textLower || textLower.includes(word));
        });

        if (matchesDetected) {
          span.classList.add('highlight-entity');
        }
      }
    }

    textLayer.appendChild(span);
  });

  wrapper.appendChild(textLayer);
  elements.pdfPages.appendChild(wrapper);
}

async function reRenderPDF() {
  if (!pdfDocument) return;

  const pagesContainer = elements.pdfPages;
  pagesContainer.innerHTML = '';

  // Render only the current page (single-page view)
  await renderPage(currentPdfPage);

  updatePdfInfo();
}

function updatePdfInfo() {
  if (!pdfDocument) return;

  if (elements.pdfZoomLevel) {
    elements.pdfZoomLevel.textContent = `${Math.round(pdfZoom * 100)}%`;
  }

  // Update page info with current page indicator
  updateCurrentPageIndicator();
}

// Get current page number based on scroll position
function getCurrentPageNumber() {
  const viewport = elements.pdfViewport;
  if (!viewport || !pdfDocument) return 1;

  const scrollTop = viewport.scrollTop;
  const pageWrappers = viewport.querySelectorAll('.pdf-page-wrapper');

  if (pageWrappers.length === 0) return 1;

  // Find which page is currently in view (top of viewport)
  for (let i = 0; i < pageWrappers.length; i++) {
    const wrapper = pageWrappers[i];
    const wrapperTop = wrapper.offsetTop;
    const wrapperBottom = wrapperTop + wrapper.offsetHeight;

    // If this page contains the scroll position
    if (scrollTop >= wrapperTop && scrollTop < wrapperBottom) {
      return i + 1;
    }
  }

  // If scrolled past all pages, return last page
  if (scrollTop >= pageWrappers[pageWrappers.length - 1].offsetTop) {
    return pdfDocument.numPages;
  }

  return 1;
}

// Update the page indicator with current page
function updateCurrentPageIndicator() {
  if (!pdfDocument || !elements.pdfPageInfo) return;

  elements.pdfPageInfo.textContent = `Page ${currentPdfPage} of ${pdfDocument.numPages}`;
}

// Setup scroll listener for page indicator
function setupPdfScrollListener() {
  const viewport = elements.pdfViewport;
  if (!viewport) return;

  // Debounced scroll handler for performance
  let scrollTimeout;
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      updateCurrentPageIndicator();
    }, 100); // Update after 100ms of no scrolling
  });
}

// PDF Controls
window.switchView = function (view) {
  currentView = view;

  const pdfContainer = elements.pdfViewerContainer;
  const textContainer = elements.textViewContainer;
  const viewBtns = document.querySelectorAll('.view-btn');

  viewBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'pdf') {
    pdfContainer?.classList.remove('hidden');
    textContainer?.classList.add('hidden');

    // Re-render PDF to show current highlights (manual entities added in text mode)
    if (pdfDocument && (detectedEntities.length > 0 || manualEntities.length > 0)) {
      reRenderPDF();
    }
  } else {
    pdfContainer?.classList.add('hidden');
    textContainer?.classList.remove('hidden');

    // Update text highlights when switching to text view
    highlightEntitiesInText();
  }
};

window.pdfZoomIn = function () {
  if (pdfZoom < 3) {
    pdfZoom += 0.25;
    reRenderPDF();
  }
};

window.pdfZoomOut = function () {
  if (pdfZoom > 0.5) {
    pdfZoom -= 0.25;
    reRenderPDF();
  }
};

window.pdfPrevPage = function () {
  if (!pdfDocument) return;

  if (currentPdfPage > 1) {
    currentPdfPage--;
    reRenderPDF();
  }
};

window.pdfNextPage = function () {
  if (!pdfDocument) return;

  if (currentPdfPage < pdfDocument.numPages) {
    currentPdfPage++;
    reRenderPDF();
  }
};

// Keyboard navigation for PDF
function setupPdfKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    // Only handle shortcuts when in PDF view
    if (currentView !== 'pdf' || !pdfDocument) return;

    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'PageDown':
      case 'ArrowRight':
        e.preventDefault();
        pdfNextPage();
        break;

      case 'PageUp':
      case 'ArrowLeft':
        e.preventDefault();
        pdfPrevPage();
        break;

      case 'Home':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          currentPdfPage = 1;
          reRenderPDF();
        }
        break;

      case 'End':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          currentPdfPage = pdfDocument.numPages;
          reRenderPDF();
        }
        break;
    }
  });
}
// ============================================
// TEXT SELECTION & MANUAL ENTITIES
// ============================================
function handleTextSelection(e) {
  let selectedText = '';
  let selectionSource = null;

  // Check if selection is from textarea (text view)
  const textarea = elements.inputText;
  if (textarea && document.activeElement === textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      selectedText = textarea.value.substring(start, end).trim();
      selectionSource = 'textarea';
    }
  } else {
    // Use window.getSelection for non-textarea elements (PDF view, etc.)
    const selection = window.getSelection();
    selectedText = selection?.toString().trim() || '';
    selectionSource = 'window';
  }

  if (selectedText && selectedText.length > 1) {
    showSelectionTooltip(selectedText, selectionSource === 'textarea' ? null : window.getSelection(), selectionSource);
  } else {
    elements.selectionTooltip?.classList.add('hidden');
  }
}

function showSelectionTooltip(text, selection, source = 'window') {
  const tooltip = elements.selectionTooltip;
  if (!tooltip) return;

  try {
    let rect;

    if (source === 'textarea') {
      // For textarea, position near the textarea itself
      const textarea = elements.inputText;
      if (!textarea) return;

      // Get textarea bounding rect and estimate position
      const textareaRect = textarea.getBoundingClientRect();

      // Create a rough position based on cursor location in textarea
      // We'll position it near the middle-right of the visible textarea area
      rect = {
        left: textareaRect.left + textareaRect.width / 2,
        right: textareaRect.left + textareaRect.width / 2 + 100,
        top: textareaRect.top + 100,
        bottom: textareaRect.top + 120,
        width: 100,
        height: 20
      };
    } else {
      // For window selection (PDF view), use range
      const range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();

      // Make sure rect is valid
      if (rect.width === 0 && rect.height === 0) return;
    }

    tooltip.querySelector('.tooltip-text').textContent =
      `"${text.substring(0, 25)}${text.length > 25 ? '...' : ''}"`;

    const addBtn = tooltip.querySelector('.tooltip-add');
    addBtn.onclick = () => {
      addManualEntity(text);
      tooltip.classList.add('hidden');
      if (source !== 'textarea') {
        window.getSelection().removeAllRanges(); // Clear selection
      }
    };

    tooltip.classList.remove('hidden');

    // Calculate position - keep tooltip in viewport
    let left = rect.left + (rect.width / 2) - 100; // Center tooltip
    let top = rect.bottom + 8;

    // Keep in viewport
    const tooltipWidth = 220;
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }

    // If tooltip would go below viewport, show above selection
    if (top + 60 > window.innerHeight) {
      top = rect.top - 50;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  } catch (e) {
    console.warn('Could not position tooltip:', e);
  }
}

function addManualEntity(text) {
  if (!manualEntities.includes(text)) {
    manualEntities.push(text);
    displayEntities();

    // Re-render PDF to show highlights
    if (currentView === 'pdf' && pdfDocument) {
      reRenderPDF();
    }

    showToast('success', 'Target Added', `"${text.substring(0, 20)}..." added to targets`);
  }
}

window.removeEntity = function (index, type) {
  if (type === 'auto') {
    detectedEntities.splice(index, 1);
  } else {
    manualEntities.splice(index, 1);
  }
  displayEntities();
  updateEntityCount();

  // Always re-render PDF to update highlights (not just when viewing PDF)
  if (pdfDocument) {
    reRenderPDF();
  }

  // Also update text view highlights
  highlightEntitiesInText();
};

// ============================================
// ENTITY DISPLAY
// ============================================

// Highlight entities in the text view overlay
function highlightEntitiesInText() {
  const overlay = elements.textOverlay;
  const textarea = elements.inputText;

  if (!overlay || !textarea) return;

  const text = textarea.value;
  if (!text) {
    overlay.innerHTML = '';
    return;
  }

  // Collect all entities to highlight
  const allEntities = [
    ...detectedEntities.map(e => ({
      text: typeof e === 'object' ? e.text : e,
      type: 'auto'
    })),
    ...manualEntities.map(e => ({ text: e, type: 'manual' }))
  ];

  if (allEntities.length === 0) {
    overlay.innerHTML = '';
    return;
  }

  // Create highlighted HTML
  let highlightedHtml = escapeHtml(text);

  // Sort by length (longest first) to avoid partial matches
  allEntities.sort((a, b) => b.text.length - a.text.length);

  allEntities.forEach(entity => {
    const escapedEntity = escapeHtml(entity.text);
    const regex = new RegExp(escapeRegex(escapedEntity), 'gi');
    const highlightClass = entity.type === 'manual' ? 'text-highlight-manual' : 'text-highlight-auto';
    highlightedHtml = highlightedHtml.replace(regex, `<mark class="${highlightClass}">${escapedEntity}</mark>`);
  });

  // Preserve whitespace and line breaks
  highlightedHtml = highlightedHtml.replace(/\n/g, '<br>');

  overlay.innerHTML = highlightedHtml;

  // Sync scroll position
  overlay.scrollTop = textarea.scrollTop;
  overlay.scrollLeft = textarea.scrollLeft;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pagination state
let currentEntityPage = 1;
const ENTITIES_PER_PAGE = 17;

// Search filter state
let entitySearchQuery = '';

function displayEntities(searchQuery = entitySearchQuery) {
  const list = elements.entitiesList;
  if (!list) return;

  // Handle both old format (string[]) and new format (object[])
  const allEntities = [
    ...detectedEntities.map((e, i) => {
      const isObj = typeof e === 'object';
      return {
        text: isObj ? e.text : e,
        score: isObj ? e.score : null,
        source: isObj ? e.source : 'ai',
        entityType: isObj ? e.type : 'unknown',
        type: 'auto',
        index: i
      };
    }),
    ...manualEntities.map((e, i) => ({ text: e, type: 'manual', score: 1.0, source: 'manual', index: i }))
  ];

  updateEntityCount();

  if (allEntities.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>No targets detected yet</p>
        <small>Upload a document and run scan</small>
      </div>
    `;
    return;
  }

  // Apply search filter (case-insensitive)
  let filteredEntities = allEntities;
  if (searchQuery.trim()) {
    const queryLower = searchQuery.toLowerCase();
    filteredEntities = allEntities.filter(entity =>
      entity.text.toLowerCase().includes(queryLower)
    );

    // If no matches, show message
    if (filteredEntities.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>No matches found</p>
          <small>Try a different search term</small>
        </div>
      `;
      return;
    }
  }

  // Sort by confidence score (highest first)
  filteredEntities.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Calculate pagination based on filtered results
  const totalPages = Math.ceil(filteredEntities.length / ENTITIES_PER_PAGE);

  // Reset to page 1 if current page is out of bounds
  if (currentEntityPage > totalPages) {
    currentEntityPage = 1;
  }

  const startIndex = (currentEntityPage - 1) * ENTITIES_PER_PAGE;
  const endIndex = Math.min(startIndex + ENTITIES_PER_PAGE, filteredEntities.length);
  const paginatedEntities = filteredEntities.slice(startIndex, endIndex);

  // Generate entity list HTML with search highlighting
  const entitiesHtml = paginatedEntities.map(({ text, type, index, score, source, entityType }) => {
    const confidenceClass = score >= 0.9 ? 'high' : score >= 0.7 ? 'medium' : 'low';
    const confidencePercent = score ? Math.round(score * 100) : '—';
    const sourceIcon = source === 'bert' ? '🤖' : source === 'regex' ? '🔍' : source === 'heuristic' ? '📝' : source === 'manual' ? '✋' : '📋';

    // Highlight search query in text
    let displayText = escapeHtml(text);
    if (searchQuery.trim()) {
      const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
      displayText = displayText.replace(regex, '<mark>$1</mark>');
    }

    return `
      <div class="entity-item">
        <div class="entity-main">
          <span class="entity-text">${displayText}</span>
          <div class="entity-meta">
            <span class="entity-tag ${type}">${type === 'auto' ? entityType || 'AI' : 'Manual'}</span>
            ${score ? `<span class="confidence-badge ${confidenceClass}" title="Confidence: ${confidencePercent}%">${confidencePercent}%</span>` : ''}
            <span class="source-icon" title="Source: ${source}">${sourceIcon}</span>
          </div>
        </div>
        <button class="entity-remove" onclick="removeEntity(${index}, '${type}')" title="Remove">×</button>
      </div>
    `;
  }).join('');

  // Generate pagination controls (only if more than one page)
  const paginationHtml = totalPages > 1 ? `
    <div class="entity-pagination">
      <button 
        class="pagination-btn" 
        onclick="changeEntityPage(${currentEntityPage - 1})"
        ${currentEntityPage === 1 ? 'disabled' : ''}
        title="Previous page">
        ‹
      </button>
      <span class="pagination-info">
        Page ${currentEntityPage} of ${totalPages} 
        <small>(${startIndex + 1}-${endIndex} of ${filteredEntities.length}${searchQuery.trim() ? ' filtered' : ''})</small>
      </span>
      <button 
        class="pagination-btn" 
        onclick="changeEntityPage(${currentEntityPage + 1})"
        ${currentEntityPage === totalPages ? 'disabled' : ''}
        title="Next page">
        ›
      </button>
    </div>
  ` : '';

  list.innerHTML = entitiesHtml + paginationHtml;

  // Also update text view highlights
  highlightEntitiesInText();
}

// Filter entities based on search query
window.filterEntities = function (query) {
  entitySearchQuery = query;
  currentEntityPage = 1; // Reset to first page when filtering
  displayEntities(query);
}

// Clear entity search
window.clearEntitySearch = function () {
  const searchInput = document.getElementById('entity-search');
  if (searchInput) {
    searchInput.value = '';
  }
  entitySearchQuery = '';
  currentEntityPage = 1;
  displayEntities('');
}


// Manual refresh function
window.refreshEntityList = function () {
  // Force re-render of entity list
  displayEntities();

  // Re-render PDF highlights
  if (currentView === 'pdf' && pdfDocument) {
    reRenderPDF();
  }

  // Update text highlights
  highlightEntitiesInText();

  // Show toast
  showToast('success', 'Refreshed', 'Entity list and highlights updated');
}

// Change entity list page
window.changeEntityPage = function (newPage) {
  const totalEntities = detectedEntities.length + manualEntities.length;
  const totalPages = Math.ceil(totalEntities / ENTITIES_PER_PAGE);

  if (newPage < 1 || newPage > totalPages) return;

  currentEntityPage = newPage;
  displayEntities();
}

// ============================================
// SCAN FUNCTION
// ============================================
window.runScan = async function () {
  const text = elements.inputText?.value;

  if (!text?.trim()) {
    showToast('warning', 'No Content', 'Please upload a document or paste text first');
    return;
  }

  const btn = elements.btnScan;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    <span>Scanning...</span>
  `;
  btn.disabled = true;

  // Reset pagination to first page
  currentEntityPage = 1;

  try {
    // Determine which presets to use based on document type selection
    let presetsToUse = activePresets;
    if (currentDocType && currentDocType !== 'auto') {
      // Use the selected document type preset
      presetsToUse = [currentDocType];
      logDebug(`📋 Using document type: ${currentDocType}`);
    }

    // Start with Intel Database patterns (fast regex-based detection)
    let intelFindings = [];
    if (presetsToUse.length > 0 || customKeywords.length > 0) {
      showToast('info', 'Intel Scan', 'Applying pattern-based detection...');
      intelFindings = scanWithIntel(text, presetsToUse, customKeywords);
      logDebug(`📋 Intel Database found ${intelFindings.length} matches`);
    }

    // Check for offline mode
    if (window.offlineMode) {
      // Offline mode - patterns only
      detectedEntities = intelFindings.map(f => ({ text: f, score: 0.9, type: 'pattern', source: 'intel' }));
    } else {
      // Then run AI detection
      let aiFindings = [];
      if (currentMode === 'fast') {
        aiFindings = await detectWithBert(text);
      } else {
        aiFindings = await detectWithLlama(text);
      }
      logDebug(`🤖 AI found ${aiFindings.length} matches`);

      // Combine results - Intel findings as objects too
      const intelObjects = intelFindings.map(f => ({ text: f, score: 0.9, type: 'pattern', source: 'intel' }));

      // Enhanced deduplication with case-insensitive matching and filtering
      const seen = new Map(); // Use Map to track normalized text -> original entity
      const combined = [...aiFindings, ...intelObjects].filter(e => {
        const text = typeof e === 'string' ? e : e.text;

        // Filter out very short entities (likely false positives from visual detection)
        if (text.trim().length <= 2) {
          return false;
        }

        // Normalize: lowercase + collapse whitespace
        const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');

        // Check if we've seen this normalized version
        if (seen.has(normalized)) {
          return false; // Duplicate
        }

        seen.set(normalized, text);
        return true;
      });

      detectedEntities = combined;
    }

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      displayEntities();

      // Re-render PDF to show highlights
      if (currentView === 'pdf' && pdfDocument) {
        reRenderPDF();
      }
    }, 100);

    // Show results with Intel Database info
    if (detectedEntities.length === 0) {
      showToast('success', 'Scan Complete', 'No sensitive data detected');
    } else {
      const aiCount = detectedEntities.filter(e => e.source !== 'intel').length;
      const intelCount = detectedEntities.filter(e => e.source === 'intel').length;
      let message = `Found ${detectedEntities.length} targets`;
      if (intelCount > 0) {
        message += ` (${aiCount} AI, ${intelCount} pattern)`;
      }
      showToast('success', 'Scan Complete', message);
      elements.btnRedact.disabled = false;
    }

  } catch (error) {
    showToast('error', 'Scan Failed', error.message);
    console.error(error);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
};

// ============================================
// REDACTION
// ============================================
window.runRedaction = async function () {
  // Convert entities to text strings (handle both object and string formats)
  const detectedTexts = detectedEntities.map(e => typeof e === 'object' ? e.text : e);
  const allEntityTexts = [...new Set([...detectedTexts, ...manualEntities])];

  if (!currentFile) {
    showToast('warning', 'No File', 'Please upload a PDF file first');
    return;
  }

  if (allEntityTexts.length === 0) {
    showToast('warning', 'No Targets', 'Run a scan first to detect sensitive data');
    return;
  }

  const btn = elements.btnRedact;
  btn.classList.add('processing');
  btn.disabled = true;

  try {
    showToast('info', 'Processing', 'Applying redactions to PDF...');

    const redactedBlob = await redactPDF(currentFile, allEntityTexts);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadBlob(redactedBlob, `redacted_${timestamp}.pdf`);

    stats.redacted += allEntityTexts.length;
    updateStats();

    showToast('success', 'Complete!', `Redacted ${allEntityTexts.length} items. PDF downloaded.`);

  } catch (error) {
    showToast('error', 'Redaction Failed', error.message);
    console.error(error);
  } finally {
    btn.classList.remove('processing');
    btn.disabled = false;
  }
};

// ============================================
// REPORT GENERATION
// ============================================
window.generateRedactionReport = async function () {
  const allEntities = [...detectedEntities, ...manualEntities];

  if (allEntities.length === 0) {
    showToast('warning', 'No Data', 'Run a scan first to generate a report');
    return;
  }

  try {
    // Convert to text array for report
    const entityTexts = allEntities.map(e => typeof e === 'object' ? e.text : e);
    const reportBlob = await generateReport(entityTexts, {
      filename: currentFile?.name || 'Unknown'
    });
    downloadBlob(reportBlob, `redaction_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('success', 'Report Generated', 'Detection report downloaded');
  } catch (error) {
    showToast('error', 'Report Failed', error.message);
  }
};

// ============================================
// PREVIEW MODAL
// ============================================
window.showPreviewModal = function () {
  const allEntities = [...detectedEntities, ...manualEntities];
  if (allEntities.length === 0) {
    showToast('warning', 'No Targets', 'Run a scan first to preview');
    return;
  }

  const text = elements.inputText?.value || '';
  if (!text) {
    showToast('warning', 'No Content', 'Upload a document first');
    return;
  }

  // Get entity texts
  const entityTexts = allEntities.map(e => typeof e === 'object' ? e.text : e);

  // Create preview with highlights
  let originalHtml = escapeHtml(text);
  let redactedText = text;

  // Sort by length (longest first) to avoid partial replacements
  const sortedEntities = [...entityTexts].sort((a, b) => b.length - a.length);

  sortedEntities.forEach(entity => {
    const escaped = escapeHtml(entity);
    const regex = new RegExp(escapeRegex(escaped), 'gi');
    originalHtml = originalHtml.replace(regex, `<mark class="highlight-preview">${escaped}</mark>`);

    // For redacted version, replace with black boxes
    const redactRegex = new RegExp(escapeRegex(entity), 'gi');
    redactedText = redactedText.replace(redactRegex, '█'.repeat(Math.min(entity.length, 20)));
  });

  // Update modal content
  const originalEl = document.getElementById('preview-original');
  const redactedEl = document.getElementById('preview-redacted');
  const countEl = document.getElementById('preview-count');

  if (originalEl) originalEl.innerHTML = originalHtml.substring(0, 5000) + (text.length > 5000 ? '...' : '');
  if (redactedEl) redactedEl.textContent = redactedText.substring(0, 5000) + (text.length > 5000 ? '...' : '');
  if (countEl) countEl.textContent = entityTexts.length;

  // Show modal
  document.getElementById('preview-modal')?.classList.remove('hidden');
};

window.closePreviewModal = function () {
  document.getElementById('preview-modal')?.classList.add('hidden');
};

// ============================================
// CLEAR ALL
// ============================================
window.clearAll = function () {
  currentFile = null;
  detectedEntities = [];
  manualEntities = [];
  pdfDocument = null;

  // Reset session stats
  stats.scanned = 0;
  stats.entities = 0;
  stats.redacted = 0;
  updateStats();

  if (elements.inputText) elements.inputText.value = '';

  // Reset file input so the same file can be uploaded again
  const fileInput = document.getElementById('file-upload');
  if (fileInput) fileInput.value = '';

  if (elements.fileInfo) {
    elements.fileInfo.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span>No file selected</span>
    `;
    elements.fileInfo.classList.remove('has-file');
  }
  elements.dropZone?.classList.remove('has-file');

  // Clear PDF viewer
  if (elements.pdfPages) {
    elements.pdfPages.innerHTML = '';
  }
  if (elements.pdfPageInfo) {
    elements.pdfPageInfo.textContent = '';
  }
  if (elements.pdfZoomLevel) {
    elements.pdfZoomLevel.textContent = '100%';
  }
  pdfZoom = 1.0;

  // Reset view to text view
  currentView = 'text';
  if (elements.viewToggle) {
    elements.viewToggle.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'text');
    });
  }
  if (elements.pdfViewerContainer) {
    elements.pdfViewerContainer.classList.add('hidden');
  }
  if (elements.textViewContainer) {
    elements.textViewContainer.classList.remove('hidden');
  }

  // Hide selection tooltip
  elements.selectionTooltip?.classList.add('hidden');

  // Clear text overlay highlights
  if (elements.textOverlay) {
    elements.textOverlay.innerHTML = '';
  }

  displayEntities();
  showToast('info', 'Cleared', 'All data has been cleared');
};

// ============================================
// INTEL DATABASE PANEL
// ============================================
function setupIntelPanel() {
  const presetsContainer = elements.intelPresets;
  if (!presetsContainer) return;

  const presets = getPresets();

  presetsContainer.innerHTML = presets
    .filter(p => p.id !== 'custom') // Custom is handled separately
    .map(preset => `
      <div class="intel-preset ${activePresets.includes(preset.id) ? 'active' : ''}" 
           data-preset="${preset.id}" 
           onclick="togglePreset('${preset.id}', this)">
        <span class="preset-icon">${preset.icon}</span>
        <div class="preset-info">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-desc">${preset.description}</div>
        </div>
        <div class="preset-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
    `).join('');

  // Render custom keywords
  renderCustomKeywords();
}

function renderCustomKeywords() {
  const list = elements.customKeywordsList;
  if (!list) return;

  if (customKeywords.length === 0) {
    list.innerHTML = '<span style="color: var(--text-tertiary); font-size: 0.75rem;">No custom keywords added</span>';
    return;
  }

  list.innerHTML = customKeywords.map((keyword, idx) => `
    <span class="custom-keyword-tag">
      ${escapeHtml(keyword)}
      <button class="remove-keyword" onclick="removeCustomKeyword(${idx})">×</button>
    </span>
  `).join('');
}

window.togglePreset = function (presetId, element) {
  const idx = activePresets.indexOf(presetId);
  if (idx === -1) {
    activePresets.push(presetId);
    element.classList.add('active');
    showToast('success', 'Preset Enabled', `${element.querySelector('.preset-name').textContent} patterns activated`);
  } else {
    activePresets.splice(idx, 1);
    element.classList.remove('active');
    showToast('info', 'Preset Disabled', `${element.querySelector('.preset-name').textContent} patterns deactivated`);
  }
  saveActivePresets(activePresets);
};

/**
 * Update the model status display in the sidebar (compact view)
 */
function updateModelStatusDisplay() {
  const status = getModelStatus();

  // Update compact status dots
  const bertDot = document.getElementById('bert-status-dot');
  const llamaDot = document.getElementById('llama-status-dot');
  const bertDesc = document.getElementById('bert-model-desc');

  if (bertDot) {
    bertDot.classList.remove('ready', 'loading', 'error');
    bertDot.classList.add(status.bert ? 'ready' : 'error');
    bertDot.title = status.bert ? 'Ready' : 'Not loaded';
  }

  if (llamaDot) {
    llamaDot.classList.remove('ready', 'loading', 'error');
    llamaDot.classList.add(status.llama ? 'ready' : 'error');
    llamaDot.title = status.llama ? 'Ready' : 'Not available (requires WebGPU)';
  }

  // Update model description based on tier
  if (bertDesc && status.modelConfig) {
    bertDesc.textContent = status.modelConfig.description;
  }
}

/**
 * Check hardware and show upgrade option if capable
 */
async function checkAndShowUpgradeOption() {
  try {
    const canUpgrade = await canUseProModel();
    const currentTier = getCurrentModelTier();
    const upgradeOption = document.getElementById('model-upgrade-option');
    const upgradeBtn = document.getElementById('btn-upgrade-model');
    const upgradeBtnText = document.getElementById('upgrade-btn-text');

    if (!upgradeOption) return;

    // Already on pro or hardware can't handle it
    if (currentTier.tier === 'pro') {
      upgradeOption.classList.add('hidden');
      return;
    }

    if (canUpgrade) {
      upgradeOption.classList.remove('hidden');
      logDebug('🖥️ High-performance hardware detected - Pro model available');
    } else {
      upgradeOption.classList.add('hidden');
      logDebug('ℹ️ Standard hardware - using optimized model');
    }
  } catch (e) {
    console.warn('Could not check hardware:', e);
  }
}

/**
 * Upgrade to Pro model (called from UI)
 */
window.upgradeModel = async function () {
  const upgradeBtn = document.getElementById('btn-upgrade-model');
  const upgradeBtnText = document.getElementById('upgrade-btn-text');
  const upgradeOption = document.getElementById('model-upgrade-option');
  const bertDesc = document.getElementById('bert-model-desc');

  if (!upgradeBtn) return;

  try {
    upgradeBtn.disabled = true;
    upgradeBtn.classList.add('downloading');
    upgradeBtnText.textContent = 'Downloading...';

    showToast('info', 'Upgrading Model', 'Downloading enhanced BERT model...');

    await upgradeToPro((progress) => {
      if (progress.status === 'upgrading') {
        upgradeBtnText.textContent = `${progress.progress}%`;
      }
    });

    // Success
    upgradeBtn.classList.remove('downloading');
    upgradeBtn.classList.add('active');
    upgradeBtnText.textContent = 'Active';

    if (bertDesc) {
      bertDesc.textContent = 'Enhanced Accuracy';
    }

    showToast('success', 'Model Upgraded', 'Now using BERT Large NER for enhanced detection');

    // Hide the upgrade option after a short delay
    setTimeout(() => {
      if (upgradeOption) {
        upgradeOption.style.opacity = '0';
        setTimeout(() => upgradeOption.classList.add('hidden'), 300);
      }
    }, 2000);

  } catch (error) {
    upgradeBtn.disabled = false;
    upgradeBtn.classList.remove('downloading');
    upgradeBtnText.textContent = 'Retry';
    showToast('error', 'Upgrade Failed', error.message);
  }
};

// ============================================
// SCROLL TO TOP
// ============================================
window.scrollToTop = function () {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

function setupScrollToTop() {
  const btn = document.getElementById('scroll-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });
}

// ============================================
// LEGAL / COMPLIANCE MODALS
// ============================================
window.showPrivacyPolicy = function () {
  const modal = document.getElementById('privacy-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Log for compliance audit
    logDebug('📋 Privacy policy viewed:', new Date().toISOString());
  }
};

window.closePrivacyPolicy = function () {
  const modal = document.getElementById('privacy-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

window.showTermsOfService = function () {
  const modal = document.getElementById('terms-modal');
  if (modal) {
    modal.classList.remove('hidden');
    logDebug('📋 Terms of service viewed:', new Date().toISOString());
  }
};

window.closeTermsOfService = function () {
  const modal = document.getElementById('terms-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

// Close modals on click outside
document.addEventListener('click', (e) => {
  const privacyModal = document.getElementById('privacy-modal');
  const termsModal = document.getElementById('terms-modal');

  if (e.target === privacyModal) {
    window.closePrivacyPolicy();
  }
  if (e.target === termsModal) {
    window.closeTermsOfService();
  }
});

// Also close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closePrivacyPolicy();
    window.closeTermsOfService();
  }
});

// ============================================
// STARTUP
// ============================================
console.log('📄 main.js loaded');

// Check if DOM is already loaded
if (document.readyState === 'loading') {
  console.log('⏳ DOM still loading, adding listener...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded fired');
    setupFileHandlers();
    setupKeyboardShortcuts();
    setupScrollToTop();
    setupPdfScrollListener();
    setupPdfKeyboardNav();
    updateStats();
    initialize();
  });
} else {
  console.log('✅ DOM already loaded, running immediately');
  setupFileHandlers();
  setupKeyboardShortcuts();
  setupScrollToTop();
  setupPdfScrollListener();
  setupPdfKeyboardNav();
  updateStats();
  initialize();
}


