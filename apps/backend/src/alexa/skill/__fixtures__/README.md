# Test-only certificate fixtures

A throwaway CA chain for `alexa-request-verifier.spec.ts` — **never trusted by the running app**.
The verifier only trusts Node's bundled CA store unless a test injects `root.pem` explicitly.

- `root.pem` → `intermediate.pem` → `leaf.pem` (SAN `echo-api.amazon.com`), signed with
  `test-only-leaf.key`, the stand-in for Amazon's request-signing key.
- `wrong-san.pem` (+ `test-only-wrong-san.key`): same chain, but issued for another host name.
- `other-root.pem`: an unrelated root, for the "chain does not end at a trusted root" case.

The CA private keys were discarded after generation; all certificates are valid until 2126.
Regenerate with `openssl` (see the extensions used in the spec's comments) if they ever need to change.
