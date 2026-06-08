# Security Policy

## Supported Versions

Only the latest release is supported with security updates.

| Version | Supported |
| ------- | --------- |
| latest  | yes       |
| older   | no        |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue to report a security vulnerability.

Send an email to **[security@placeholder.com]** with:

- Description of the vulnerability
- Steps to reproduce
- Estimated impact
- Suggested fix (optional)

We will respond within 48–72 hours.

## Security Features

- **Argon2id password hashing** via bcryptjs
- **HMAC-signed session cookies** with `iat` invalidation
- **Rate limiting** on login and signup attempts
- **Security headers** (CSP, HSTS, X-Frame-Options, Permissions-Policy, Referrer-Policy)
- **SQL injection protection** via Drizzle ORM parameterized queries
- **HttpOnly + Secure + SameSite=Lax cookies**
- **Timing-safe password comparison** (`crypto.timingSafeEqual`)
- **Open redirect prevention** on login `next` param

## Known Limitations

- No 2FA yet (on roadmap)
- No OAuth yet (on roadmap)
- Self-hosters must configure HTTPS at the infrastructure level (Vercel handles this automatically)
- For production deployments behind a custom reverse proxy, add additional rate limiting at the edge (Cloudflare, nginx, etc.)
