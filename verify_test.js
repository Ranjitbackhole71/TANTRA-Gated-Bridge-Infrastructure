const crypto = require('crypto');
const token = 'eyJhbGciOiJFZERTQSIsImtpZCI6IjYzZTZjYTEzLTAxMjgtNGI1MC04NDQ2LTgwZmRhZmUwY2I2MSIsInR5cCI6IkpXVCJ9.eyJ0cmFjZV9pZCI6InZmeS0wMDkiLCJleGVjdXRpb25faWQiOiJ2ZnktMDEwIiwiaXNzIjoidGFudHJhLXNhcmF0aGkiLCJhdWQiOiJ0YW50cmEtYnJpZGdlIiwianRpIjoiZDk2YzBiMzUtN2QzYS00NWJhLTlkOTItOWU3MmJhNjM0OWE4IiwiaWF0IjoxNzgxOTQ5MzM4LCJleHAiOjE3ODE5NTI5MzgsImNldF9oYXNoIjoidmZ5LWhhc2gifQ.7afCuSHmjo9jHBLmUFLi0azc559vIUXNtlDZmDTy-SVuYqxibNzAoAsCj6LJhfBqwK6v8XVjwD5yej3ayKGmAA';
const jwks = {
    "keys":  [
                 {
                     "crv":  "Ed25519",
                     "x":  "O3qlbEp7JQjqgctrjxf3I9o8tQyOWkURCLVGx6Jjgzk",
                     "kty":  "OKP",
                     "alg":  "EdDSA",
                     "kid":  "63e6ca13-0128-4b50-8446-80fdafe0cb61",
                     "use":  "sig"
                 },
                 {
                     "kty":  "RSA",
                     "n":  "zZ67lSYD_OO23mbBED4TjAzTEc90dfQtSDRkVlBWUEy2039NWH9Z-sxNZvK6nJ01i92ZykfKsFPcxbKpQFDSItbx3KUupD0bC9Taju9ixxzfVaYTeeF3cG_g-xhHvBIpHapHEaAj2BQu8oogvr9Pca5fNQ7VjJlPMFP4iikYaN-Q6IAykadjPkrhpTjTqyP0sEsf2ilQjhdt15Ht8hKE7ST1HDGKAnBBUgiOjXBI0Y43AsTJrQhGpTRGXlKiUTOfcsAmvDUg8Mhp78aSg3B61NrHgO69399swN7ir5-HWkupSEzIrte7NvRijN_I-nfSfwrGIHFxmC2cSFDJPo4KzQ",
                     "e":  "AQAB",
                     "alg":  "RS256",
                     "kid":  "0b1f8425-aee8-4822-bdf3-a852b2733a09",
                     "use":  "sig"
                 }
             ]
};

// Find Ed25519 key
const edKey = jwks.keys.find(k => k.kty === 'OKP');
console.log('Ed25519 key found:', !!edKey);

const parts = token.split('.');
const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
const signature = Buffer.from(parts[2], 'base64url');

console.log('Header:', JSON.stringify(header));
console.log('Payload:', JSON.stringify({...payload, jti: '***'}));
console.log('Signature length:', signature.length);

try {
  const keyObject = crypto.createPublicKey({ format: 'jwk', key: edKey });
  console.log('Key object created:', !!keyObject);
  console.log('Key type:', keyObject.asymmetricKeyType);
  
  const data = Buffer.from(parts[0] + '.' + parts[1]);
  const isValid = crypto.verify(null, data, keyObject, signature);
  console.log('verify(null) result:', isValid);
  
  // Also try with 'EdDSA' explicitly
  const isValid2 = crypto.verify('EdDSA', data, keyObject, signature);
  console.log('verify(EdDSA) result:', isValid2);
} catch(e) {
  console.log('ERROR:', e.message);
  console.log('Stack:', e.stack);
}
