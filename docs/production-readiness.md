# Production readiness

This checklist captures the minimum launch checks for the Coolock Ardlea Scouts website.

## Automated gates

The Quality workflow must pass before merge. It now verifies:

- production npm dependencies have no known high/critical vulnerabilities reported by `npm audit`
- required Firebase and email-service environment variables are present
- `VITE_EMAIL_API_URL` is a valid HTTPS URL
- lint, unit tests and the production build pass
- Firebase Hosting configuration retains baseline browser security headers and safe cache behaviour

## Hosting hardening

Firebase Hosting applies these headers to all responses:

- `Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

The SPA shell (`/index.html`) is not cached so releases become visible immediately. Vite hashed assets under `/assets/**` are cached for one year with `immutable`.

The CSP is intentionally limited to directives that do not constrain Firebase network/auth endpoints. A stricter script/connect CSP should only be introduced after validating all authentication, Firestore and email flows in a production-like environment.

## Pre-release verification

Before treating a release as production-ready:

1. Confirm Quality, Firestore Rules, Firebase Hosting preview and Playwright workflows are green.
2. Exercise leader, admin and parent authentication on the Firebase preview.
3. Verify an ordinary leader cannot read or act on another section's members.
4. Verify parent access exposes only linked member records.
5. Verify event consent links, parent communications and email delivery use the intended production email Worker.
6. Confirm the email Worker has the current `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `FIREBASE_PROJECT_ID` and `ALLOWED_ORIGINS` configuration.
7. Confirm Firestore backups are running and a recent backup exists before launch.
8. After production deploy, inspect response headers and perform one smoke test for public pages, leader login, parent login and email delivery.

## Sensitive-data boundary

Do not put medical information, consent answers, emergency-contact details or message bodies into analytics, general audit descriptions, URLs or client-side error reporting. Operational exports and communication recipient lists should remain constrained by Firestore section permissions.
