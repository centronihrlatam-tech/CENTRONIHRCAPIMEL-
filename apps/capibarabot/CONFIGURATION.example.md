# Configuration example

Create deployment-specific values as Google Apps Script **Script Properties**. Never commit real production values to this repository.

| Property | Required | Example format |
|---|---:|---|
| `TELEGRAM_TOKEN` | yes | secret issued by BotFather |
| `WEBHOOK_SECRET` | yes | random secret with at least 32 characters |
| `OPENAI_API_KEY` | yes | API key for the configured OpenAI project |
| `DIRECTORIO_CARPETAS` | yes | `{"100000001":"DRIVE_FOLDER_ID"}` |
| `PLANNERS_CONTRATADOS` | yes | `{"100000001":"SHEET_ID"}` |
| `PLANNERS_PASANTES` | yes | `{}` |
| `ID_PLANILLA_ANALITICAS` | no | analytics sheet ID |
| `ANALYTICS_USER_ALIASES` | no | `{"100000001":"member_01"}` |
| `SUPPORT_EMAIL` | no | support alias/address |
| `TIME_ZONE` | no | IANA time zone, default `Etc/UTC` |
| `OPENAI_MODEL` | no | model name, default `gpt-4o-mini` |

## User mappings

Production mappings use stable numeric Telegram user IDs as keys. The actual IDs remain private in Script Properties and must not be committed to GitHub.

Example structure:

```json
{
  "100000001": "GOOGLE_RESOURCE_ID_01",
  "100000002": "GOOGLE_RESOURCE_ID_02"
}
```

`ANALYTICS_USER_ALIASES` is optional but recommended when centralized adoption analytics are enabled. It allows the analytics sheet to distinguish users through internal aliases without storing raw Telegram IDs.

```json
{
  "100000001": "member_01",
  "100000002": "member_02"
}
```

## Webhook secret

Generate `WEBHOOK_SECRET` with a cryptographically secure password generator. The deployed Apps Script Web App URL must include the secret as a private query parameter:

```text
<WEB_APP_URL>?secret=<WEBHOOK_SECRET>
```

Configure Telegram with that complete private URL. Do not publish the resulting webhook URL or the command containing your bot token.

## Time zone

The repository uses `Etc/UTC` as a neutral default. Production deployments should set `TIME_ZONE` to the appropriate IANA time zone for the organization.

## clasp

For clasp-based deployment, copy `.clasp.json.example` to `.clasp.json` and replace the placeholder locally. The real `.clasp.json` is intentionally excluded by `.gitignore` because it contains the private Apps Script project ID.
