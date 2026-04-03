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
      // UK Sort Codes (xx-xx-xx format) - highly specific
      /\b\d{2}-\d{2}-\d{2}\b/g,

      // Account Numbers (8 digits, often isolated)
      /\b\d{8}\b/g,

      // US Routing Numbers (ABA) - exactly 9 digits
      /\b\d{9}\b/g,

      // Account numbers with context (more specific to avoid false positives)
      /\b(?:account|acct\.?|acc)[\s:#]*(\d{8,17})\b/gi,

      // IBAN - International Bank Account Numbers (more robust)
      /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,

      // SWIFT/BIC codes (enhanced validation)
      /\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b/g,

      // Credit/Debit Card Numbers (with or without spaces/dashes)
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      /\b\d{13,19}\b/g,  // Card numbers without separators

      // BSB Numbers (Australian bank codes) - XXX-XXX format
      /\b\d{3}-\d{3}\b/g,

      // Transaction Amounts - ROBUST pattern for various currency formats
      // Matches: £1,200.00 | $1,200.00 | 1,200.00 | -50.00 | 50.00 CR | 50.00 DR | €1.200,00
      /(?:[£$€¥]\s?)?-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?(?:\s?(?:CR|DR|USD|GBP|EUR|JPY))?\b/g,

      // Alternative currency format (European) - 1.200,00
      /(?:[£$€¥]\s?)?\d{1,3}(?:\.\d{3})*(?:,\d{2})(?:\s?(?:CR|DR|USD|GBP|EUR|JPY))?\b/g,

      // Bank Statement Reference Numbers (often alphanumeric)
      /\b(?:REF|REFERENCE|TXN|TRANS)[\s:#]*([A-Z0-9]{6,20})\b/gi,

      // Check/Cheque Numbers
      /\b(?:CHECK|CHEQUE|CHK)[\s:#]*(\d{3,8})\b/gi,

      // Wire Transfer Numbers
      /\b(?:WIRE|FED|FEDWIRE)[\s:#]*([A-Z0-9]{8,20})\b/gi,
    ],
    keywords: [
      'account number', 'routing number', 'swift code', 'bic code', 'iban',
      'balance', 'available balance', 'current balance', 'ledger balance',
      'account holder', 'account name', 'beneficiary name',
      'card number', 'debit card', 'credit card', 'pan',
      'transaction', 'transfer', 'payment', 'deposit', 'withdrawal',
      'wire transfer', 'ach', 'direct debit', 'standing order',
      'beneficiary', 'payee', 'remitter', 'payer',
      'sort code', 'bsb', 'branch code', 'bank code',
      'reference number', 'transaction id', 'confirmation number',
      'check number', 'cheque number'
    ],
    contextClues: [
      'statement period', 'account summary', 'transaction history',
      'opening balance', 'closing balance', 'total credits', 'total debits',
      'beginning balance', 'ending balance', 'ytd', 'year to date',
      'previous balance', 'new balance', 'statement date'
    ]
  },

  'medical-record': {
    name: 'Medical Record',
    icon: '🏥',
    description: 'Patient IDs, diagnoses, medications, provider info',
    patterns: [
      // Medical Record Numbers (MRN) - with context
      /\b(?:MRN|MEDICAL\s*RECORD|PATIENT\s*ID)[\s:#]*([A-Z0-9]{6,12})\b/gi,
      /\b[A-Z]{1,3}\d{6,10}\b/g,  // Generic MRN format

      // National Provider Identifier (NPI) - exactly 10 digits
      /\b(?:NPI)[\s:#]*(\d{10})\b/gi,
      /\b(?<!\d)\d{10}(?!\d)\b/g,  // Standalone 10-digit numbers

      // DEA numbers (Format: 2 letters + 7 digits)
      /\b[A-Z]{2}\d{7}\b/g,

      // ICD-10 Codes (A00.0 to Z99.9 format)
      /\b[A-TV-Z]\d{2}\.?\d{0,4}\b/g,

      // CPT/HCPCS Codes (5-digit medical procedure codes)
      /\b(?:CPT)[\s:#]*(\d{5})\b/gi,
      /\b(?<!\d)\d{5}(?!\d)\b/g,  // Standalone 5-digit codes

      // Medicare/Medicaid Numbers
      /\b[A-Z]{1,3}\d{2}-[A-Z]{2}-\d{4}\b/g,  // Medicare format
      /\b\d{3}-\d{2}-\d{4}[A-Z]?\b/g,  // SSN-based format

      // Health Insurance Policy Numbers
      /\b(?:POLICY|MEMBER|SUBSCRIBER)[\s:#]*([A-Z0-9]{6,20})\b/gi,

      // Prescription Numbers
      /\b(?:RX|PRESCRIPTION)[\s:#]*([A-Z0-9]{6,15})\b/gi,

      // Phone numbers (for medical contacts)
      /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

      // Dates in various formats (DOB, admission, etc.)
      /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)?\d{2}\b/g,
      /\b(?:19|20)\d{2}[\/-](?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])\b/g,
    ],
    keywords: [
      'patient', 'patient name', 'patient id', 'dob', 'date of birth', 'age',
      'mrn', 'medical record number', 'hospital number',
      'diagnosis', 'diagnosed', 'medication', 'prescription', 'rx', 'dosage', 'dose',
      'physician', 'doctor', 'dr.', 'provider', 'practitioner', 'npi',
      'insurance', 'insurer', 'policy number', 'member id', 'subscriber id',
      'blood type', 'blood group', 'allergies', 'allergy', 'condition', 'treatment', 'procedure',
      'ssn', 'social security', 'medicare number', 'medicaid number',
      'emergency contact', 'next of kin', 'health record', 'phi', 'hipaa',
      'admit date', 'discharge date', 'attending', 'consultant'
    ],
    contextClues: [
      'chief complaint', 'history of present illness', 'hpi', 'physical exam', 'pe',
      'assessment', 'plan', 'assessment and plan', 'discharge summary',
      'lab results', 'vital signs', 'progress note', 'admission note',
      'consultation', 'operative report', 'radiology report'
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
      // SSN (for tax/payroll documents)
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

      // Employee ID Numbers - various formats
      /\b(?:EMPLOYEE\s*ID|EMP\s*ID|STAFF\s*ID|PERSONNEL)[\s:#]*([A-Z0-9]{4,12})\b/gi,
      /\b[A-Z]{1,3}\d{4,8}\b/g,  // Common format: ABC12345
      /\bEMP[-\s]?\d{4,8}\b/gi,  // EMP-12345
      /\b\d{6,8}\b/g,  // Simple numeric IDs

      // Salary/Compensation - comprehensive patterns
      /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:per|\/)\s*(?:year|annum|yr|month|mo|hour|hr|week|wk|bi-?weekly))?\b/gi,
      /(?:salary|compensation|pay|wage)[\s:]*\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/gi,

      // Bank Account Numbers (for direct deposit)
      /\b(?:ACCOUNT|ACCT|DIRECT\s*DEPOSIT)[\s:#]*(\d{8,17})\b/gi,

      // Tax IDs / EIN (Employer Identification Number)
      /\b(?:EIN|TAX\s*ID)[\s:#]*(\d{2}-\d{7})\b/gi,
      /\b\d{2}-\d{7}\b/g,  // EIN format: 12-3456789

      // Performance Rating Numbers
      /\b(?:RATING|SCORE|PERFORMANCE)[\s:#]*(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\b/gi,

      // Phone Numbers
      /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

      // Emergency Contact Numbers
      /\b(?:EMERGENCY|CONTACT)[\s:]+(?:[A-Z][a-z]+\s+[A-Z][a-z]+)\b/gi,

      // Dates (hire, termination, review dates)
      /\b(?:HIRE|START|TERMINATION|REVIEW)\s*(?:DATE)?[\s:#]*([\d\/\-]+)\b/gi,
      /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)?\d{2}\b/g,
    ],
    keywords: [
      'employee', 'employee id', 'employee number', 'staff id',
      'employer', 'company', 'organization',
      'salary', 'wage', 'compensation', 'pay', 'earnings', 'income',
      'bonus', 'commission', 'overtime', 'benefits', 'allowance',
      'ssn', 'social security number', 'social security',
      'tax id', 'ein', 'employer identification',
      'w2', 'w-2', 'w4', 'w-4', 'i9', 'i-9', 'tax form',
      'direct deposit', 'bank account', 'routing number', 'payroll',
      'performance', 'performance review', 'evaluation', 'rating', 'assessment',
      'termination', 'resignation', 'hire date', 'start date', 'end date',
      'manager', 'supervisor', 'reporting to', 'reports to',
      'department', 'division', 'title', 'position', 'role', 'job title',
      'emergency contact', 'next of kin', 'personal reference'
    ],
    contextClues: [
      'human resources', 'hr department', 'personnel',
      'payroll', 'payslip', 'pay stub', 'compensation statement',
      'benefits', 'benefits package', 'health insurance', '401k',
      'employment agreement', 'employment contract', 'offer letter',
      'termination letter', 'resignation letter',
      'performance review', 'annual review', 'evaluation',
      'confidential', 'employee records', 'personnel file'
    ]
  },

  'identity': {
    name: 'Identity Documents',
    icon: '🪪',
    description: 'Passports, driver licenses, ID cards, personal info',
    patterns: [
      // SSN (Social Security Number) - US format with optional separators
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

      // Passport Numbers - International formats
      /\b(?:PASSPORT|PASS)[\s:#]*([A-Z0-9]{6,12})\b/gi,
      /\b[A-Z]{1,2}\d{6,9}\b/g,  // UK, EU format (e.g., AB1234567)
      /\b\d{9}\b/g,  // US format (9 digits)
      /\b[A-Z]\d{8}\b/g,  // Australian format

      // Driver License Numbers - Various state formats
      /\b(?:DL|LICENSE|LICENCE|DRIVER)[\s:#]*([A-Z0-9]{6,20})\b/gi,
      /\b[A-Z]\d{7,14}\b/g,  // Common US format
      /\b\d{1,3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{3,4}\b/g,  // Canadian format

      // National ID Numbers (various countries)
      /\b(?:NATIONAL\s*ID|ID\s*NUMBER|IDENTITY)[\s:#]*([A-Z0-9]{6,20})\b/gi,

      // Dates of Birth in multiple formats
      /\b(?:DOB|DATE\s*OF\s*BIRTH)[\s:#]*([\d\/\-]+)\b/gi,
      /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g,
      /\b(?:19|20)\d{2}[\/-](?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])\b/g,

      // Full Addresses (street, city, postal code)
      /\b\d+\s+[\w\s]+(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.|Drive|Dr\.|Lane|Ln\.|Court|Ct\.|Way|Place|Pl\.)(?:[\s,]+[\w\s]+)?\b/gi,

      // ZIP/Postal Codes
      /\b\d{5}(?:-\d{4})?\b/g,  // US ZIP
      /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g,  // Canadian postal code
      /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/g,  // UK postcode

      // Visa Numbers
      /\b(?:VISA)[\s:#]*([A-Z0-9]{8,12})\b/gi,
    ],
    keywords: [
      'passport', 'passport number', 'pass no', 'pass #',
      'driver license', 'drivers license', 'driving licence', 'dl number',
      'id card', 'identification card', 'national id', 'citizen id',
      'ssn', 'social security number', 'social security',
      'date of birth', 'dob', 'birth date', 'place of birth', 'pob', 'birthplace',
      'nationality', 'citizenship', 'citizen', 'country of birth',
      'address', 'residential address', 'residence', 'home address', 'street address',
      'expiry', 'expiration', 'expires', 'valid until', 'issue date', 'issued',
      'issuing authority', 'issued by', 'authority',
      'sex', 'gender', 'male', 'female', 'height', 'weight', 'eye color', 'hair color',
      'full name', 'first name', 'last name', 'surname', 'given name', 'family name',
      'visa', 'visa number', 'permit', 'green card', 'alien number'
    ],
    contextClues: [
      'identification', 'identity verification', 'verified', 'photo id',
      'government issued', 'official document', 'valid id',
      'immigration', 'travel document', 'border control'
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
  // Email addresses (comprehensive, handles + and special chars)
  email: /\b[A-Za-z0-9][\w.%+-]*@[A-Za-z0-9][\w.-]*\.[A-Za-z]{2,}\b/g,

  // Phone Numbers - International and US formats
  // Handles: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, etc.
  phone: /\b(?:\+?1[-.\s]?)?\(?(?:[2-9]\d{2})\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  phoneInternational: /\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,

  // SSN - US Social Security Numbers
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  ssnContext: /\b(?:SSN|SOCIAL\s*SECURITY|SOC\s*SEC)[\s:#]*(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/gi,

  // Dates in various international formats
  dateUS: /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)?\d{2}\b/g,  // MM/DD/YYYY
  dateISO: /\b(?:19|20)\d{2}[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])\b/g,  // YYYY-MM-DD
  dateEU: /\b(?:0?[1-9]|[12]\d|3[01])[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:19|20)\d{2}\b/g,   // DD/MM/YYYY

  // IPv4 Addresses
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g,

  // IPv6 Addresses (simplified)
  ipv6: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,

  // Credit Card Numbers - Major card types
  // Matches Visa, Mastercard, Amex, Discover with or without spaces/dashes
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,  // 16-digit with separators
  creditCardPlain: /\b(?:3[47]\d{13}|4\d{15}|5[1-5]\d{14}|6(?:011|5\d{2})\d{12})\b/g,  // Without separators

  // ZIP/Postal Codes
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,  // US ZIP
  postalCodeCA: /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g,  // Canadian
  postalCodeUK: /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/g,  // UK

  // URLs and Domains
  url: /https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-z]{2,6}\b(?:[-\w@:%+.~#?&/=]*)/gi,
  domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,6}\b/gi,

  // Currency - Multiple formats and symbols
  currencyUSD: /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
  currencyGBP: /£\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g,
  currencyEUR: /€\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g,
  currencyGeneric: /(?:[£$€¥]\s?)?-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?(?:\s?(?:USD|GBP|EUR|JPY|CAD|AUD))?\b/g,

  // Account Numbers (with context keywords)
  accountNum: /\b(?:account|acct\.?|acc|a\/c)[\s#:]*([A-Z0-9]{6,20})\b/gi,

  // Routing Numbers (ABA format - US banks)
  routingNumber: /\b(?:routing|aba|rtn)[\s#:]*(\d{9})\b/gi,

  // MAC Addresses
  macAddress: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,

  // Bitcoin/Crypto Wallet Addresses (basic)
  bitcoinAddress: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,

  // Vehicle Identification Numbers (VIN)
  vin: /\b[A-HJ-NPR-Z0-9]{17}\b/g,

  // License Plate Numbers (US format - simplified)
  licensePlate: /\b[A-Z]{1,3}[-\s]?\d{1,4}[-\s]?[A-Z]{0,2}\b/g,
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
