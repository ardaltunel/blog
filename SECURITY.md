# Security Policy

## Supported Versions

The latest version of this project is actively maintained and receives security updates when necessary.

| Version | Supported |
| --- | --- |
| Latest | ✅ |
| Older versions | ❌ |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly and privately. Do not create a public GitHub issue for an undisclosed vulnerability.

Contact the project maintainer through the private contact methods listed on the [Arda Altunel GitHub profile](https://github.com/ardaltunel).

Please include:

- A clear description of the vulnerability
- The affected page, component, or file
- Steps required to reproduce the issue
- The potential security impact
- Proof-of-concept material, if appropriate
- Suggested fixes or mitigations, if available

Reports will be reviewed as soon as reasonably possible. Additional information may be requested to confirm the issue and determine an appropriate resolution.

---

## Scope

This policy covers security issues caused by this repository, including:

- The public blog pages and client-side application code
- Authentication and authorization flows
- Supabase schema, Row Level Security, functions, and Storage policies maintained in this repository
- Dependency and GitHub Actions configuration

Vulnerabilities in GitHub Pages, Supabase, browsers, or other third-party services should be reported directly to the relevant provider unless the issue is caused by this project's integration or configuration.

---

## Responsible Disclosure

Please do not publicly disclose a vulnerability before it has been reviewed and resolved. Allow reasonable time for investigation, remediation, testing, and release.

Do not access, modify, delete, or retain data that does not belong to you. Avoid privacy violations, service disruption, denial-of-service testing, social engineering, and automated testing that could degrade the service.

Responsible disclosure helps protect users, contributors, and the wider community.

---

## Security Notes

- Never expose secret keys, service-role credentials, tokens, or environment variables.
- Do not commit passwords or other sensitive credentials to the repository.
- Treat the Supabase anonymous key as public and rely on Row Level Security and Storage policies for authorization.
- Use secure authentication methods and the minimum permissions required.
- Keep dependencies and pinned GitHub Actions revisions up to date.
- Sanitize untrusted content and validate all routes, URLs, uploads, and user-controlled input.

---

## Disclaimer

Reasonable efforts are made to improve the security of this project. However, the project is provided "as is," without guarantees or warranties of any kind.
