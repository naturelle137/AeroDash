# Secrets policy

AeroDash currently runs locally in the browser without accounts, OIDC, sync or a
backend. This policy prepares future work; it creates no provider, credential or
service. The [pre-sync engineering gate](../architecture/adr/014-pre-sync-privacy-gate.md)
remains in force, and #285 remains open. This is not legal or compliance approval.

## Public frontend configuration

Treat every browser-delivered value as public, including `VITE_*` environment
variables, generated JavaScript, source maps, static files and build-time
substitutions. An ignored `.env` file does not make a bundled value secret.
Public deployment URLs and a future public OIDC client identifier may be frontend
configuration after the applicable gate is released. Never put a client secret,
private key, service credential, password or privileged API token in browser
configuration, frontend environment variables or the bundle.

Future browser OIDC must use a public-client design without a client secret.
The concrete flow, token lifecycle and security checks require a separately
reviewed design before implementation; this policy does not activate OIDC.
Profile `ownerId` strings are untrusted legacy data, not identity subjects,
credentials or authorization evidence.

## Storage and access

Keep secrets out of Git (including fixtures and history), issues, PRs, screenshots,
logs, chat, profile fields and JSON exports/backups. Use synthetic placeholders
in examples, without real accounts, credentials or personal data. Browser
IndexedDB/local/session storage and downloaded profile files are not secret
stores. Do not add secrets to these current local workflows.

For future server or CI work, the responsible maintainer must identify the
credential owner, purpose, least required permissions and approved protected
secret store before provisioning. Inject credentials only into the process that
needs them; restrict access to named maintainers/service identities and redact
values from logs and error messages. Do not copy production secrets into local
development, test fixtures, build artifacts or client responses.

## Rotation and incidents

The credential owner must record the issuer, scope, storage location, expiry,
rotation trigger and revocation/recovery procedure without recording the value.
Use short-lived credentials where supported; rotate before expiry, on ownership
or access changes, and immediately after suspected exposure. Verify the replacement
works and revoke the old credential; never leave a fallback exposed.

On suspected disclosure, stop the affected distribution, notify the responsible
maintainer through a private channel without the value, and revoke/rotate at the
issuer first. Identify affected commits, artifacts, logs, exports and recipients;
remove or restrict exposed copies and coordinate history cleanup when needed.
History removal alone does not revoke a credential. Record the timeline, scope,
containment and verification with redacted evidence. Any notification or legal
decision belongs to the accountable operator; do not infer a compliance outcome.
