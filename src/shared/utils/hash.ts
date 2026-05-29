/**
 * Hash utilities for checksums and integrity verification
 */

/**
 * Simple checksum algorithm using djb2 hash
 * Fast and good for integrity checking (not cryptographic)
 */
export function calculateChecksum(data: string): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash) + data.charCodeAt(i);
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verify checksum matches expected value
 */
export function verifyChecksum(data: string, checksum: string): boolean {
  return calculateChecksum(data) === checksum;
}

/**
 * Generate a simple content hash for data integrity
 */
export function hashObject(obj: Record<string, unknown>): string {
  return calculateChecksum(JSON.stringify(obj));
}
