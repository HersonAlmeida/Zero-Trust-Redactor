/**
 * Model Download Script with Hardware Analysis
 * Analyzes system capabilities and downloads optimal models
 * Run: npm run setup
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');

// Model configurations with requirements
const MODELS = {
  bert: {
    name: 'BERT NER',
    version: '1.0.0',
    baseUrl: 'https://huggingface.co/Xenova/bert-base-NER/resolve/main',
    outputDir: 'bert',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'vocab.txt',
      'onnx/model_quantized.onnx'
    ],
    requirements: {
      minRAM: 2,  // GB
      gpu: false,
      webgpu: false
    },
    size: '~50MB'
  },
  llama: {
    name: 'Llama 3.2 1B',
    version: '1.0.0',
    baseUrl: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main',
    outputDir: 'llama',
    files: [
      'mlc-chat-config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'ndarray-cache.json',
      'params_shard_0.bin',
      'params_shard_1.bin',
      'params_shard_2.bin',
      'params_shard_3.bin'
    ],
    wasmUrl: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-3.2-1B-Instruct-q4f16_1-MLC/Llama-3.2-1B-Instruct-q4f16_1-MLC-webgpu.wasm',
    wasmOutput: 'libs/Llama-3.2-1B-Instruct-q4f16_1-MLC-webgpu.wasm',
    requirements: {
      minRAM: 8,  // GB - Llama needs more memory
      gpu: true,  // Requires GPU
      webgpu: true,  // Requires WebGPU support
      minVRAM: 4  // GB of VRAM recommended
    },
    size: '~700MB'
  }
};

// ============================================
// HARDWARE DETECTION
// ============================================

function getSystemInfo() {
  const info = {
    platform: os.platform(),
    arch: os.arch(),
    totalRAM: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
    freeRAM: Math.round(os.freemem() / (1024 * 1024 * 1024)), // GB
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    gpu: null,
    webgpuSupported: false,
    recommendations: []
  };
  
  // Detect GPU
  try {
    if (info.platform === 'win32') {
      // Windows - use WMIC
      const gpuInfo = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' });
      const gpuLines = gpuInfo.split('\n').filter(line => line.trim() && !line.includes('Name'));
      info.gpu = gpuLines.map(g => g.trim()).filter(g => g);
    } else if (info.platform === 'darwin') {
      // macOS - use system_profiler
      const gpuInfo = execSync('system_profiler SPDisplaysDataType | grep "Chipset Model"', { encoding: 'utf8' });
      info.gpu = gpuInfo.split('\n').map(g => g.replace('Chipset Model:', '').trim()).filter(g => g);
    } else {
      // Linux - use lspci
      try {
        const gpuInfo = execSync('lspci | grep -i vga', { encoding: 'utf8' });
        info.gpu = gpuInfo.split('\n').map(g => g.trim()).filter(g => g);
      } catch {
        info.gpu = ['Unknown'];
      }
    }
  } catch (e) {
    info.gpu = ['Could not detect'];
  }
  
  // Check for WebGPU-compatible GPU
  const gpuString = (info.gpu || []).join(' ').toLowerCase();
  const hasModernGPU = 
    gpuString.includes('nvidia') ||
    gpuString.includes('rtx') ||
    gpuString.includes('gtx 16') ||
    gpuString.includes('gtx 20') ||
    gpuString.includes('radeon rx') ||
    gpuString.includes('arc') ||
    gpuString.includes('apple m1') ||
    gpuString.includes('apple m2') ||
    gpuString.includes('apple m3') ||
    gpuString.includes('apple m4');
  
  // Check Chrome/Edge version for WebGPU support (Chrome 113+)
  info.webgpuSupported = hasModernGPU && info.totalRAM >= 8;
  
  return info;
}

function analyzeCompatibility(systemInfo) {
  const results = {
    bert: { compatible: true, warnings: [], reason: '' },
    llama: { compatible: true, warnings: [], reason: '' }
  };
  
  // BERT Analysis
  if (systemInfo.totalRAM < MODELS.bert.requirements.minRAM) {
    results.bert.compatible = false;
    results.bert.reason = `Insufficient RAM (${systemInfo.totalRAM}GB < ${MODELS.bert.requirements.minRAM}GB required)`;
  }
  
  // Llama Analysis
  if (systemInfo.totalRAM < MODELS.llama.requirements.minRAM) {
    results.llama.compatible = false;
    results.llama.reason = `Insufficient RAM (${systemInfo.totalRAM}GB < ${MODELS.llama.requirements.minRAM}GB required)`;
  }
  
  if (!systemInfo.webgpuSupported) {
    results.llama.compatible = false;
    results.llama.reason = 'WebGPU not supported (requires modern GPU + Chrome/Edge 113+)';
  }
  
  const gpuString = (systemInfo.gpu || []).join(' ').toLowerCase();
  
  // Check for integrated graphics only
  if (gpuString.includes('intel') && !gpuString.includes('arc') && !gpuString.includes('nvidia') && !gpuString.includes('radeon')) {
    results.llama.warnings.push('Integrated Intel GPU detected - Llama may run slowly');
  }
  
  // Low VRAM warning
  if (systemInfo.totalRAM < 16 && results.llama.compatible) {
    results.llama.warnings.push('Less than 16GB RAM - Llama performance may be limited');
  }
  
  return results;
}

function printSystemAnalysis(systemInfo, compatibility) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           🔍 SYSTEM ANALYSIS                               ║
╚════════════════════════════════════════════════════════════╝

  💻 Platform:    ${systemInfo.platform} (${systemInfo.arch})
  🧠 CPU:         ${systemInfo.cpuModel}
  📊 CPU Cores:   ${systemInfo.cpus}
  💾 Total RAM:   ${systemInfo.totalRAM} GB
  💾 Free RAM:    ${systemInfo.freeRAM} GB
  🎮 GPU:         ${(systemInfo.gpu || ['Not detected']).join(', ')}
  🌐 WebGPU:      ${systemInfo.webgpuSupported ? '✅ Likely Supported' : '❌ Not Supported'}

╔════════════════════════════════════════════════════════════╗
║           📋 MODEL COMPATIBILITY                           ║
╚════════════════════════════════════════════════════════════╝
`);
  
  // BERT Status
  const bertStatus = compatibility.bert.compatible ? '✅' : '❌';
  console.log(`  ${bertStatus} BERT NER (${MODELS.bert.size})`);
  console.log(`     Fast entity detection - runs on CPU`);
  if (!compatibility.bert.compatible) {
    console.log(`     ⚠️  ${compatibility.bert.reason}`);
  }
  
  console.log('');
  
  // Llama Status
  const llamaStatus = compatibility.llama.compatible ? '✅' : '❌';
  console.log(`  ${llamaStatus} Llama 3.2 1B (${MODELS.llama.size})`);
  console.log(`     Deep context analysis - requires WebGPU`);
  if (!compatibility.llama.compatible) {
    console.log(`     ⚠️  ${compatibility.llama.reason}`);
  }
  for (const warning of compatibility.llama.warnings) {
    console.log(`     ⚠️  ${warning}`);
  }
  
  console.log('');
}

function getRecommendation(compatibility) {
  if (compatibility.bert.compatible && compatibility.llama.compatible) {
    return {
      models: ['bert', 'llama'],
      message: '🎉 Your system supports all models! Downloading both for full functionality.'
    };
  } else if (compatibility.bert.compatible && !compatibility.llama.compatible) {
    return {
      models: ['bert'],
      message: '⚡ Downloading BERT only (Llama not supported on this system).\n   You\'ll have Fast Mode - pattern + AI detection without deep analysis.'
    };
  } else {
    return {
      models: [],
      message: '❌ System does not meet minimum requirements for AI models.\n   The app will run in Pattern-Only mode using Intel Database.'
    };
  }
}

// Utility functions
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created: ${dir}`);
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = (url) => {
      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize) {
            const percent = Math.round((downloaded / totalSize) * 100);
            process.stdout.write(`\r   Progress: ${percent}% (${formatBytes(downloaded)}/${formatBytes(totalSize)})`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(''); // New line after progress
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {}); // Delete failed file
        reject(err);
      });
    };
    
    request(url);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

async function downloadModel(modelKey) {
  const model = MODELS[modelKey];
  console.log(`\n🚀 Downloading ${model.name} v${model.version}...`);
  
  const outputDir = path.join(MODELS_DIR, model.outputDir);
  ensureDir(outputDir);
  
  let allSuccess = true;
  
  for (const file of model.files) {
    const url = `${model.baseUrl}/${file}`;
    const filePath = file.includes('/') 
      ? path.join(outputDir, ...file.split('/'))
      : path.join(outputDir, file);
    
    // Ensure subdirectory exists
    ensureDir(path.dirname(filePath));
    
    if (fs.existsSync(filePath)) {
      console.log(`   ⏭️  Skipping ${file} (already exists)`);
      continue;
    }
    
    console.log(`   📥 Downloading ${file}...`);
    try {
      await downloadFile(url, filePath);
      console.log(`   ✅ ${file}`);
    } catch (error) {
      console.error(`   ❌ Failed: ${file} - ${error.message}`);
      allSuccess = false;
    }
  }
  
  // Download WASM file for Llama
  if (model.wasmUrl) {
    const wasmPath = path.join(outputDir, model.wasmOutput);
    ensureDir(path.dirname(wasmPath));
    
    if (!fs.existsSync(wasmPath)) {
      console.log(`   📥 Downloading WebGPU WASM...`);
      try {
        await downloadFile(model.wasmUrl, wasmPath);
        console.log(`   ✅ WASM library`);
      } catch (error) {
        console.error(`   ❌ WASM download failed: ${error.message}`);
        allSuccess = false;
      }
    }
  }
  
  // Save version manifest
  if (allSuccess) {
    const manifestPath = path.join(outputDir, 'manifest.json');
    const manifest = {
      id: modelKey,
      name: model.name,
      version: model.version,
      downloadedAt: new Date().toISOString(),
      files: model.files
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`   📋 Saved manifest: ${manifestPath}`);
  }
  
  return allSuccess;
}

async function copyPdfWorker() {
  console.log('\n📋 Setting up PDF.js worker...');
  
  const workerSrc = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  const workerDest = path.join(PUBLIC_DIR, 'pdf.worker.min.mjs');
  
  ensureDir(PUBLIC_DIR);
  
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDest);
    console.log('   ✅ PDF worker copied to public/');
  } else {
    // Try alternative path
    const altSrc = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs');
    if (fs.existsSync(altSrc)) {
      fs.copyFileSync(altSrc, workerDest);
      console.log('   ✅ PDF worker copied to public/');
    } else {
      console.error('   ❌ PDF worker not found. Run npm install first.');
    }
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         🔒 Zero-Trust Redactor - Smart Model Setup         ║
║         Analyzes your system for optimal AI models         ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  // Analyze system
  console.log('🔍 Analyzing system capabilities...\n');
  const systemInfo = getSystemInfo();
  const compatibility = analyzeCompatibility(systemInfo);
  
  printSystemAnalysis(systemInfo, compatibility);
  
  // Get recommendation
  const recommendation = getRecommendation(compatibility);
  console.log(`\n${recommendation.message}\n`);
  
  // Create directories
  ensureDir(PUBLIC_DIR);
  ensureDir(MODELS_DIR);
  
  // Copy PDF worker
  await copyPdfWorker();
  
  // Parse command line args
  const args = process.argv.slice(2);
  let modelsToDownload = [];
  
  if (args.includes('--bert-only')) {
    modelsToDownload = compatibility.bert.compatible ? ['bert'] : [];
    if (!compatibility.bert.compatible) {
      console.log('⚠️  BERT not compatible with this system. Skipping.');
    }
  } else if (args.includes('--llama-only')) {
    modelsToDownload = compatibility.llama.compatible ? ['llama'] : [];
    if (!compatibility.llama.compatible) {
      console.log('⚠️  Llama not compatible with this system. Skipping.');
    }
  } else if (args.includes('--force-all')) {
    // Force download all models (ignore compatibility)
    modelsToDownload = ['bert', 'llama'];
    console.log('⚠️  Force mode: Downloading all models regardless of compatibility.\n');
  } else {
    // Auto-detect and download compatible models
    modelsToDownload = recommendation.models;
  }
  
  if (modelsToDownload.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  ℹ️  No models to download                                  ║
║  The app will use Intel Database patterns for detection    ║
║  Run with --force-all to download anyway                   ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    // Save system info for the app
    const systemReport = {
      analyzed: new Date().toISOString(),
      system: systemInfo,
      compatibility,
      modelsDownloaded: []
    };
    fs.writeFileSync(path.join(MODELS_DIR, 'system-report.json'), JSON.stringify(systemReport, null, 2));
    return;
  }
  
  // Download models
  const results = {};
  for (const modelKey of modelsToDownload) {
    results[modelKey] = await downloadModel(modelKey);
  }
  
  // Save global manifest with system info
  const globalManifest = {
    lastUpdated: new Date().toISOString(),
    system: {
      platform: systemInfo.platform,
      ram: systemInfo.totalRAM,
      gpu: systemInfo.gpu,
      webgpuSupported: systemInfo.webgpuSupported
    },
    models: {}
  };
  
  for (const modelKey of Object.keys(MODELS)) {
    const manifestPath = path.join(MODELS_DIR, MODELS[modelKey].outputDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      globalManifest.models[modelKey] = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
  }
  
  fs.writeFileSync(path.join(MODELS_DIR, 'manifest.json'), JSON.stringify(globalManifest, null, 2));
  
  // Summary
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  📊 DOWNLOAD SUMMARY                                       ║
╠════════════════════════════════════════════════════════════╣`);
  
  for (const [model, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    const name = MODELS[model].name.padEnd(20);
    const version = `v${MODELS[model].version}`;
    console.log(`║  ${icon} ${name} ${version.padEnd(10)} ${MODELS[model].size.padEnd(10)} ║`);
  }
  
  console.log(`╠════════════════════════════════════════════════════════════╣
║  Models stored in: public/models/                          ║
║  Run: npm run dev                                          ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  // Print browser requirements
  if (modelsToDownload.includes('llama')) {
    console.log(`
📌 BROWSER REQUIREMENTS FOR LLAMA:
   • Chrome 113+ or Edge 113+
   • WebGPU must be enabled
   • Visit chrome://gpu to verify WebGPU status
    `);
  }
}

main().catch(console.error);
