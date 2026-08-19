---
name: standard-security
description: Application security standards covering OWASP Top 10 2025, authentication, authorization, cryptography, input validation, secrets management, security headers, mobile security, supply chain, and logging. Use when writing or reviewing any code that handles user input, authentication, authorization, sensitive data, external requests, or deployment configuration.
user-invocable: false
---

> Sources: OWASP Top 10 2025, NIST SP 800-63-4 (August 2025), Mozilla Security Guidelines (infosec.mozilla.org), OWASP Cheat Sheet Series, OWASP MASVS, MDN Web Docs Security, CWE/SANS Top 25.

---

## Frontend focus (client variant)

The full standard below applies. For **client-side code**, weight these first — the browser is a hostile, fully-inspectable environment (assume users can read every byte the client receives and forge every request the client sends):

- **XSS** — never `dangerouslySetInnerHTML` with untrusted data; sanitize any HTML; React escapes by default — don't defeat it. Validate/encode data rendered into the DOM.
- **CSP & security headers** — configure Content-Security-Policy, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` at the server/edge (TanStack Start server handler or the hosting platform's header config — there is no Next.js middleware here); no inline scripts that force `unsafe-inline`.
- **Token / session storage** — prefer httpOnly cookies for auth tokens over `localStorage` (XSS-exfiltratable); scope and expire appropriately.
- **No secrets in the client bundle** — anything shipped to the browser is public. With Vite, only vars prefixed `VITE_` are exposed to client code via `import.meta.env`, and they must never hold secrets. Read them via `import.meta.env.VITE_*`, never `process.env` on the client.
- **DOM sanitization** — sanitize before inserting into the DOM; validate URLs (`javascript:` scheme), `target="_blank"` → `rel="noopener noreferrer"`.
- **Client input validation is UX only** — it improves feedback but is NOT a security control; the server re-validates everything.
- **Supply chain** — audit dependencies; SRI for third-party scripts; be wary of what runs on the page.

(Server-side items — injection, authZ enforcement, secrets management, rate limiting — are covered in the server variant.)

---

## Security Mindset

> "Security is not a feature to add later. It is a design constraint that must be present from the first line of code."

- **Principle of Least Privilege** — every component, user, and service gets the minimum permissions needed. Nothing more.
- **Defense in Depth** — never rely on a single layer of security. Assume any single control will fail.
- **Fail Securely** — when a security check fails, deny by default. Never fail open.
- **Zero Trust** — never trust implicit network location. Authenticate and authorize every request, including internal service-to-service calls.
- **Shift Left** — security problems found in design cost 1×. In development: 6×. In production: 100×.

---

## OWASP Top 10 — 2025

Current authoritative ranking of the most critical web application security risks (based on 175,000+ CVE records).

### A01 — Broken Access Control _(#1 since 2021)_

The most common vulnerability. Occurs when users can act outside their intended permissions.

**Prevent:**

- Enforce access control server-side on every request — never trust client-side checks alone
- Deny by default — explicitly grant access, never implicitly allow
- Implement RBAC (Role-Based) or ABAC (Attribute-Based) access control consistently
- Rate limit API access to prevent automated enumeration
- Include SSRF (Server-Side Request Forgery) prevention: validate and whitelist all URLs fetched server-side; block requests to internal/cloud metadata addresses (`169.254.169.254`, `localhost`, RFC1918 ranges)
- Log access control failures and alert on repeated failures

```
# Block these in server-side URL validation
169.254.169.254/latest/meta-data/    # AWS metadata
169.254.170.2                         # ECS credentials
metadata.google.internal             # GCP metadata
localhost, 127.0.0.1, ::1            # Loopback
10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16  # RFC1918
```

### A02 — Security Misconfiguration _(surged from #5 to #2)_

3% of tested applications had misconfiguration issues. Affects cloud, containers, frameworks, and servers.

**Prevent:**

- Remove all default credentials, sample applications, and unused features
- Disable directory listing on web servers
- Disable debug mode in production — never expose stack traces or error details to clients
- Apply security headers on all responses (see Security Headers section)
- Use `Content-Security-Policy`, `X-Content-Type-Options`, `HSTS` at minimum
- Automate configuration management — manually configured environments drift

### A03 — Software Supply Chain Failures _(new 2025, expanded from A06:2021)_

Compromised dependencies, malicious packages, and tampered build pipelines are now a top-3 risk.

**Prevent:**

- Generate and maintain an **SBOM** (Software Bill of Materials) for every release
- Pin dependency versions exactly — never use wildcard version ranges in production
- Verify package integrity: use lockfiles (`package-lock.json`, `poetry.lock`, `go.sum`)
- Run automated dependency scanning (OWASP Dependency Check, Snyk, GitHub Dependabot)
- Audit packages before installation — `npm audit`, `pip-audit`, `govulncheck`
- Review packages with unusual new releases or ownership changes
- Sign builds and verify signatures in CI/CD pipelines
- Never run CI/CD with broad write permissions to production

### A04 — Cryptographic Failures _(dropped from #2 but still critical)_

Insufficient protection of data in transit and at rest.

**Prevent:**

- TLS 1.2 minimum everywhere; TLS 1.3 preferred
- Disable SSLv2, SSLv3, TLS 1.0, TLS 1.1 — they have known vulnerabilities
- Use `HSTS` to prevent protocol downgrade attacks
- Passwords: hash with **Argon2id** (preferred), bcrypt, or PBKDF2. Never MD5, SHA-1, or unsalted hashes
- Sensitive data at rest: AES-256-GCM (authenticated encryption)
- Generate all keys and random values using a cryptographically secure RNG — never `Math.random()`
- Certificates: SHA-256 minimum; RSA 2048-bit minimum key size
- Implement perfect forward secrecy: ECDHE key exchange

### A05 — Injection _(fell from #3 but remains critical)_

SQL, command, LDAP, XPath, and other injection attacks.

**Prevent:**

- **Parameterized queries always** — never concatenate user input into any query language
- Use ORM query builder methods, not raw string interpolation
- Validate, filter, and escape all user input at the boundary
- Run database processes with minimum required permissions
- Use prepared statements even for queries that "look safe"

```sql
-- ❌ Never
query = "SELECT * FROM users WHERE email = '" + userInput + "'"

-- ✅ Always
query = "SELECT * FROM users WHERE email = $1", [userInput]
```

### A06 — Insecure Design

Security flaws baked into the architecture, not just the implementation.

**Prevent:**

- Threat model before writing code — identify assets, trust boundaries, and attack paths
- Enforce rate limiting and abuse prevention at design time
- Design for failure: what happens when auth fails? When a service is unavailable?
- Never rely on security through obscurity
- Use established security patterns — do not invent custom crypto or auth flows

### A07 — Identification and Authentication Failures

Broken or weak authentication allowing attackers to impersonate users.

See dedicated **Authentication** section below.

### A08 — Software and Data Integrity Failures

Deserializing untrusted data, auto-updating without verification, insecure CI/CD.

**Prevent:**

- Never deserialize objects from untrusted sources without validation
- Verify digital signatures on software updates before applying
- Protect CI/CD pipelines — treat build scripts as security-critical code
- Use signed commits for code that reaches production

### A09 — Security Logging and Monitoring Failures

82% of applications lack adequate logging. Average breach detection time: 287 days.

See dedicated **Logging & Monitoring** section below.

### A10 — Mishandling of Exceptional Conditions _(new 2025)_

Applications that fail unpredictably under abnormal input, timeouts, or overload can expose vulnerabilities.

**Prevent:**

- All error handlers must return safe, minimal information — never expose stack traces, file paths, or DB schema to clients
- Handle all edge cases: null values, empty arrays, oversized payloads, malformed encoding
- Timeouts on all external calls — unhandled timeouts can cascade into resource exhaustion
- Fail closed: if an exceptional condition cannot be handled safely, deny the request

---

## Authentication (NIST SP 800-63-4, August 2025)

### Password Requirements (NIST 800-63B-4)

- Minimum length: **15 characters** for single-factor passwords (NIST 2025 update)
- Maximum length: at least 64 characters — do not truncate
- Accept all printable ASCII + Unicode — do not restrict character sets
- **No mandatory complexity rules** (uppercase, symbols) — length is more effective
- **No periodic forced resets** — reset only on confirmed compromise or user request
- Block passwords found in breach databases (HaveIBeenPwned API or equivalent)
- Hash with Argon2id, bcrypt (cost ≥ 12), or PBKDF2 (≥ 310,000 iterations for SHA-256)

### Multi-Factor Authentication (MFA)

- Require MFA for: admin accounts, privileged operations, financial actions, account recovery
- Preferred authenticators (strongest to weakest): hardware security keys (FIDO2/WebAuthn) → TOTP app → push notification → SMS/email OTP
- SMS OTP is the weakest — acceptable but vulnerable to SIM swap. Never use as sole factor for high-risk operations
- Knowledge-based authentication (security questions) is **not acceptable** per NIST 800-63-4 — do not implement

### Session Management

- Session IDs: cryptographically random, minimum 128-bit entropy
- Regenerate session ID on privilege escalation (login, role change)
- Set session timeouts: idle timeout (15–30 min for sensitive apps) + absolute timeout (8–24 hours)
- Secure cookie attributes: `HttpOnly`, `Secure`, `SameSite=Strict` (or `Lax` minimum)
- Invalidate server-side session on logout — do not rely on client deleting the cookie

### JWT (JSON Web Tokens)

- Use asymmetric signing (RS256, ES256) for tokens consumed across services — not symmetric (HS256) which requires sharing the secret
- Set short expiry for access tokens: 15 minutes recommended
- Never store sensitive data (passwords, PAN, SSN) in JWT payload — it is base64-encoded, not encrypted
- Validate: signature, expiry (`exp`), issuer (`iss`), audience (`aud`) on every request
- Refresh tokens: store in httpOnly cookie, not localStorage. Bind to device/session if possible
- Implement token revocation for logout and compromise events

### OAuth 2.1 / OIDC

- Use **Authorization Code with PKCE** — not implicit flow (deprecated)
- For mobile apps: use system browser (ASWebAuthenticationSession / Chrome Custom Tabs), never embedded WebView
- Validate `state` parameter to prevent CSRF on redirect
- Validate `redirect_uri` against an exact whitelist — never allow open redirects

---

## Authorization

- Enforce authorization **server-side** on every request — never in client-side code alone
- Check ownership: verify the authenticated user owns the requested resource, not just that they are authenticated
- Never expose internal IDs (database PKs) directly — use opaque public IDs or UUIDs
- Apply Principle of Least Privilege to service accounts and API keys
- Implement RBAC or ABAC consistently — do not scatter permission checks across code

```
# Ownership check pattern
if resource.owner_id != current_user.id:
    raise Forbidden
```

---

## Input Validation & Output Encoding

### Validation rules

- Validate all inputs at the boundary (API endpoint, form handler, message consumer)
- Validate: type, format, length, range, allowed values — reject anything that doesn't fit
- Never trust: HTTP headers, query parameters, path parameters, cookies, request body, file uploads
- Validate file uploads: type (MIME + magic bytes), size limit, filename (strip path traversal: `../`)

### Output encoding

- HTML context: HTML-encode all user-generated content — never render raw input
- SQL context: parameterized queries
- JavaScript context: JSON-encode or use safe DOM APIs (`textContent`, not `innerHTML`)
- URL context: percent-encode user input in URLs
- Never use `dangerouslySetInnerHTML` (React) or `innerHTML` without sanitization (use DOMPurify)

### Content Security Policy (CSP)

CSP is the most effective defense against XSS. Implement on all new applications.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'nonce-{random}';
  img-src 'self' data: https:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

- Use `nonce-{random}` instead of `unsafe-inline` for inline scripts/styles
- Generate a new nonce per request — never reuse
- Start with `Content-Security-Policy-Report-Only` to monitor violations before enforcing

---

## Security Headers

Apply to all HTTP responses. Use `helmet` (Node.js), `django-csp`, or equivalent.

```
# Required on all responses
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: (see CSP section)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY                    # Or use CSP frame-ancestors
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()

# For responses with sensitive data
Cache-Control: no-store
```

**HSTS notes:**

- Only send over HTTPS — browsers ignore HSTS header sent over HTTP
- Do not enable `preload` until you are certain all subdomains support HTTPS
- Never set long `max-age` in development environments

---

## Secrets Management

- **Never hardcode secrets** in source code — not API keys, database credentials, tokens, or private keys
- **Never commit secrets** to version control — even in private repositories
- Store secrets in: environment variables (minimum), a secrets manager (recommended: AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, Azure Key Vault)
- Rotate secrets regularly and immediately on any suspected compromise
- Use separate secrets per environment (development, staging, production) — never share production credentials
- Scan for secrets in CI/CD: `git-secrets`, `truffleHog`, GitHub Secret Scanning
- Set secret expiry — short-lived credentials are vastly safer than long-lived ones
- Log access to secrets — who accessed what and when

---

## Transport Security

- **TLS everywhere** — all HTTP traffic, all API calls, all inter-service communication
- Redirect HTTP → HTTPS with `301` + `HSTS` header
- API-only endpoints: disable HTTP entirely, only accept HTTPS
- Minimum TLS 1.2; TLS 1.3 preferred — disable TLS 1.0, TLS 1.1
- Use ECDHE for key exchange (perfect forward secrecy)
- Certificate: SHA-256 signature, RSA 2048-bit+ or ECDSA 256-bit+
- Automate certificate renewal (Let's Encrypt + certbot, or platform-managed)
- Do not disable certificate validation in any environment — even development

---

## Cryptography Rules

- Never implement custom cryptography — use established libraries and algorithms
- **Symmetric encryption**: AES-256-GCM (authenticated encryption — preferred) or AES-256-CBC + HMAC
- **Asymmetric**: RSA-2048+ or ECDSA P-256+
- **Hashing (general purpose)**: SHA-256 minimum
- **Password hashing**: Argon2id > bcrypt (cost ≥ 12) > PBKDF2 (≥ 310,000 iterations SHA-256)
- **Random values**: use CSPRNG only — `crypto.randomBytes()` (Node), `secrets` module (Python), `SecureRandom` (Java)
- Never use: MD5, SHA-1, DES, 3DES, RC4 — all have known cryptographic weaknesses
- Encrypt data at rest for: passwords (hash, not encrypt), PII, payment data, health records, session tokens

---

## Dependency & Supply Chain Security

- Pin all dependencies to exact versions in production lockfiles
- Review dependency changes in PRs — a single malicious package can compromise the entire app
- Run `npm audit` / `pip-audit` / `govulncheck` in CI — fail the build on critical vulnerabilities
- Generate SBOM with every release (`syft`, `cyclonedx`)
- Monitor for new CVEs against your installed dependencies (GitHub Dependabot, Snyk, OSV)
- Verify package publishers — typosquatting is common (`lodash` vs `1odash`)
- Prefer packages with active maintenance and known maintainers over abandoned alternatives
- Scope npm tokens and CI credentials — minimal write access to registries

---

## Logging & Monitoring

### What to log

- All authentication events: login success, login failure, logout, MFA events
- All authorization failures: access denied, permission escalation attempts
- All sensitive data access: PII reads, financial operations, admin actions
- All input validation failures
- All security header violations (CSP reports)
- Infrastructure events: config changes, secret access, deployment

### What not to log

- Passwords (any form, including hashed)
- Authentication tokens, session IDs, API keys
- Full credit card numbers, CVV, SSN (log last 4 digits only if needed)
- Encryption keys
- Any PII that is not required for security analysis

### Log format

Logs must be structured (JSON), machine-parseable, and include:

```json
{
  "timestamp": "2025-03-25T10:30:00Z",
  "level": "warn",
  "event": "auth.login_failed",
  "user_id": "u_123",
  "ip": "203.0.113.1",
  "user_agent": "...",
  "trace_id": "abc-123",
  "reason": "invalid_password"
}
```

### Alerting

- Alert on: repeated authentication failures (brute force), access to sensitive resources outside business hours, configuration changes, mass data access
- Define response playbooks before incidents happen — not during

---

## Mobile Application Security (OWASP MASVS)

### Storage

- Store sensitive data (tokens, keys, PII) in platform vaults only: iOS Keychain, Android Keystore
- Never store secrets in: SharedPreferences (unencrypted), SQLite (unencrypted), app bundle, source code
- Encrypt local databases and files containing sensitive data
- Purge sensitive data on logout

### Transport

- TLS 1.2+ everywhere — no HTTP fallback
- Enable App Transport Security (iOS) and Network Security Config (Android)
- Certificate pinning for high-risk apps: pin to intermediate CA or SPKI, not leaf certificate. Always include backup pins and a rotation plan
- Fail closed on TLS errors — never silently downgrade

### Authentication

- Authorization Code + PKCE via system browser (never embedded WebView)
- Access tokens: short-lived (15 min), stored in memory or Keychain/Keystore
- Refresh tokens: stored in Keychain/Keystore with additional binding (device/user)
- Re-authenticate for sensitive operations; biometrics as convenience layer — not sole factor

### Build & Runtime

- Disable debug builds in production (`BuildConfig.DEBUG = false`)
- Disable screenshot capture on screens showing sensitive data (`FLAG_SECURE` on Android)
- Never copy secrets to clipboard
- Strip debug symbols and obfuscate code (ProGuard/R8 for Android, Swift obfuscation for iOS)
- Verify app integrity: Play Integrity API (Android), App Attest (iOS)

### Dependency & CI/CD

- Sign builds with hardware-backed keys stored in a vault
- Scan dependencies per release — generate SBOM
- Block release on critical security findings

---

## Secure Development Lifecycle

- **Threat model** at design phase — enumerate assets, trust boundaries, attack paths
- **Static analysis (SAST)** in CI — runs on every PR
- **Dependency scanning (SCA)** in CI — fails on critical CVEs
- **Secret scanning** in CI — fails on detected credentials
- **Dynamic analysis (DAST)** in staging before production releases
- **Penetration testing** at least annually, and after major architectural changes
- **Security review** required for: auth changes, data access changes, new external integrations, privilege escalation flows

---

## DO NOT

- Store passwords in plaintext or with reversible encryption
- Use MD5, SHA-1 for password hashing or digital signatures
- Use `Math.random()` for any security-sensitive value
- Expose stack traces, DB schema, file paths, or internal IDs in error responses
- Trust client-side input validation as the only validation
- Disable TLS certificate validation in any environment
- Log passwords, tokens, full PAN, SSN, or encryption keys
- Use `innerHTML` or `dangerouslySetInnerHTML` with unsanitized user input
- Hardcode secrets, API keys, or credentials in source code
- Use embedded WebViews for OAuth flows in mobile apps
- Implement custom cryptographic algorithms
- Use knowledge-based authentication (security questions) per NIST 800-63-4
- Allow unlimited login attempts without rate limiting or lockout
- Grant write access to CI/CD pipelines beyond minimum needed
- Deserialize data from untrusted sources without schema validation
- Use wildcard (`*`) in CORS `Access-Control-Allow-Origin` for authenticated APIs
- Block or suppress security alerts without investigation

---

## Code Review Checklist

### Blocking

- [ ] User input used in query without parameterization (SQL injection)
- [ ] User input rendered without encoding (`innerHTML`, `dangerouslySetInnerHTML`)
- [ ] Secret, API key, or credential in source code
- [ ] Password stored without proper hashing (Argon2id, bcrypt, PBKDF2)
- [ ] MD5 or SHA-1 used for password hashing or signing
- [ ] `Math.random()` used for security token generation
- [ ] TLS certificate validation disabled
- [ ] Stack trace or internal path exposed in error response
- [ ] Access control check missing or client-side only
- [ ] No rate limiting on authentication endpoints
- [ ] SSRF — server fetching a URL from user input without validation
- [ ] Sensitive data logged (password, token, PAN, SSN)
- [ ] CORS allows `*` for authenticated endpoints

### Warning

- [ ] Security headers missing (HSTS, CSP, X-Content-Type-Options)
- [ ] Session ID not regenerated after login
- [ ] Session cookies missing `HttpOnly`, `Secure`, or `SameSite`
- [ ] JWT uses symmetric signing (HS256) across services
- [ ] JWT expiry not validated on server side
- [ ] Refresh token stored in localStorage instead of httpOnly cookie
- [ ] File upload missing MIME type + magic bytes validation
- [ ] Dependency with known CVE not patched
- [ ] No `Permissions-Policy` header restricting unused browser APIs
- [ ] Debug mode or verbose errors enabled in non-development environment
- [ ] OAuth flow using implicit grant (deprecated)

### Suggestion

- [ ] MFA not required for admin or privileged accounts
- [ ] Password policy allows known-breached passwords
- [ ] No SBOM generated for release
- [ ] Secrets not rotated on a defined schedule
- [ ] No alerting configured for authentication failure spikes
- [ ] CSP using `unsafe-inline` instead of nonce-based policy
- [ ] Mobile app using embedded WebView for auth
- [ ] Certificate pinning without backup pin or rotation plan
