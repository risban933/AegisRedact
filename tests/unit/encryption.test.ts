/**
 * Unit tests for client-side encryption
 */

import { describe, it, expect } from 'vitest';
import { encryptFile, decryptFile } from '../../src/lib/crypto/encryption';

describe('File Encryption', () => {
  const testPassword = 'test-password-123456';
  const testSalt = 'dGVzdC1zYWx0LWZvci1lbmNyeXB0aW9u'; // base64: "test-salt-for-encryption"
  const testData = new TextEncoder().encode('This is sensitive test data');

  it('should encrypt and decrypt data correctly', async () => {
    // Encrypt
    const encrypted = await encryptFile(testData.buffer, testPassword, testSalt);

    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.encryptedData.byteLength).toBeGreaterThan(0);
    expect(encrypted.metadata.iv).toBeDefined();
    expect(encrypted.metadata.algorithm).toBe('AES-GCM');
    expect(encrypted.metadata.keyDerivation).toBe('PBKDF2');
    expect(encrypted.metadata.iterations).toBe(100000);

    // Decrypt
    const decrypted = await decryptFile(
      encrypted.encryptedData,
      testPassword,
      encrypted.metadata
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    expect(decryptedText).toBe('This is sensitive test data');
  });

  it('should produce different ciphertext with same data (different IVs)', async () => {
    const encrypted1 = await encryptFile(testData.buffer, testPassword, testSalt);
    const encrypted2 = await encryptFile(testData.buffer, testPassword, testSalt);

    // IVs should be different (random)
    expect(encrypted1.metadata.iv).not.toBe(encrypted2.metadata.iv);

    // Ciphertexts should be different
    const cipher1 = new Uint8Array(encrypted1.encryptedData);
    const cipher2 = new Uint8Array(encrypted2.encryptedData);
    expect(cipher1).not.toEqual(cipher2);

    // But both should decrypt to same plaintext
    const decrypted1 = await decryptFile(
      encrypted1.encryptedData,
      testPassword,
      encrypted1.metadata
    );
    const decrypted2 = await decryptFile(
      encrypted2.encryptedData,
      testPassword,
      encrypted2.metadata
    );

    expect(new Uint8Array(decrypted1)).toEqual(new Uint8Array(decrypted2));
  });

  it('should fail decryption with wrong password', async () => {
    const encrypted = await encryptFile(testData.buffer, testPassword, testSalt);

    await expect(
      decryptFile(encrypted.encryptedData, 'wrong-password', encrypted.metadata)
    ).rejects.toThrow('Decryption failed');
  });

  it('should fail decryption with corrupted data', async () => {
    const encrypted = await encryptFile(testData.buffer, testPassword, testSalt);

    // Corrupt the encrypted data
    const corruptedData = new Uint8Array(encrypted.encryptedData);
    corruptedData[0] ^= 0xFF; // Flip bits in first byte

    await expect(
      decryptFile(corruptedData.buffer, testPassword, encrypted.metadata)
    ).rejects.toThrow('Decryption failed');
  });

  it('should fail decryption with wrong IV', async () => {
    const encrypted = await encryptFile(testData.buffer, testPassword, testSalt);

    // Use wrong IV
    const wrongMetadata = {
      ...encrypted.metadata,
      iv: 'aW52YWxpZC1pdg==', // base64: "invalid-iv"
    };

    await expect(
      decryptFile(encrypted.encryptedData, testPassword, wrongMetadata)
    ).rejects.toThrow();
  });

  it('should handle empty data', async () => {
    const emptyData = new Uint8Array(0);
    const encrypted = await encryptFile(emptyData.buffer, testPassword, testSalt);

    expect(encrypted.encryptedData).toBeDefined();

    const decrypted = await decryptFile(
      encrypted.encryptedData,
      testPassword,
      encrypted.metadata
    );

    expect(decrypted.byteLength).toBe(0);
  });

  it('should handle large data', async () => {
    const largeData = new Uint8Array(5 * 1024 * 1024); // 5MB
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }

    const encrypted = await encryptFile(largeData.buffer, testPassword, testSalt);

    expect(encrypted.encryptedData.byteLength).toBeGreaterThan(largeData.length);

    const decrypted = await decryptFile(
      encrypted.encryptedData,
      testPassword,
      encrypted.metadata
    );

    expect(new Uint8Array(decrypted)).toEqual(largeData);
  });

  it('should use same salt for consistent key derivation', async () => {
    const data = new TextEncoder().encode('test');

    // Encrypt twice with same salt
    const encrypted1 = await encryptFile(data.buffer, testPassword, testSalt);
    const encrypted2 = await encryptFile(data.buffer, testPassword, testSalt);

    // Both should have the same salt
    expect(encrypted1.metadata.salt).toBe(testSalt);
    expect(encrypted2.metadata.salt).toBe(testSalt);

    // Both should decrypt successfully with same password
    const decrypted1 = await decryptFile(
      encrypted1.encryptedData,
      testPassword,
      encrypted1.metadata
    );
    const decrypted2 = await decryptFile(
      encrypted2.encryptedData,
      testPassword,
      encrypted2.metadata
    );

    expect(new Uint8Array(decrypted1)).toEqual(new Uint8Array(data));
    expect(new Uint8Array(decrypted2)).toEqual(new Uint8Array(data));
  });

  it('should fail with unsupported algorithm', async () => {
    const encrypted = await encryptFile(testData.buffer, testPassword, testSalt);

    const invalidMetadata = {
      ...encrypted.metadata,
      algorithm: 'INVALID-ALGO' as any,
    };

    await expect(
      decryptFile(encrypted.encryptedData, testPassword, invalidMetadata)
    ).rejects.toThrow('Unsupported encryption algorithm');
  });
});
