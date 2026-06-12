const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_DIR = process.env.SARATHI_KEY_DIR || path.join(__dirname, 'keys');

// RSA keys (legacy)
const PRIVATE_KEY_FILE = path.join(KEY_DIR, 'private.pem');
const PUBLIC_KEY_FILE = path.join(KEY_DIR, 'public.pem');

// Ed25519 keys (EdDSA)
const ED25519_PRIVATE_KEY_FILE = path.join(KEY_DIR, 'ed25519_private.pem');
const ED25519_PUBLIC_KEY_FILE = path.join(KEY_DIR, 'ed25519_public.pem');

const KEY_META_FILE = path.join(KEY_DIR, 'key_meta.json');

function ensureKeyDir() {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }
}

function loadOrGenerateKeys() {
  ensureKeyDir();
  const result = { rsa: null, ed25519: null, generated: false };

  // Load or generate RSA keys
  if (fs.existsSync(PRIVATE_KEY_FILE) && fs.existsSync(PUBLIC_KEY_FILE)) {
    result.rsa = {
      privateKey: fs.readFileSync(PRIVATE_KEY_FILE, 'utf-8'),
      publicKey: fs.readFileSync(PUBLIC_KEY_FILE, 'utf-8')
    };
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    fs.writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_FILE, publicKey);
    result.rsa = { privateKey, publicKey };
    result.generated = true;
  }

  // Load or generate Ed25519 keys
  if (fs.existsSync(ED25519_PRIVATE_KEY_FILE) && fs.existsSync(ED25519_PUBLIC_KEY_FILE)) {
    result.ed25519 = {
      privateKey: fs.readFileSync(ED25519_PRIVATE_KEY_FILE, 'utf-8'),
      publicKey: fs.readFileSync(ED25519_PUBLIC_KEY_FILE, 'utf-8')
    };
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    fs.writeFileSync(ED25519_PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
    fs.writeFileSync(ED25519_PUBLIC_KEY_FILE, publicKey);
    result.ed25519 = { privateKey, publicKey };
    result.generated = true;
  }

  result.meta = loadOrCreateKeyMeta();
  return result;
}

function loadOrCreateKeyMeta() {
  try {
    if (fs.existsSync(KEY_META_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(KEY_META_FILE, 'utf-8'));
      // Migrate from old single-algorithm format to dual-algorithm format
      if (!parsed.algorithms) {
        const oldKid = parsed.key_id || crypto.randomUUID();
        parsed.algorithms = {
          rs256: {
            algorithm: 'RS256',
            key_size: parsed.key_size || 2048,
            key_id: oldKid,
            curve: null,
            previous_key_id: parsed.previous_key_id || null
          },
          eddsa: {
            algorithm: 'EdDSA',
            key_size: 256,
            key_id: crypto.randomUUID(),
            curve: 'Ed25519',
            previous_key_id: null
          }
        };
        delete parsed.algorithm;
        delete parsed.key_size;
        delete parsed.key_id;
        delete parsed.previous_key_id;
        saveKeyMeta(parsed);
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse key meta file:', e.message);
  }

  const meta = {
    created_at: new Date().toISOString(),
    algorithms: {
      rs256: {
        algorithm: 'RS256',
        key_size: 2048,
        key_id: crypto.randomUUID(),
        curve: null
      },
      eddsa: {
        algorithm: 'EdDSA',
        key_size: 256,
        key_id: crypto.randomUUID(),
        curve: 'Ed25519'
      }
    },
    rotation_count: 0
  };
  saveKeyMeta(meta);
  return meta;
}

function loadKeyMeta() {
  try {
    if (fs.existsSync(KEY_META_FILE)) {
      return JSON.parse(fs.readFileSync(KEY_META_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to parse key meta file:', e.message);
  }
  return null;
}

function saveKeyMeta(meta) {
  fs.writeFileSync(KEY_META_FILE, JSON.stringify(meta, null, 2));
}

function rotateKeys() {
  ensureKeyDir();

  const oldMeta = loadKeyMeta() || { rotation_count: 0 };

  // Rotate RSA keys
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    const rotatedFile = path.join(KEY_DIR, `private.${oldMeta.rotation_count}.pem`);
    fs.renameSync(PRIVATE_KEY_FILE, rotatedFile);
  }
  if (fs.existsSync(PUBLIC_KEY_FILE)) {
    const rotatedFile = path.join(KEY_DIR, `public.${oldMeta.rotation_count}.pem`);
    fs.renameSync(PUBLIC_KEY_FILE, rotatedFile);
  }
  const { publicKey: rsaPublicKey, privateKey: rsaPrivateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(PRIVATE_KEY_FILE, rsaPrivateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_FILE, rsaPublicKey);

  // Rotate Ed25519 keys
  if (fs.existsSync(ED25519_PRIVATE_KEY_FILE)) {
    const rotatedFile = path.join(KEY_DIR, `ed25519_private.${oldMeta.rotation_count}.pem`);
    fs.renameSync(ED25519_PRIVATE_KEY_FILE, rotatedFile);
  }
  if (fs.existsSync(ED25519_PUBLIC_KEY_FILE)) {
    const rotatedFile = path.join(KEY_DIR, `ed25519_public.${oldMeta.rotation_count}.pem`);
    fs.renameSync(ED25519_PUBLIC_KEY_FILE, rotatedFile);
  }
  const { publicKey: ed25519PublicKey, privateKey: ed25519PrivateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(ED25519_PRIVATE_KEY_FILE, ed25519PrivateKey, { mode: 0o600 });
  fs.writeFileSync(ED25519_PUBLIC_KEY_FILE, ed25519PublicKey);

  const meta = {
    created_at: new Date().toISOString(),
    algorithms: {
      rs256: {
        algorithm: 'RS256',
        key_size: 2048,
        key_id: crypto.randomUUID(),
        curve: null,
        previous_key_id: oldMeta.algorithms?.rs256?.key_id || null
      },
      eddsa: {
        algorithm: 'EdDSA',
        key_size: 256,
        key_id: crypto.randomUUID(),
        curve: 'Ed25519',
        previous_key_id: oldMeta.algorithms?.eddsa?.key_id || null
      }
    },
    rotation_count: oldMeta.rotation_count + 1
  };
  saveKeyMeta(meta);

  return {
    rsa: { privateKey: rsaPrivateKey, publicKey: rsaPublicKey },
    ed25519: { privateKey: ed25519PrivateKey, publicKey: ed25519PublicKey },
    meta
  };
}

function getKeyInfo() {
  const meta = loadKeyMeta();
  const files = [];
  if (fs.existsSync(KEY_DIR)) {
    for (const f of fs.readdirSync(KEY_DIR)) {
      files.push(f);
    }
  }
  return { meta, key_files: files, key_dir: KEY_DIR };
}

module.exports = {
  loadOrGenerateKeys,
  rotateKeys,
  getKeyInfo,
  KEY_DIR,
  PRIVATE_KEY_FILE,
  PUBLIC_KEY_FILE,
  ED25519_PRIVATE_KEY_FILE,
  ED25519_PUBLIC_KEY_FILE
};
