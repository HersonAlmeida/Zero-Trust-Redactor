/**
 * AI Engine Service - Handles BERT and Llama model loading/inference
 * Priority: Local models (public/models/) → CDN fallback
 * Transformers.js is loaded from CDN in index.html to avoid bundler issues
 */

// State
let bertClassifier = null;
let llamaEngine = null;
let llamaAvailable = false;
let modelsLoadedFrom = { bert: null, llama: null }; // 'local' or 'cdn'
let currentModelTier = 'standard'; // 'standard' or 'pro'
let hardwareCapabilities = null;

const DEBUG_LOGS = false;
const logDebug = (...args) => { if (DEBUG_LOGS) console.log(...args); };

// Model configurations - Using publicly accessible models
const MODEL_TIERS = {
  standard: {
    name: 'BERT Base NER',
    model: 'Xenova/bert-base-NER',
    description: 'Fast & Efficient',
    minRAM: 2,
    quantized: true
  },
  pro: {
    name: 'BERT Base NER (Full Precision)',
    model: 'Xenova/bert-base-NER',
    description: 'Enhanced Accuracy',
    minRAM: 6,
    quantized: false  // Full precision = more accurate but slower
  }
};

/**
 * Detect hardware capabilities
 * @returns {Object} Hardware info
 */
export async function detectHardware() {
  if (hardwareCapabilities) return hardwareCapabilities;
  
  const capabilities = {
    ram: 4, // Default estimate
    cores: navigator.hardwareConcurrency || 4,
    gpu: false,
    webgpu: false,
    canUpgrade: false,
    recommendation: 'standard'
  };
  
  // Estimate RAM from device memory API (Chrome only)
  if (navigator.deviceMemory) {
    capabilities.ram = navigator.deviceMemory;
  }
  
  // Check for WebGPU support
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        capabilities.gpu = true;
        capabilities.webgpu = true;
        
        // Try to get GPU info
        const info = await adapter.requestAdapterInfo?.();
        if (info) {
          capabilities.gpuVendor = info.vendor;
          capabilities.gpuDevice = info.device;
        }
      }
    } catch (e) {
      logDebug('WebGPU not available:', e.message);
    }
  }
  
  // Determine if upgrade is recommended
  // Need at least 8GB RAM and 4+ cores for pro model
  if (capabilities.ram >= 8 && capabilities.cores >= 4) {
    capabilities.canUpgrade = true;
    capabilities.recommendation = 'pro';
  } else if (capabilities.ram >= 6 && capabilities.cores >= 4) {
    // Borderline - allow but don't recommend
    capabilities.canUpgrade = true;
    capabilities.recommendation = 'standard';
  }
  
  logDebug('🖥️ Hardware detected:', capabilities);
  hardwareCapabilities = capabilities;
  return capabilities;
}

/**
 * Get current model tier info
 */
export function getCurrentModelTier() {
  return {
    tier: currentModelTier,
    config: MODEL_TIERS[currentModelTier],
    canUpgrade: hardwareCapabilities?.canUpgrade || false
  };
}

/**
 * Check if user's hardware supports pro model
 */
export async function canUseProModel() {
  const hw = await detectHardware();
  return hw.canUpgrade;
}

/**
 * Check if local models are available
 */
async function checkLocalModels() {
  const results = { bert: false, llama: false };
  
  try {
    const bertManifest = await fetch('/models/bert/manifest.json');
    if (bertManifest.ok) {
      const manifest = await bertManifest.json();
      logDebug(`📦 Local BERT found: v${manifest.version}`);
      results.bert = true;
    }
  } catch {
    logDebug('ℹ️ No local BERT model found');
  }
  
  try {
    const llamaManifest = await fetch('/models/llama/manifest.json');
    if (llamaManifest.ok) {
      const manifest = await llamaManifest.json();
      logDebug(`📦 Local Llama found: v${manifest.version}`);
      results.llama = true;
    }
  } catch {
    logDebug('ℹ️ No local Llama model found');
  }
  
  return results;
}

/**
 * Get model loading source info
 */
export function getModelSources() {
  return { ...modelsLoadedFrom };
}

/**
 * Clear IndexedDB cache for transformers.js models
 * Useful when model loading fails due to corrupted cache
 */
async function clearModelCache() {
  const dbNames = ['transformers-cache', 'onnx-cache', 'webllm'];
  for (const name of dbNames) {
    try {
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => {
          logDebug(`🗑️ Cleared cache: ${name}`);
          resolve();
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => {
          console.warn(`⚠️ Cache ${name} is blocked`);
          resolve();
        };
      });
    } catch (e) {
      console.warn(`Could not clear ${name}:`, e);
    }
  }
}

/**
 * Wait for Transformers.js to be loaded from CDN
 */
function waitForTransformers(timeout = 30000) {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.TransformersJS) {
      resolve(window.TransformersJS);
      return;
    }
    
    // Error occurred
    if (window.TransformersJSError) {
      reject(window.TransformersJSError);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout waiting for Transformers.js to load'));
    }, timeout);
    
    window.addEventListener('transformers-ready', () => {
      clearTimeout(timeoutId);
      resolve(window.TransformersJS);
    }, { once: true });
    
    window.addEventListener('transformers-error', () => {
      clearTimeout(timeoutId);
      reject(window.TransformersJSError || new Error('Failed to load Transformers.js'));
    }, { once: true });
  });
}

/**
 * Check if WebGPU is available for Llama
 */
async function checkWebGPU() {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

/**
 * Initialize BERT NER model for fast entity recognition
 * Priority: Local model → CDN fallback
 * @param {Function} progressCallback - Progress update callback
 * @returns {Promise<Object>} - BERT classifier pipeline
 */
export async function initBert(progressCallback = () => {}, retryAfterCacheClear = false) {
  if (bertClassifier) return bertClassifier;
  
  try {
    progressCallback({ model: 'bert', status: 'loading', progress: 0 });
    
    // Wait for transformers.js from CDN (library only)
    const { pipeline, env } = await waitForTransformers();
    
    // Allow remote models - transformers.js handles caching in IndexedDB
    // Model weights are downloaded once and cached locally; no document data is sent
    logDebug('🔄 Loading BERT model (cached in browser)...');
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    
    bertClassifier = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      quantized: true,
      revision: 'main',
      progress_callback: (data) => {
        if (data.status === 'progress') {
          const progress = Math.round(data.progress);
          logDebug(`📥 BERT: ${progress}%`);
          progressCallback({ model: 'bert', status: 'loading', progress });
        } else if (data.status === 'initiate') {
          logDebug(`📦 Fetching: ${data.file}`);
        }
      }
    });
    
    modelsLoadedFrom.bert = 'cdn-cached';
    progressCallback({ model: 'bert', status: 'ready', progress: 100 });
    logDebug('✅ BERT loaded (cached in IndexedDB)');
    return bertClassifier;
    
  } catch (error) {
    console.error('❌ BERT loading failed:', error);
    
    // If JSON parse error and haven't retried, clear cache and try again
    if (error.message?.includes('Unexpected token') && !retryAfterCacheClear) {
      logDebug('🔄 Detected corrupted cache, clearing and retrying...');
      await clearModelCache();
      // Clear browser cache for HuggingFace URLs
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            await caches.delete(name);
          }
          logDebug('🗑️ Cleared browser caches');
        } catch (e) {
          console.warn('Could not clear browser cache:', e);
        }
      }
      return initBert(progressCallback, true);
    }
    
    progressCallback({ model: 'bert', status: 'error', error: error.message });
    throw error;
  }
}

/**
 * Initialize Llama 3.2 1B model for deep context-aware scanning
 * Requires WebGPU support in the browser
 * @param {Function} progressCallback - Progress update callback
 * @returns {Promise<Object>} - Llama engine instance
 */
export async function initLlama(progressCallback = () => {}) {
  if (llamaEngine) return llamaEngine;
  
  // Check WebGPU availability first
  const hasWebGPU = await checkWebGPU();
  if (!hasWebGPU) {
    console.warn('⚠️ WebGPU not available - Deep Scan disabled');
    progressCallback({ model: 'llama', status: 'unavailable', progress: 0 });
    llamaAvailable = false;
    return null;
  }
  
  try {
    progressCallback({ model: 'llama', status: 'loading', progress: 0 });
    
    // Dynamically import WebLLM only if WebGPU is available
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    
    llamaEngine = await CreateMLCEngine(
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      {
        initProgressCallback: (report) => {
          const progress = typeof report.progress === 'number' 
            ? Math.round(report.progress * 100) 
            : 0;
          progressCallback({ 
            model: 'llama', 
            status: 'loading', 
            progress,
            text: report.text || 'Loading...'
          });
        }
      }
    );
    
    llamaAvailable = true;
    progressCallback({ model: 'llama', status: 'ready', progress: 100 });
    logDebug('✅ Llama 3.2 model loaded successfully');
    return llamaEngine;
    
  } catch (error) {
    // Treat missing WASM/binaries as a graceful fallback to BERT-only mode
    const isMissingWasm = /wasm/i.test(error.message || '') || /404/.test(error.message || '');
    llamaAvailable = false;
    if (isMissingWasm) {
      progressCallback({ model: 'llama', status: 'unavailable', error: 'Llama WASM not found' });
      logDebug('⚠️ Llama WebGPU binaries not found; running BERT-only.');
      return null;
    }
    progressCallback({ model: 'llama', status: 'error', error: error.message });
    console.error('❌ Llama loading failed:', error);
    return null; // Don't throw - allow app to continue with BERT only
  }
}

/**
 * Initialize models - BERT is required, Llama is optional
 * @param {Function} progressCallback - Combined progress callback
 * @returns {Promise<{bert: Object, llama: Object|null}>}
 */
export async function initAllModels(progressCallback = () => {}) {
  const progress = { bert: 0, llama: 0 };
  
  const updateCombinedProgress = (update) => {
    if (update.model === 'bert') {
      progress.bert = update.progress;
    } else if (update.model === 'llama') {
      progress.llama = update.progress;
    }
    
    // If Llama unavailable, BERT is 100% of progress
    const hasLlamaSupport = update.model === 'llama' && update.status !== 'unavailable';
    const combined = hasLlamaSupport 
      ? Math.round((progress.bert * 0.3) + (progress.llama * 0.7))
      : progress.bert;
      
    progressCallback({
      combined,
      bert: progress.bert,
      llama: progress.llama,
      status: progress.bert >= 100 ? 'ready' : 'loading'
    });
  };
  
  // Load BERT first (required)
  const bert = await initBert(updateCombinedProgress);
  
  // Then try Llama (optional - requires WebGPU)
  const llama = await initLlama(updateCombinedProgress);
  
  return { bert, llama };
}

/**
 * Run BERT NER + Regex detection (Fast Mode)
 * @param {string} text - Input text to analyze
 * @returns {Promise<string[]>} - Array of detected sensitive words
 */
export async function detectWithBert(text) {
  if (!bertClassifier) {
    throw new Error('BERT model not initialized. Call initBert() first.');
  }
  
  const results = await bertClassifier(text, { ignore_labels: [] });
  
  // Group consecutive tokens with same entity type (handles subword tokenization)
  const mergedEntities = [];
  let currentEntity = null;
  
  for (const item of results) {
    // Skip low confidence or O (outside) labels
    if (item.score < 0.5 || item.entity === 'O') continue;
    
    const entityType = item.entity.replace(/^[BI]-/, ''); // Remove B-/I- prefix
    const isBegin = item.entity.startsWith('B-');
    const word = item.word.replace(/^##/, '');
    
    if (isBegin || !currentEntity || currentEntity.type !== entityType) {
      // Start new entity
      if (currentEntity && currentEntity.text.length > 1) {
        mergedEntities.push({ text: currentEntity.text, score: currentEntity.score, type: currentEntity.type, source: 'bert' });
      }
      currentEntity = { type: entityType, text: word, score: item.score };
    } else {
      // Continue current entity (merge subwords)
      if (item.word.startsWith('##')) {
        currentEntity.text += word; // No space for subwords
      } else {
        currentEntity.text += ' ' + word;
      }
      currentEntity.score = Math.max(currentEntity.score, item.score);
    }
  }
  
  // Don't forget the last entity
  if (currentEntity && currentEntity.text.length > 1) {
    mergedEntities.push({ text: currentEntity.text, score: currentEntity.score, type: currentEntity.type, source: 'bert' });
  }
  
  // Enhanced Regex patterns for common PII
  const patterns = {
    // Email addresses
    emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    // Phone numbers (multiple formats)
    phones: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    // SSN
    ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    // Credit cards
    creditCards: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    // Dates (various formats)
    dates: /\b(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{2}[-\/]\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi,
    // Addresses (street)
    addresses: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)\.?\b/gi,
    // ZIP codes
    zipCodes: /\b\d{5}(?:-\d{4})?\b/g,
    // IP addresses
    ipAddresses: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    // URLs
    urls: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
    // Account/ID numbers
    accountNumbers: /\b(?:acct?\.?|account|id|#)\s*:?\s*[A-Z0-9]{4,20}\b/gi,
    // Currency amounts
    currency: /\$[\d,]+(?:\.\d{2})?\b|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|USD)\b/gi,
  };
  
  const regexMatches = [];
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern) || [];
    matches.forEach(m => {
      regexMatches.push({ text: m, score: 0.95, type: type, source: 'regex' });
    });
  }
  
  // Look for names using heuristics (capitalized words following certain patterns)
  const namePatterns = [
    /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
    /\b(?:name|patient|client|customer|employee|applicant|defendant|plaintiff):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /\b(?:signed|by|from|to|attn|attention):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  ];
  
  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) regexMatches.push({ text: match[1], score: 0.85, type: 'name', source: 'heuristic' });
    }
  }
  
  // Combine BERT entities with regex matches
  const allEntities = [...mergedEntities, ...regexMatches];
  
  // Clean up and deduplicate by text
  const seen = new Set();
  return allEntities
    .filter(e => {
      const text = typeof e === 'string' ? e.trim() : e.text.trim();
      if (seen.has(text) || text.length <= 1 || /^[\d\s]+$/.test(text)) return false;
      seen.add(text);
      return true;
    })
    .map(e => typeof e === 'string' ? { text: e, score: 0.7, type: 'unknown', source: 'bert' } : e);
}

/**
 * Run Llama 3 context-aware detection (Deep Scan)
 * @param {string} text - Input text to analyze
 * @returns {Promise<string[]>} - Array of detected sensitive items
 */
export async function detectWithLlama(text) {
  if (!llamaEngine) {
    console.warn('Llama not available, falling back to BERT');
    return detectWithBert(text);
  }
  
  // First run regex to get definite matches
  const regexEntities = await getRegexMatches(text);
  
  const prompt = `[TASK] Extract ALL personally identifiable information (PII) from the text below.

[CATEGORIES TO FIND]
1. NAMES: Full names, first names, last names, nicknames
2. CONTACT: Phone numbers, email addresses, fax numbers
3. LOCATION: Street addresses, cities, states, ZIP codes, countries
4. IDENTIFIERS: SSN, passport numbers, driver's license, employee IDs, patient IDs, account numbers
5. FINANCIAL: Credit card numbers, bank account numbers, routing numbers, amounts with context
6. DATES: Birth dates, hire dates, appointment dates (not generic dates)
7. MEDICAL: Diagnoses, medications, conditions, treatments
8. OTHER: Any other identifying information

[RULES]
- Extract the EXACT text as it appears
- Include partial matches (e.g., just a first name if that's all there is)
- One item per line
- No explanations or categories, just the raw values
- If nothing found, respond with only: NONE

[TEXT TO ANALYZE]
${text.substring(0, 3000)}

[EXTRACTED PII]`;

  try {
    const response = await llamaEngine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.1,
      top_p: 0.9
    });
    
    const result = response.choices[0].message.content.trim();
    
    if (result === 'NONE' || result.toLowerCase().includes('no pii') || result.toLowerCase().includes('no sensitive')) {
      return regexEntities;
    }
    
    // Parse response - handle both comma-separated and line-separated
    const llamaEntities = result
      .split(/[\n,]/)
      .map(item => item.trim())
      .map(item => item.replace(/^[-•*\d.)\]]+\s*/, '')) // Remove list markers
      .map(item => item.replace(/^["']|["']$/g, '')) // Remove quotes
      .filter(item => 
        item.length > 1 && 
        item !== 'NONE' && 
        !item.toLowerCase().includes('none found') &&
        !item.toLowerCase().startsWith('no ') &&
        !/^[a-z\s]+:$/i.test(item) // Filter out category labels
      );
    
    // Combine Llama results with regex results
    const allEntities = [...llamaEntities, ...regexEntities];
    
    return [...new Set(allEntities.map(e => e.trim()).filter(e => e.length > 1))];
  } catch (error) {
    console.error('Llama detection failed, falling back to BERT:', error);
    return detectWithBert(text);
  }
}

/**
 * Enhanced regex pattern matching for PII
 */
function getRegexMatches(text) {
  const patterns = {
    emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phones: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    creditCards: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    dates: /\b(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{2}[-\/]\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi,
    addresses: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)\.?\b/gi,
    zipCodes: /\b\d{5}(?:-\d{4})?\b/g,
    ipAddresses: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    currency: /\$[\d,]+(?:\.\d{2})?\b/g,
  };
  
  const matches = [];
  for (const pattern of Object.values(patterns)) {
    const found = text.match(pattern) || [];
    matches.push(...found);
  }
  
  return [...new Set(matches.map(m => m.trim()))];
}

/**
 * Get the current state of loaded models
 */
export function getModelStatus() {
  return {
    bert: bertClassifier !== null,
    llama: llamaEngine !== null,
    llamaAvailable,
    modelTier: currentModelTier,
    modelConfig: MODEL_TIERS[currentModelTier]
  };
}

/**
 * Upgrade to Pro BERT model (larger, more accurate)
 * @param {Function} progressCallback - Progress update callback
 * @returns {Promise<Object>} - Upgraded BERT classifier
 */
export async function upgradeToPro(progressCallback = () => {}) {
  // Check hardware first
  const hw = await detectHardware();
  if (!hw.canUpgrade) {
    throw new Error('Hardware does not meet requirements for Pro model');
  }
  
  const proConfig = MODEL_TIERS.pro;
  logDebug(`🚀 Upgrading to ${proConfig.name}...`);
  
  try {
    progressCallback({ model: 'bert', status: 'upgrading', progress: 0, tier: 'pro' });
    
    const { pipeline, env } = await waitForTransformers();
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    
    // Load the larger model
    const newClassifier = await pipeline('token-classification', proConfig.model, {
      quantized: proConfig.quantized,
      revision: 'main',
      progress_callback: (data) => {
        if (data.status === 'progress') {
          const progress = Math.round(data.progress);
          logDebug(`📥 Pro model download: ${progress}%`);
          progressCallback({ model: 'bert', status: 'upgrading', progress, tier: 'pro' });
        } else if (data.status === 'initiate') {
          logDebug(`📦 Fetching: ${data.file}`);
        }
      }
    });
    
    // Replace the standard model with pro
    bertClassifier = newClassifier;
    currentModelTier = 'pro';
    modelsLoadedFrom.bert = 'cdn-pro';
    
    // Save preference
    try {
      localStorage.setItem('redactor-model-tier', 'pro');
    } catch (e) {
      console.warn('Could not save model preference');
    }
    
    progressCallback({ model: 'bert', status: 'ready', progress: 100, tier: 'pro' });
    logDebug(`✅ Upgraded to ${proConfig.name}`);
    
    return bertClassifier;
  } catch (error) {
    console.error('❌ Pro model upgrade failed:', error);
    progressCallback({ model: 'bert', status: 'error', error: error.message, tier: 'pro' });
    throw error;
  }
}

/**
 * Check if pro model was previously selected
 */
export function getSavedModelPreference() {
  try {
    return localStorage.getItem('redactor-model-tier') || 'standard';
  } catch {
    return 'standard';
  }}

