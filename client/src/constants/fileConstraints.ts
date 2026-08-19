/** Document upload limits — Global Constraints (Plan 1): max 10MB, PDF/DOCX only. */
export const FILE = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_SIZE_LABEL: "10MB",
  ALLOWED_PATTERN: /\.(pdf|docx)$/i
} as const;
