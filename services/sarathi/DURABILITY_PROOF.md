# Sarathi Authority Durability Proof

## Key Persistence

| Property | Status | Evidence |
|----------|--------|----------|
| Keys persisted to disk | ✅ | `key_persistence.js` loads/generates to `sarathi/keys/` |
| Restart-safe loading | ✅ | `loadOrGenerateKeys()` checks for existing files |
| Rotation support | ✅ | `rotateKeys()` archives previous, generates new |
| Key metadata tracked | ✅ | `key_meta.json` with key_id, rotation_count, created_at |
| Previous keys archived | ✅ | `private.N.pem` and `public.N.pem` preserved |

## Token Replay Persistence

| Property | Status | Evidence |
|----------|--------|----------|
| jti cache (Sarathi) | ⚠ In-memory Map | Lost on restart, acceptable (Bridge also validates) |
| jti cache (Bridge) | ⚠ In-memory Map | Lost on restart, acceptable (tokens expire) |
| Replay log persistence | ✅ | All token issuance recorded in replay_log.jsonl |

## Proof Commands

```bash
# 1. Verify keys are persisted
ls -la services/sarathi/keys/

# 2. Verify key metadata
cat services/sarathi/keys/key_meta.json

# 3. Verify public key endpoint works
curl -s http://localhost:3001/public-key | head -c 50

# 4. Test key rotation (optional)
node -e "
const kp = require('./services/sarathi/key_persistence');
const info = kp.getKeyInfo();
console.log('Keys:', info.key_files);
console.log('Meta:', JSON.stringify(info.meta, null, 2));
"
```

## Restart-Safe Validation

On Sarathi restart:
1. `key_persistence.loadOrGenerateKeys()` detects existing keys
2. Loads private.pem and public.pem from disk
3. Continues signing with the same key pair
4. All previously issued tokens remain valid until expiry

## Historical Replay Compatibility

All key rotations are logged. Previous public keys are archived, enabling:
- Verification of tokens signed with older keys
- Audit trail of when keys were rotated
- Graceful transition during rotation windows
