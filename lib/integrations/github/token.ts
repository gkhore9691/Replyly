/**
 * Token storage helper. In production, use proper encryption (e.g. with ENCRYPTION_KEY).
 * For now returns the token as-is for development compatibility.
 */
export function encryptToken(token: string): string {
  return token;
}

export function decryptToken(encrypted: string): string {
  return encrypted;
}
