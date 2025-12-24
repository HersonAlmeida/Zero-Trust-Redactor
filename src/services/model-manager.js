/**
 * Model Manager Service
 * Handles local model storage, versioning, and updates
 * Models are stored in public/models/ after setup and loaded locally at runtime.
 * Requires one-time downloads via npm run setup; no document data leaves the device.
 */

// Model version manifest - tracks installed and available versions
const MODEL_MANIFEST = {
  bert: {
    id: 'bert-base-ner',
    name: 'BERT NER',
    description: 'Named Entity Recognition for detecting PII',
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
    size: '50MB',
    localPath: '/models/bert/',
    remoteManifestUrl: null,
    files: [
      { name: 'config.json', required: true },
      { name: 'tokenizer.json', required: true },
      { name: 'tokenizer_config.json', required: true },
      { name: 'onnx/model_quantized.onnx', required: true, size: '45MB' }
    ],
    huggingFaceRepo: 'Xenova/bert-base-NER'
  },
  llama: {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B',
    description: 'Large Language Model for deep context analysis',
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
    size: '700MB',
    localPath: '/models/llama/',
    remoteManifestUrl: null,
    files: [
      { name: 'mlc-chat-config.json', required: true },
      { name: 'tokenizer.json', required: true },
      { name: 'ndarray-cache.json', required: true },
      { name: 'params_shard_0.bin', required: true, size: '200MB' },
      { name: 'params_shard_1.bin', required: true, size: '200MB' },
      { name: 'params_shard_2.bin', required: true, size: '200MB' }
    ],
    wasmFile: 'Llama-3.2-1B-Instruct-q4f16_1-MLC-webgpu.wasm',
    huggingFaceRepo: 'mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC'
  }
};

// Local storage key for installed model info
const STORAGE_KEY = 'ztr-model-versions';

/**
 * Get installed model versions from localStorage
 */
export function getInstalledVersions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save installed model versions to localStorage
 */
function saveInstalledVersions(versions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

/**
 * Check if a model is installed locally
 */
export async function isModelInstalled(modelId) {
  const manifest = MODEL_MANIFEST[modelId];
  if (!manifest) return false;
  
  try {
    // Check if the manifest file exists
    const response = await fetch(`${manifest.localPath}manifest.json`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get model status (installed, version, update available)
 */
export async function getModelStatus(modelId) {
  const manifest = MODEL_MANIFEST[modelId];
  if (!manifest) {
    return { installed: false, error: 'Unknown model' };
  }
  
  const installed = await isModelInstalled(modelId);
  const versions = getInstalledVersions();
  const installedVersion = versions[modelId]?.version || null;
  
  return {
    id: modelId,
    name: manifest.name,
    description: manifest.description,
    installed,
    installedVersion,
    latestVersion: manifest.latestVersion,
    updateAvailable: installed && installedVersion && installedVersion !== manifest.latestVersion,
    size: manifest.size,
    localPath: manifest.localPath
  };
}

/**
 * Get status of all models
 */
export async function getAllModelStatus() {
  const results = {};
  for (const modelId of Object.keys(MODEL_MANIFEST)) {
    results[modelId] = await getModelStatus(modelId);
  }
  return results;
}

/**
 * Check for updates (requires internet)
 * Returns null if offline or check fails
 */
export async function checkForUpdates(modelId) {
  const manifest = MODEL_MANIFEST[modelId];
  if (!manifest || !manifest.remoteManifestUrl) return null; // skip network if not configured
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(manifest.remoteManifestUrl, {
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const remoteConfig = await response.json();
    
    // Extract version from config (varies by model type)
    let remoteVersion = manifest.latestVersion;
    if (remoteConfig.version) {
      remoteVersion = remoteConfig.version;
    } else if (remoteConfig.model_version) {
      remoteVersion = remoteConfig.model_version;
    }
    
    const versions = getInstalledVersions();
    const installedVersion = versions[modelId]?.version;
    
    return {
      modelId,
      installedVersion,
      latestVersion: remoteVersion,
      updateAvailable: installedVersion !== remoteVersion,
      releaseNotes: remoteConfig.release_notes || null
    };
  } catch (e) {
    console.warn(`Could not check for updates (offline?): ${e.message}`);
    return null;
  }
}

/**
 * Check all models for updates
 */
export async function checkAllForUpdates() {
  const results = {};
  for (const modelId of Object.keys(MODEL_MANIFEST)) {
    results[modelId] = await checkForUpdates(modelId);
  }
  return results;
}

/**
 * Get download instructions for a model
 */
export function getDownloadInstructions(modelId) {
  const manifest = MODEL_MANIFEST[modelId];
  if (!manifest) return null;
  
  return {
    modelId,
    name: manifest.name,
    size: manifest.size,
    command: modelId === 'bert' ? 'npm run setup:bert' : 'npm run setup:llama',
    fullCommand: 'npm run setup',
    manualUrls: manifest.files.map(f => ({
      name: f.name,
      url: `https://huggingface.co/${manifest.huggingFaceRepo}/resolve/main/${f.name}`
    }))
  };
}

/**
 * Mark a model as installed (called after download completes)
 */
export function markModelInstalled(modelId, version) {
  const versions = getInstalledVersions();
  versions[modelId] = {
    version: version || MODEL_MANIFEST[modelId]?.latestVersion || '1.0.0',
    installedAt: new Date().toISOString()
  };
  saveInstalledVersions(versions);
}

/**
 * Get the manifest for a model
 */
export function getModelManifest(modelId) {
  return MODEL_MANIFEST[modelId] || null;
}

/**
 * Get all model manifests
 */
export function getAllManifests() {
  return { ...MODEL_MANIFEST };
}
