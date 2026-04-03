# Privacy Policy - Zero-Trust Redactor

**Last Updated:** December 24, 2025  
**Version:** 2.0.0

---

## 🔒 Our Commitment to Privacy

Zero-Trust Redactor is designed with **Privacy by Design** principles. Your documents and data **never leave your device** during processing. The only network activity is one-time downloads of model files and JavaScript libraries from trusted CDNs during setup/page load; no document content is transmitted.

---

## 1. Data Collection

### What We DON'T Collect
- ❌ Your PDF documents or their contents
- ❌ Detected PII (names, emails, SSN, etc.)
- ❌ Usage analytics or telemetry
- ❌ IP addresses or location data
- ❌ Personal information of any kind
- ❌ Cookies for tracking purposes

### What We DO Store (Locally Only)
- ✅ User preferences (dark mode, presets) - stored in browser localStorage
- ✅ AI models (BERT, Llama) - cached in browser IndexedDB
- ✅ Custom keywords you add - stored in browser localStorage

**All data is stored locally on YOUR device and is never transmitted.**

---

## 2. Data Processing

### How Your Documents Are Processed

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR DEVICE ONLY                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PDF Upload → AI Analysis → Entity Detection        │    │
│  │  (All processing happens in your browser)           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Redaction → localhost:5000 (your machine only)     │    │
│  │  (Python server runs on YOUR computer)              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
                    ❌ NO EXTERNAL SERVERS
                    ❌ NO CLOUD STORAGE
                    ❌ NO DATA TRANSMISSION
```

### AI Model Processing
- BERT NER model runs entirely in your browser using WebAssembly
- Llama model runs locally using WebGPU (your GPU)
- Models are downloaded once from Hugging Face/CDNs and cached locally
- JavaScript libraries (e.g., transformers) are fetched from jsDelivr/CDN
- No API calls to external AI services for your document content

---

## 3. Third-Party Services

### Services Used

| Service | Purpose | Data Sent |
|---------|---------|-----------|
| Hugging Face CDN | Model download (one-time) | None - just downloads files |
| jsDelivr CDN | JavaScript libraries | None - just downloads code |

### No Third-Party Analytics
- ❌ No Google Analytics
- ❌ No Facebook Pixel
- ❌ No Mixpanel
- ❌ No Sentry error tracking
- ❌ No hotjar or session recording

---

## 4. Data Retention

### Document Data
- **Retention Period:** 0 seconds
- Documents exist only in browser memory during processing
- Cleared immediately when you close the tab or click "Clear"
- No server-side storage whatsoever

### User Preferences
- Stored in browser localStorage
- Persists until you clear browser data
- You can clear anytime via browser settings

### AI Models
- Cached in browser IndexedDB
- Can be cleared via browser settings
- No personal data in model cache

---

## 5. Your Rights

Under GDPR, CCPA, and other privacy regulations, you have the right to:

| Right | How to Exercise |
|-------|-----------------|
| **Access** | All your data is already on your device |
| **Deletion** | Clear browser data or click "Clear All" |
| **Portability** | Export your preferences from localStorage |
| **Objection** | No processing to object to - it's all local |
| **Rectification** | Edit your preferences anytime |

### GDPR Compliance (EU)
- ✅ No personal data collection
- ✅ No data transfers outside your device
- ✅ Privacy by Design
- ✅ Data minimization (we collect nothing)

### CCPA Compliance (California)
- ✅ No sale of personal information
- ✅ No sharing with third parties
- ✅ Transparent data practices

### HIPAA Considerations (US Healthcare)
- ✅ PHI never leaves your device
- ✅ No cloud storage of health data
- ✅ Suitable for processing medical documents locally

---

## 6. Security Measures

### Technical Safeguards
- All processing in isolated browser sandbox
- No network requests during document analysis
- Local Python server bound to localhost only
- Temporary files deleted immediately after processing
- PDF metadata scrubbing included

### What We Recommend
- Use on a secure, updated device
- Don't use on shared/public computers
- Clear browser data after sensitive sessions

---

## 7. Children's Privacy

This application does not knowingly collect any information from anyone, including children under 13. Since no data is collected, COPPA compliance is inherent.

---

## 8. Changes to This Policy

We may update this policy to reflect changes in:
- Application features
- Legal requirements
- Best practices

Check this page for the latest version.

---

## 9. Contact

For privacy questions or concerns:
- Open an issue on GitHub
- Review the source code (it's open source)

---

## 10. Open Source Transparency

This application is open source. You can:
- Review all code to verify privacy claims
- Audit network requests
- Build from source yourself
- Modify for your needs

**Trust, but verify.** 🔍

---

*This privacy policy is designed to comply with GDPR (EU), CCPA (California), LGPD (Brazil), POPIA (South Africa), PDPA (Singapore), and other major data protection regulations.*
