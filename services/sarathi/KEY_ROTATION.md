# Sarathi Key Rotation Strategy

## Current: Static Key Pair

Keys are generated on first startup and persisted to `sarathi/keys/`:
- `private.pem` — RS256 private key (mode 0600)
- `public.pem` — RS256 public key
- `key_meta.json` — Key metadata (creation date, key_id, rotation count)

## Rotation Strategy

### Manual Rotation
```bash
# Rotate keys (only available via direct API call or CLI)
node -e "
const kp = require('./services/sarathi/key_persistence');
const result = kp.rotateKeys();
console.log('Rotated to key_id:', result.meta.key_id);
console.log('Rotation count:', result.meta.rotation_count);
"
```

### Key History
Previous keys are preserved as:
- `private.0.pem`, `private.1.pem`, ...
- `public.0.pem`, `public.1.pem`, ...

This allows tokens signed with previous keys to still be verified during overlap windows.

### Verification Continuity
After rotation, the Bridge must re-fetch the public key:
```bash
curl -s http://localhost:3001/public-key
```

The Bridge's `fetchPublicKey()` will pick up the new key on the next call.

## Restart-Safe Validation

On restart, Sarathi loads persisted keys from `sarathi/keys/`:
```
if (fs.existsSync(private.pem) && fs.existsSync(public.pem))
  → load from files
else
  → generate new key pair
  → persist to files
```

The public key endpoint (`GET /public-key`) always serves the current key.

## Replay Verification Continuity

All issued tokens are recorded in the replay log (`replay_persistence/data/replay_log.jsonl`). After key rotation:
- Previously issued tokens remain valid until expiry
- Verification uses the current public key
- Token replay detection (jti cache) survives restart via key persistence

## Constraints

- Rotation does NOT invalidate previously issued tokens (they expire naturally)
- Previous keys are archived, not deleted
- No automatic rotation schedule enforced (manual operation only)
- Bridge must be running to fetch updated public key (or be restarted)
