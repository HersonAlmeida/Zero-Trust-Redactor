# Google Play & App Store Data Safety Documentation

## Zero-Trust Redactor

**Document Version:** 1.0  
**Last Updated:** December 24, 2025

---

## Google Play Data Safety Declaration

### Overview
This document provides the information required for Google Play's Data Safety section. Zero-Trust Redactor is designed with a zero-data-collection architecture.

---

### Data Collection and Sharing

#### Does your app collect or share any user data?
**No** - This app does not collect or share any user data.

---

### Data Safety Form Responses

#### 1. Data Types Collected
| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Location | ❌ No | N/A | N/A |
| Personal Info | ❌ No | N/A | N/A |
| Financial Info | ❌ No | N/A | N/A |
| Health & Fitness | ❌ No | N/A | N/A |
| Messages | ❌ No | N/A | N/A |
| Photos/Videos | ❌ No | N/A | N/A |
| Audio Files | ❌ No | N/A | N/A |
| Files & Docs | ❌ No* | N/A | N/A |
| Calendar | ❌ No | N/A | N/A |
| Contacts | ❌ No | N/A | N/A |
| App Activity | ❌ No | N/A | N/A |
| Web Browsing | ❌ No | N/A | N/A |
| App Info & Performance | ❌ No | N/A | N/A |
| Device or Other IDs | ❌ No | N/A | N/A |

*Files are processed locally and never transmitted or stored. The only network requests are one-time downloads of model files and JavaScript libraries from trusted CDNs during setup/page load; no document content is sent.

#### 2. Security Practices
| Question | Answer |
|----------|--------|
| Is data encrypted in transit? | N/A (no data transmitted) |
| Can users request data deletion? | N/A (no data stored) |
| Does the app follow Google Play Families Policy? | Not applicable |
| Has the app undergone independent security review? | Open source (publicly auditable) |

#### 3. Data Handling
```yaml
Data Retention: 0 seconds (data is not retained)
Data Location: User's device only (never server-side)
Data Deletion: Automatic (on app close)
Third-Party Access: None
```

---

### Apple App Store Privacy Labels

For iOS/macOS App Store submission:

#### Privacy Nutrition Label
```
Data Not Collected
This app does not collect any data.

Privacy practices may vary based on the features you use or your age.
```

#### Data Linked to You
- None

#### Data Used to Track You
- None

#### Data Not Linked to You
- None

---

## Chrome Web Store Declaration

### Privacy Practices

#### Single Purpose Description
```
Zero-Trust Redactor is a privacy-focused document redaction tool that 
automatically detects and removes sensitive personal information (PII) 
from PDF documents. All processing happens locally on your device - 
no data is ever sent to external servers.
```

#### Permission Justification
| Permission | Justification |
|------------|---------------|
| None | No special permissions required |

#### Data Usage
```
Type: Zero data collection
Reason: Privacy by design - all processing is local
Storage: Session only (cleared on close)
```

#### Remote Code
```
Does this extension use remote code? No

All code executes locally. The only external resources are:
1. AI model files (downloaded once, cached locally)
2. JavaScript libraries from CDN (page load only)

No code is fetched or executed from remote servers during operation.
```

---

## Microsoft Edge Add-ons

### Privacy Statement
```
Data Collection: None
Data Storage: Local only (browser storage)
Data Sharing: None
Third-Party Services: None (during document processing)
```

---

## Firefox Add-ons

### Data Practices Declaration
```yaml
Does this add-on collect data?
  - No data is collected

Does this add-on transmit data to remote servers?
  - No (except initial model download from public CDN)

What data is stored locally?
  - User preferences (optional)
  - Cached AI models (for offline use)

Is any data encrypted?
  - N/A (no data transmission)
```

---

## Technical Verification

### Network Isolation Test
Developers and reviewers can verify the zero-data-collection claim:

```bash
# 1. Open browser DevTools (F12)
# 2. Go to Network tab
# 3. Upload and process a document
# 4. Observe: NO external requests during document processing

# Expected network activity:
# - Initial page load: CDN for libraries
# - Model download: Hugging Face CDN (one-time)
# - Document processing: ONLY localhost:5000 (local server)
# - NO requests to: analytics, tracking, external APIs
```

### Code Audit Points
Reviewers can verify in source code:
- `src/main.js`: No analytics or tracking code
- `server.py`: Localhost-only Flask server
- `ai-engine.js`: Models run in browser/WebGPU
- No Google Analytics, Facebook Pixel, or similar SDKs

---

## Compliance Attestation

I, the developer of Zero-Trust Redactor, hereby attest that:

1. ✅ This application does not collect any user data
2. ✅ This application does not transmit document contents externally
3. ✅ This application does not include any tracking or analytics
4. ✅ This application processes all data locally on the user's device
5. ✅ This application is designed with privacy as a fundamental principle

---

## Contact for Compliance Questions

- Review the open-source code repository
- Open a GitHub issue for questions
- Check PRIVACY_POLICY.md for detailed privacy information
- Check COMPLIANCE.md for regulatory compliance details

---

*Document for Zero-Trust Redactor - Privacy First Architecture*
