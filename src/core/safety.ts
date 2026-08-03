import type { SensitiveFinding } from "../types/context-package";

const FINDING_RULES: Array<{
  type: string;
  label: string;
  severity: SensitiveFinding["severity"];
  pattern: RegExp;
}> = [
  {
    type: "api_key",
    label: "API key-like string",
    severity: "high",
    pattern: /\b(?:sk|AIza|ghp)_[A-Za-z0-9_\-]{12,}\b/g,
  },
  {
    type: "password",
    label: "Password or credential mention",
    severity: "high",
    pattern: /\b(password|passwd|secret|token|credential|private key|connection string)\b/i,
  },
  {
    type: "jwt",
    label: "JWT-like token",
    severity: "high",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g,
  },
  {
    type: "aws_key",
    label: "AWS access key pattern",
    severity: "high",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    type: "patient",
    label: "Patient-related information",
    severity: "high",
    pattern: /\b(patient|diagnosis|medical record|care home|elderly care)\b/i,
  },
  {
    type: "business",
    label: "Business-sensitive wording",
    severity: "medium",
    pattern: /\b(confidential|internal only|nda|pricing|revenue|roadmap)\b/i,
  },
  {
    type: "personal",
    label: "Personal identifier pattern",
    severity: "medium",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    type: "email",
    label: "Email address",
    severity: "medium",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: "phone",
    label: "Phone number",
    severity: "medium",
    pattern: /\b(?:\+?\d{1,2}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g,
  },
  {
    type: "card",
    label: "Payment card-like number",
    severity: "high",
    pattern: /\b(?:\d[ -]*?){15,16}\b/g,
  },
  {
    type: "ipv4",
    label: "IP address",
    severity: "low",
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },
];

const REDACTION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(?:sk|AIza|ghp)_[A-Za-z0-9_\-]{12,}\b/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED_AWS_KEY]" },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, replacement: "[REDACTED_JWT]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED_SSN]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { pattern: /\b(?:\+?\d{1,2}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g, replacement: "[REDACTED_PHONE]" },
  { pattern: /\b(?:\d[ -]*?){15,16}\b/g, replacement: "[REDACTED_CARD]" },
  {
    pattern: /\b(password|passwd|secret|token|credential|private key|connection string)\s*[:=]?\s*\S+/gi,
    replacement: "[REDACTED_CREDENTIAL]",
  },
];

export function scanSensitiveContent(text: string): SensitiveFinding[] {
  const findings = new Map<string, SensitiveFinding>();

  for (const rule of FINDING_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) {
      findings.set(rule.type, {
        type: rule.type,
        label: rule.label,
        severity: rule.severity,
      });
    }
  }

  return [...findings.values()];
}

export function redactSensitiveContent(text: string): string {
  return REDACTION_RULES.reduce((current, rule) => current.replace(rule.pattern, rule.replacement), text);
}
