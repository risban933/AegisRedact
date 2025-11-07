/**
 * Client-side encryption for cloud storage
 * All encryption happens in the browser - server never sees unencrypted data
 */

export interface EncryptedFileData {
  encryptedData: ArrayBuffer;
  metadata: {
    iv: string; // Base64-encoded
    salt: string; // Base64-encoded
    algorithm: 'AES-GCM';
    keyDerivation: 'PBKDF2';
    iterations: number;
  };
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt file data for upload
 */
export async function encryptFile(
  fileData: ArrayBuffer,
  password: string,
  userSalt: string
): Promise<EncryptedFileData> {
  // Use user's salt for key derivation (ensures consistent key across sessions)
  const salt = base64ToUint8Array(userSalt);
  const encryptionKey = await deriveEncryptionKey(password, salt);

  // Generate random IV for this file
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  // Encrypt data
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    fileData
  );

  return {
    encryptedData,
    metadata: {
      iv: uint8ArrayToBase64(iv),
      salt: userSalt,
      algorithm: 'AES-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
    },
  };
}

/**
 * Decrypt file data after download
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  password: string,
  metadata: EncryptedFileData['metadata']
): Promise<ArrayBuffer> {
  // Validate algorithm
  if (metadata.algorithm !== 'AES-GCM') {
    throw new Error(`Unsupported encryption algorithm: ${metadata.algorithm}`);
  }

  // Derive encryption key
  const salt = base64ToUint8Array(metadata.salt);
  const encryptionKey = await deriveEncryptionKey(password, salt);

  // Decrypt data
  const iv = base64ToUint8Array(metadata.iv);

  try {
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      encryptedData
    );

    return decryptedData;
  } catch (error) {
    throw new Error('Decryption failed. Incorrect password or corrupted data.');
  }
}

/**
 * Encrypt filename for storage
 */
export async function encryptFilename(
  filename: string,
  password: string,
  userSalt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(filename);

  const encrypted = await encryptFile(data.buffer, password, userSalt);

  // Return base64-encoded encrypted filename
  return uint8ArrayToBase64(new Uint8Array(encrypted.encryptedData)) +
         '.' + encrypted.metadata.iv.substring(0, 8); // Add partial IV for uniqueness
}

/**
 * Decrypt filename from storage
 */
export async function decryptFilename(
  encryptedFilename: string,
  password: string,
  metadata: EncryptedFileData['metadata']
): Promise<string> {
  // Remove IV suffix
  const base64Data = encryptedFilename.split('.')[0];
  const encryptedData = base64ToUint8Array(base64Data).buffer;

  const decrypted = await decryptFile(encryptedData, password, metadata);

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Utility functions
function uint8ArrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
