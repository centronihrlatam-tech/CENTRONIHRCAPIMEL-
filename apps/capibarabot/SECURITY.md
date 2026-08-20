# Security Policy

## Public portfolio scope

This repository contains a **sanitized public portfolio version** of AI Planner Bot. Production credentials, user mappings, evidence, datasets, and private Google Workspace identifiers must remain outside source control.

## Secrets and environment configuration

Store deployment-specific values in Google Apps Script **Script Properties** rather than in the repository.

Never commit:

- OpenAI API keys;
- Telegram bot tokens;
- `WEBHOOK_SECRET` values;
- real Telegram user IDs or user mappings;
- private Google Drive or Google Sheets identifiers;
- private deployment URLs;
- operational evidence;
- participant, employee, or organizational data;
- logs containing message bodies or private identifiers.

The real `.clasp.json` is also excluded because it contains the private Apps Script project ID.

## Authorization and webhook handling

The public implementation:

- validates a deployment-specific webhook secret;
- accepts activity registration only from private Telegram chats;
- authorizes users by stable numeric Telegram user ID;
- keeps those production IDs in Script Properties rather than in GitHub.

Treat the complete webhook URL as confidential because it contains the deployment secret.

## Spreadsheet safety

Values written to Google Sheets are neutralized against spreadsheet formula injection before being stored.

## AI processing

Task text and the planner labels required for classification are sent to the configured OpenAI account.

The code performs basic redaction of obvious email addresses, URLs, and phone-like strings from task text before classification, but automated redaction cannot guarantee complete de-identification.

If the project is adapted to confidential, regulated, or special-category data, the deployment owner is responsible for appropriate privacy assessment, access controls, contractual requirements, consent where applicable, retention rules, and data-governance measures.

## Analytics privacy

Centralized analytics can use `ANALYTICS_USER_ALIASES` so adoption can be monitored without writing raw Telegram user IDs to the analytics sheet.

The analytics log intentionally excludes:

- message bodies;
- task descriptions;
- raw Telegram user IDs;
- evidence links.

## Before a public release

Review both the current working tree and Git history for secrets or private identifiers. Removing a credential from the latest file does not remove it from earlier commits. If a secret is ever exposed, rotate it and clean the affected Git history before publication.

## Reporting issues

Deployment-specific security issues should be disclosed privately to the relevant maintainer or organization. Do not include credentials, personal data, private resource identifiers, or sensitive operational information in public GitHub issues.
