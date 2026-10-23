# Security patch (cumulative): what changed and how to verify it

Based on the 18-10 build. Contains BOTH rounds of security fixes, so it can be applied
whether or not you already applied the earlier hotfix. No database change is needed
(no `db push`, no migration).

## Part 1: access, sessions, admin, QA gate
1. FMCG logins can no longer open store, edit, assess or new-store pages (guard in a layout AND in each page).
2. `/api/catalog/suggestions` is closed to FMCG logins (it listed every client's brands).
3. Removed/deactivated users lose access immediately (account re-checked on every session read); sessions last 12h, not 30 days.
4. Login throttling: 5 failed attempts per email per 15 minutes. Failures and successful logins go to the audit log.
5. Admins can no longer deactivate or demote a Super Admin or another Admin; the last active Super Admin can't be removed; every user change is audit-logged.
6. New passwords: 10+ characters, a letter and a number, common words and the company name rejected.
7. QA gate: any edit sends an assessment back to SUBMITTED; agents can only edit their own; the audit log records which fields changed.
8. `seed.ts` has no default password; demo accounts only with `SEED_DEMO_DATA=true`.
9. `.gitignore` ignores every `.env*` file except `.env.example`.

## Part 2: owner documents (ID copies, consent forms, registration papers, licences)
1. Encrypted BEFORE storage (AES-256-GCM). Storage only ever holds unreadable bytes, so a leaked link reveals nothing. The file name travels inside the encrypted envelope, not in the storage path.
2. The only way to open one is `/api/stores/<id>/documents/<consent|registration|ownership|license>`. It checks the user (admins: any store; field agents: only stores they captured; FMCG clients: never), decrypts, and writes a `document.view` audit entry.
3. Uploads are checked by file CONTENT (a "PDF" that is really HTML/script is refused), limited to PDF/JPEG/PNG/WebP/HEIC, max 4MB. SVG is refused everywhere.
4. Stored links must point at our own storage host (no arbitrary URLs).
5. Redacting a store's personal information now also DELETES its documents. Previously it cleared the typed numbers but left the ID copy in place.
6. A replaced or removed document, and every document of a deleted store, is deleted from storage instead of being orphaned.
7. `scripts/encrypt-existing-documents.ts` encrypts documents uploaded before this change.

## Manual steps the code cannot do for you (do these IN ORDER)
1. Generate the document key:  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. Put it in `.env` AND in Vercel (Settings -> Environment Variables) as `DOCUMENT_ENCRYPTION_KEY`, BEFORE deploying this code. Without it, uploading a document shows a "not configured" error.
3. BACK THE KEY UP in a password manager. If it is lost, encrypted documents can never be opened again. Never commit it.
4. Deploy, then migrate old documents:
   `npx tsx scripts/encrypt-existing-documents.ts`           (dry run, changes nothing)
   `npx tsx scripts/encrypt-existing-documents.ts --apply`
   Until you do, old documents are still served only through the access-checked route, but the stored files themselves remain public.
5. Rotate: Neon database password, NEXTAUTH_SECRET, BLOB_READ_WRITE_TOKEN, RESEND_API_KEY (update .env AND Vercel).
6. `git rm --cached .env .env.local`, commit, push. Make the GitHub repo private.
7. Replace the Super Admin password with `scripts/set-password.ts`.
8. Check the live database for demo accounts (agent@realmakoya.co.za, client@tigerbrands-demo.co.za) and deactivate them.

## Decisions you should confirm
- Redaction deletes ALL four documents, including the signed consent form. The audit log still records that consent was given (when and by whom). If your lawyer wants the consent form kept as proof, tell me and I'll exclude it.
- Agents can only open documents for stores THEY captured. Other agents see "Restricted".
- Documents are limited to 4MB (the hosting platform rejects bigger requests anyway).

## Tests (no framework needed)
- `npx tsx tests/policies.test.ts`      34 rules (accounts, QA gate, passwords, lockout)
- `npx tsx tests/documents.test.ts`     24 checks (encryption, tamper detection, file types, access rules)
- `npx tsx --tsconfig tests/tsconfig.harness.json tests/routes.test.ts`   22 end-to-end checks of the REAL upload and download routes using in-memory fakes

## Check it with your own eyes (private window per account)
- FMCG demo client: paste `/dashboard/stores/<any id>` -> redirected to Reports.
- FMCG demo client: open `/api/stores/<id>/documents/ownership` -> 403.
- Upload an ID copy on a store, save, open it from the store page -> it opens. In the Blob dashboard the stored file is unreadable binary.
- Open the store's audit trail -> a "document.view" entry with your name.
- Deactivate a user while logged in, refresh their window -> sent to login.
- 6 wrong passwords for one email -> refused for 15 minutes even with the right one.

## Still not covered
Password reset by email, forced change on first login, MFA; security headers; CI and error monitoring; pagination of reports; photos and CoA/permit files remain on ordinary (unguessable) public links, which is acceptable for non-personal files shown to authorised clients.
