import {
  encryptCredentials,
  decryptCredentials,
  __resetCache,
} from './credential-cipher';

const VALID_KEY_HEX =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

describe('credential-cipher', () => {
  const originalEnv = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = VALID_KEY_HEX;
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
    } else {
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = originalEnv;
    }
  });

  // -------------------------------------------------------------------------
  // Roundtrip
  // -------------------------------------------------------------------------
  it('roundtrip: encrypt then decrypt returns the original plaintext', () => {
    const plaintext = 'sk_live_abcdef123456XYZ789';
    const payload = encryptCredentials(plaintext);
    const decrypted = decryptCredentials(payload);
    expect(decrypted).toBe(plaintext);
  });

  it('empty plaintext roundtrip: encrypt(""), decrypt → ""', () => {
    const payload = encryptCredentials('');
    const decrypted = decryptCredentials(payload);
    expect(decrypted).toBe('');
  });

  // -------------------------------------------------------------------------
  // Deterministic IV uniqueness
  // -------------------------------------------------------------------------
  it('deterministic IV uniqueness: same plaintext produces different ciphertext', () => {
    const plaintext = 'sk_test_duplicate';
    const p1 = encryptCredentials(plaintext);
    const p2 = encryptCredentials(plaintext);

    expect(p1.iv).not.toBe(p2.iv);
    expect(p1.ciphertext).not.toBe(p2.ciphertext);
    // Both must still decrypt to the same value
    expect(decryptCredentials(p1)).toBe(plaintext);
    expect(decryptCredentials(p2)).toBe(plaintext);
  });

  // -------------------------------------------------------------------------
  // Tamper rejection — ciphertext
  // -------------------------------------------------------------------------
  it('tamper rejection: flip a byte in ciphertext throws', () => {
    const payload = encryptCredentials('sensitive payload');

    const tamperedCiphertext = Buffer.from(payload.ciphertext, 'base64');
    tamperedCiphertext[0] ^= 0xff;
    const tamperedPayload = {
      ...payload,
      ciphertext: tamperedCiphertext.toString('base64'),
    };

    expect(() => decryptCredentials(tamperedPayload)).toThrow();
  });

  // -------------------------------------------------------------------------
  // Tamper rejection — IV
  // -------------------------------------------------------------------------
  it('tampered IV rejection: change the IV by 1 byte throws', () => {
    const payload = encryptCredentials('sensitive payload');

    const tamperedIv = Buffer.from(payload.iv, 'hex');
    tamperedIv[0] ^= 0x01;
    const tamperedPayload = {
      ...payload,
      iv: tamperedIv.toString('hex'),
    };

    expect(() => decryptCredentials(tamperedPayload)).toThrow();
  });

  // -------------------------------------------------------------------------
  // Tamper rejection — authTag
  // -------------------------------------------------------------------------
  it('tampered authTag rejection: flip a byte in authTag throws', () => {
    const payload = encryptCredentials('sensitive payload');

    const tamperedTag = Buffer.from(payload.authTag, 'hex');
    tamperedTag[0] ^= 0xff;
    const tamperedPayload = {
      ...payload,
      authTag: tamperedTag.toString('hex'),
    };

    expect(() => decryptCredentials(tamperedPayload)).toThrow();
  });

  // -------------------------------------------------------------------------
  // Wrong-key failure
  // -------------------------------------------------------------------------
  it('wrong-key failure: encrypt with key A, decrypt with key B throws', () => {
    const wrongKey =
      'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

    // Encrypt with wrong key inside isolateModules (fresh cache + wrong env)
    const payload = jest.isolateModules(() => {
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = wrongKey;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { encryptCredentials: enc } = require('./credential-cipher');
      return enc('sk_live_cross_key');
    }) as unknown as ReturnType<typeof encryptCredentials>;

    // decryptCredentials uses the main module (VALID_KEY_HEX) — different key
    // → GCM authentication fails because ciphertext was sealed with wrongKey
    expect(() => decryptCredentials(payload)).toThrow();
  });

  // -------------------------------------------------------------------------
  // Missing-key failure
  // -------------------------------------------------------------------------
  it('missing-key failure: unset env var, encryptCredentials throws', () => {
    delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
    __resetCache();
    try {
      expect(() => encryptCredentials('plaintext')).toThrow(
        'PAYMENT_GATEWAY_ENCRYPTION_KEY environment variable is required',
      );
    } finally {
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = VALID_KEY_HEX;
    }
  });

  it('missing-key failure: unset env var, decryptCredentials throws', () => {
    delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
    __resetCache();
    try {
      const dummyPayload = {
        ciphertext: 'dummy',
        iv: '00'.repeat(12),
        authTag: '00'.repeat(16),
      };
      expect(() => decryptCredentials(dummyPayload)).toThrow(
        'PAYMENT_GATEWAY_ENCRYPTION_KEY environment variable is required',
      );
    } finally {
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = VALID_KEY_HEX;
    }
  });

  // -------------------------------------------------------------------------
  // Wrong-format key
  // -------------------------------------------------------------------------
  it('wrong-format key: 32-char hex throws on encryptCredentials', () => {
    __resetCache();
    process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = 'a'.repeat(32);
    try {
      expect(() => encryptCredentials('plaintext')).toThrow(
        'PAYMENT_GATEWAY_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
      );
    } finally {
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = VALID_KEY_HEX;
    }
  });

  it('wrong-format key: 64-char non-hex throws on decryptCredentials', () => {
    __resetCache();
    process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = 'z'.repeat(64);
    try {
      const dummyPayload = {
        ciphertext: 'dummy',
        iv: '00'.repeat(12),
        authTag: '00'.repeat(16),
      };
      expect(() => decryptCredentials(dummyPayload)).toThrow(
        'PAYMENT_GATEWAY_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
      );
    } finally {
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY = VALID_KEY_HEX;
    }
  });
});