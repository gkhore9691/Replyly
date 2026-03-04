export const PII_PATTERNS: RegExp[] = [
  /\b\d{16}\b/,   // card number
  /\b\d{3}-\d{2}-\d{4}\b/,  // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // email (optional use)
];
