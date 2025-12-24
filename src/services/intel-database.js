/**
 * Intel Database - Predefined patterns and keywords for different document types
 * This provides domain-specific knowledge for accurate PII detection
 */

// Document type presets with patterns and keywords
export const INTEL_PRESETS = {
  'bank-statement': {
    name: 'Bank Statement',
    icon: '🏦',
    description: 'Account numbers, routing numbers, balances, transactions',
    patterns: [
      // Account numbers (various formats)
      /\b\d{8,17}\b/g,  // Generic account numbers
      /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g,  // 9-digit formats
      // Routing numbers (ABA)
      /\b\d{9}\b/g,
      // SWIFT/BIC codes
      /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\b/g,
      // IBAN
      /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
      // Credit card numbers
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      /\b\d{15,16}\b/g,
      // Currency amounts
      /\$[\d,]+\.?\d*/g,
      /£[\d,]+\.?\d*/g,
      /€[\d,]+\.?\d*/g,
    ],
    keywords: [
      'account number', 'routing number', 'swift', 'iban', 'balance',
      'available balance', 'current balance', 'account holder',
      'card number', 'debit', 'credit', 'transaction', 'wire transfer',
      'beneficiary', 'remitter', 'sort code', 'bsb', 'branch'
    ],
    contextClues: [
      'statement period', 'account summary', 'transaction history',
      'opening balance', 'closing balance', 'total credits', 'total debits'
    ]
  },

  'medical-record': {
    name: 'Medical Record',
    icon: '🏥',
    description: 'Patient IDs, diagnoses, medications, provider info',
    patterns: [
      // Medical Record Numbers (MRN)
      /\b[A-Z]?\d{6,10}\b/g,
      // National Provider Identifier (NPI)
      /\b\d{10}\b/g,
      // DEA numbers
      /\b[A-Z]{2}\d{7}\b/g,
      // ICD codes
      /\b[A-Z]\d{2}\.?\d{0,2}\b/g,
      // CPT codes
      /\b\d{5}\b/g,
      // Dates (DOB, admission, discharge)
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      // Phone numbers
      /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    ],
    keywords: [
      'patient', 'dob', 'date of birth', 'mrn', 'medical record',
      'diagnosis', 'medication', 'prescription', 'dosage', 'physician',
      'provider', 'npi', 'insurance', 'policy number', 'member id',
      'blood type', 'allergies', 'condition', 'treatment', 'procedure',
      'ssn', 'social security', 'medicare', 'medicaid', 'hipaa'
    ],
    contextClues: [
      'chief complaint', 'history of present illness', 'physical exam',
      'assessment', 'plan', 'discharge summary', 'lab results'
    ]
  },

  'legal-document': {
    name: 'Legal Document',
    icon: '⚖️',
    description: 'Case numbers, party names, addresses, sensitive clauses',
    patterns: [
      // Case numbers
      /\b\d{1,4}[-:]\w{2,4}[-:]\d{4,8}\b/g,
      /\bCase\s*(?:No\.?|#)\s*[\w\-]+/gi,
      // Bar numbers
      /\bBar\s*(?:No\.?|#)\s*\d+/gi,
      // Docket numbers
      /\bDocket\s*(?:No\.?|#)\s*[\w\-]+/gi,
      // Dates
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      // Addresses
      /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\.?/gi,
      // ZIP codes
      /\b\d{5}(?:-\d{4})?\b/g,
    ],
    keywords: [
      'plaintiff', 'defendant', 'petitioner', 'respondent', 'attorney',
      'counsel', 'witness', 'testimony', 'affidavit', 'deposition',
      'settlement', 'judgment', 'verdict', 'liability', 'damages',
      'confidential', 'privileged', 'sealed', 'exhibit', 'evidence'
    ],
    contextClues: [
      'court of', 'in the matter of', 'hereby', 'whereas', 'jurisdiction',
      'stipulation', 'motion', 'order', 'brief', 'memorandum'
    ]
  },

  'employment': {
    name: 'Employment / HR',
    icon: '👔',
    description: 'Employee IDs, salaries, SSN, performance data',
    patterns: [
      // SSN
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      // Employee IDs
      /\b[A-Z]{1,3}\d{4,8}\b/g,
      /\bEMP[-\s]?\d+/gi,
      // Salaries
      /\$[\d,]+(?:\.\d{2})?(?:\s*(?:\/\s*(?:year|yr|month|mo|hour|hr|week|wk)))?/gi,
      // Phone numbers
      /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      // Dates
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    ],
    keywords: [
      'employee', 'employer', 'salary', 'compensation', 'bonus', 'ssn',
      'social security', 'tax id', 'ein', 'w2', 'w4', 'i9', 'direct deposit',
      'bank account', 'performance', 'review', 'termination', 'hire date',
      'manager', 'supervisor', 'department', 'title', 'position'
    ],
    contextClues: [
      'human resources', 'payroll', 'benefits', 'employment agreement',
      'offer letter', 'termination letter', 'performance review'
    ]
  },

  'identity': {
    name: 'Identity Documents',
    icon: '🪪',
    description: 'Passports, driver licenses, ID cards, personal info',
    patterns: [
      // SSN
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      // Passport numbers (various formats)
      /\b[A-Z]{1,2}\d{6,9}\b/g,
      // Driver license (varies by state/country)
      /\b[A-Z]\d{7,8}\b/g,
      /\b\d{1,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3,4}\b/g,
      // Dates
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      // Addresses
      /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\.?/gi,
    ],
    keywords: [
      'passport', 'driver license', 'drivers license', 'id card', 'ssn',
      'social security', 'date of birth', 'dob', 'place of birth', 'pob',
      'nationality', 'citizenship', 'address', 'residence', 'expiry',
      'issue date', 'issuing authority', 'sex', 'gender', 'height', 'weight'
    ],
    contextClues: [
      'identification', 'verified', 'photo id', 'government issued'
    ]
  },

  'financial': {
    name: 'Financial / Tax',
    icon: '💰',
    description: 'Tax returns, investments, income, financial accounts',
    patterns: [
      // SSN/TIN/EIN
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      /\b\d{2}[-\s]?\d{7}\b/g,
      // Account numbers
      /\b\d{8,17}\b/g,
      // Currency
      /\$[\d,]+\.?\d*/g,
      // Tax form numbers
      /\b1099[-\s]?[A-Z]{1,4}\b/gi,
      /\bW[-\s]?[249]\b/gi,
    ],
    keywords: [
      'income', 'tax', 'gross', 'net', 'deduction', 'exemption', 'refund',
      'agi', 'adjusted gross', 'taxable', 'withholding', 'fica', 'medicare',
      'investment', 'dividend', 'capital gain', 'interest', 'portfolio',
      'brokerage', 'retirement', '401k', 'ira', 'roth', 'pension'
    ],
    contextClues: [
      'tax return', 'form 1040', 'schedule', 'irs', 'internal revenue',
      'fiscal year', 'tax year', 'quarterly', 'annual report'
    ]
  },

  'insurance': {
    name: 'Insurance',
    icon: '🛡️',
    description: 'Policy numbers, claims, coverage details',
    patterns: [
      // Policy numbers
      /\b[A-Z]{2,4}[-\s]?\d{6,12}\b/g,
      // Claim numbers
      /\b(?:CLM|CLAIM)[-\s]?\d+/gi,
      // Group numbers
      /\b(?:GRP|GROUP)[-\s]?\d+/gi,
      // Member IDs
      /\b(?:MEM|MEMBER)[-\s]?\d+/gi,
      // Dates
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      // Currency
      /\$[\d,]+\.?\d*/g,
    ],
    keywords: [
      'policy', 'policyholder', 'insured', 'beneficiary', 'premium',
      'deductible', 'copay', 'coverage', 'claim', 'claimant', 'adjuster',
      'liability', 'exclusion', 'rider', 'endorsement', 'effective date',
      'expiration', 'renewal', 'underwriting', 'actuarial'
    ],
    contextClues: [
      'certificate of insurance', 'proof of insurance', 'declarations page',
      'policy schedule', 'coverage summary'
    ]
  },

  'custom': {
    name: 'Custom Keywords',
    icon: '✏️',
    description: 'Your own keywords and patterns',
    patterns: [],
    keywords: [],
    contextClues: []
  }
};

// Common PII patterns used across all document types
export const COMMON_PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  date: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
  url: /https?:\/\/[^\s<>"']+/g,
  // Currency with various formats
  currency: /\$[\d,]+(?:\.\d{2})?\b/g,
  // Account numbers in context
  accountNum: /\b(?:account|acct\.?|acc)\s*#?\s*:?\s*([A-Z0-9]{4,20})\b/gi,
};

// Name-related patterns for extracting people's names
export const NAME_PATTERNS = {
  // Names with titles
  titled: /\b(?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?|Rev\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g,
  // Names after common labels
  labeled: /\b(?:name|patient|client|customer|employee|applicant|defendant|plaintiff|author|contact|attn|attention|from|to|by|signed)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/gi,
  // Names in "Last, First" format
  lastFirst: /\b([A-Z][a-z]+),\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?)\b/g,
  // Standalone capitalized names (2-3 words, more conservative)
  standalone: /\b([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15})?)\b/g,
};

/**
 * Scan text using intel database patterns
 * @param {string} text - Text to scan
 * @param {string[]} activePresets - Array of preset IDs to use
 * @param {string[]} customKeywords - Additional custom keywords
 * @returns {string[]} - Array of detected entities
 */
export function scanWithIntel(text, activePresets = [], customKeywords = []) {
  const findings = new Set();
  const textLower = text.toLowerCase();

  // Always scan for common PII
  Object.values(COMMON_PII_PATTERNS).forEach(pattern => {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    matches.forEach(m => findings.add(m.trim()));
  });

  // Try to detect names
  Object.values(NAME_PATTERNS).forEach(pattern => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Get the captured group or full match
      const name = match[1] || match[0];
      if (name && name.length > 3 && !isCommonWord(name)) {
        findings.add(name.trim());
      }
    }
  });

  // Scan with each active preset
  activePresets.forEach(presetId => {
    const preset = INTEL_PRESETS[presetId];
    if (!preset) return;

    // Pattern matching
    preset.patterns.forEach(pattern => {
      // Reset lastIndex for global patterns
      if (pattern.global) pattern.lastIndex = 0;
      const matches = text.match(pattern) || [];
      matches.forEach(m => {
        // Filter out very short matches that are likely false positives
        if (m.length >= 3) findings.add(m.trim());
      });
    });

    // Keyword-based extraction (find values near keywords)
    preset.keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      let idx = textLower.indexOf(keywordLower);
      while (idx !== -1) {
        // Extract context around keyword (100 chars after)
        const context = text.substring(idx, idx + 100);
        
        // Look for values after the keyword (colon, equals, or just space separated)
        const valueMatch = context.match(/^[^:=\n]*[:=]?\s*([^\n,;]{2,50})/);
        if (valueMatch && valueMatch[1]) {
          const value = valueMatch[1].trim();
          // Don't add if it's just the keyword or common words
          if (value.length > 2 && 
              value.toLowerCase() !== keywordLower &&
              !isCommonWord(value)) {
            findings.add(value);
          }
        }
        
        idx = textLower.indexOf(keywordLower, idx + 1);
      }
    });
  });

  // Add custom keywords (exact match)
  customKeywords.forEach(keyword => {
    if (keyword.trim() && textLower.includes(keyword.toLowerCase())) {
      // Find all case-preserved occurrences
      let idx = textLower.indexOf(keyword.toLowerCase());
      while (idx !== -1) {
        findings.add(text.substring(idx, idx + keyword.length));
        idx = textLower.indexOf(keyword.toLowerCase(), idx + 1);
      }
    }
  });

  // Convert to array and filter
  return Array.from(findings).filter(item => {
    // Filter out items that are too short or just whitespace
    const trimmed = item.trim();
    return trimmed.length >= 2;
  });
}

/**
 * Check if a word/phrase is a common word that shouldn't be flagged
 */
function isCommonWord(text) {
  const common = [
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'for',
    'with', 'this', 'that', 'from', 'have', 'has', 'had', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'not', 'all', 'any',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'than', 'too', 'very', 'just', 'only', 'also', 'even', 'still', 'yet',
    'account', 'number', 'date', 'name', 'address', 'phone', 'email',
    'statement', 'record', 'document', 'page', 'total', 'amount', 'balance',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
  return common.includes(text.toLowerCase().trim());
}

/**
 * Get all available presets
 * @returns {Object[]} Array of preset info
 */
export function getPresets() {
  return Object.entries(INTEL_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.name,
    icon: preset.icon,
    description: preset.description
  }));
}

/**
 * Load custom keywords from localStorage
 * @returns {string[]}
 */
export function loadCustomKeywords() {
  try {
    const saved = localStorage.getItem('redactor-custom-keywords');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Save custom keywords to localStorage
 * @param {string[]} keywords
 */
export function saveCustomKeywords(keywords) {
  localStorage.setItem('redactor-custom-keywords', JSON.stringify(keywords));
}

/**
 * Load active presets from localStorage
 * @returns {string[]}
 */
export function loadActivePresets() {
  try {
    const saved = localStorage.getItem('redactor-active-presets');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Save active presets to localStorage
 * @param {string[]} presets
 */
export function saveActivePresets(presets) {
  localStorage.setItem('redactor-active-presets', JSON.stringify(presets));
}
