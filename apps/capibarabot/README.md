# CAPIBARABOT

> Aplicación del monorepo del Centro NIHR LatAm, desplegada bajo el nombre
> **CAPIBARABOT**. Código base: *AI Planner Bot*, de
> [Fernando Andres Rojas Blanco](https://github.com/rojasblanco/ai-planner-bot),
> integrado aquí con su autorización y bajo la **Licencia MIT** propia de este
> directorio ([`LICENSE`](LICENSE)), distinta de la de la raíz del monorepo.
> Índice de aplicaciones en el [README raíz](../../README.md).


[Versión en español](README.es.md)

**AI Planner Bot** is a messaging-based workflow automation tool that reduces the time required to document daily activities in a structured Google Sheets planner.

Developed in the operational context of a **research center**, it combines **Telegram, Google Apps Script, OpenAI, Google Sheets, and Google Drive** so users can register activities from a phone or computer using natural language, interactive buttons, or a combination of both. Photographic evidence can be uploaded directly from Telegram and linked automatically to the corresponding planner record.

This repository contains a **sanitized public portfolio implementation released with permission**. It does not include production credentials, real user mappings, organizational datasets, or private Google Workspace resource identifiers. The public source code and documentation in this repository are distributed under the MIT License.

## The problem

The project began with an assigned process-improvement task involving recurring Google Calendar reminders and planner follow-up. While working on that workflow, a broader opportunity became clear: documenting a single activity could require several repetitive steps.

```text
Activity completed
      ↓
Open the planner
      ↓
Complete several required fields
      ↓
Upload evidence to Google Drive
      ↓
Copy the Drive link
      ↓
Return to the planner
      ↓
Paste the evidence link
```

This becomes especially inefficient when a team member:

- completes many activities in one day;
- works away from a desk;
- performs fieldwork where carrying or using a laptop is impractical;
- needs to catch up on activities after returning from the field;
- must repeatedly upload and link photographic evidence;
- prefers a different writing style from other team members.

## The solution

AI Planner Bot turns a messaging platform into a lightweight mobile and desktop interface for the planner.

```text
Activity completed
      ↓
Telegram message + optional image
      ↓
AI-assisted interpretation
      ↓
Evidence stored in Google Drive
      ↓
Structured record written to Google Sheets
      ↓
Usage event recorded for analytics
```

The goal is not to force users into a rigid form. The system adapts informal input to the planner structure already used by the team.

## Why Telegram?

Telegram was selected for the current implementation because it provides a stable and accessible bot API without requiring paid messaging infrastructure for this use case.

The workflow is **not conceptually tied to Telegram**. It could be adapted to another reliable messaging platform if that platform provides equivalent capabilities for text, images/files, interactive responses, user identification, webhooks, and programmatic replies.

Telegram also supports both **mobile and desktop use**, which is important for a workflow used in the office, during travel, and after fieldwork.

## Key capabilities

- Activity registration from Telegram.
- Mobile and desktop access.
- Natural-language interpretation with OpenAI.
- Flexible recognition of dates and times.
- Matching approximate category names to valid planner labels.
- Retrospective registration of activities completed on previous dates.
- Direct upload of photographic evidence to Google Drive.
- Automatic insertion of the evidence link into the planner.
- Guided registration through interactive buttons.
- Free-text and hybrid registration modes.
- Multiple user roles and planner routing.
- Dynamic reading of valid labels from each user's planner.
- Automatic `Proceso` / `Terminado` status assignment.
- Centralized usage and adoption analytics.
- Built-in `/tutorial` onboarding.
- Configurable support and feedback contact.

## Flexible registration

The same activity can be written in different ways.

A structured version:

```text
03/07/2026. Document review. 11:00 - 12:30.
Component General. Subcomponent Other.
```

A more natural version:

```text
document review from 1100 to 1230 comp general subcomp other on 03072026
```

Both can be normalized into:

```text
Date: 03/07/2026
Description: Document review
Start time: 11:00
End time: 12:30
Component: General
Subcomponent: Other
```

The user can also send only:

```text
document review from 1100 to 1230
```

and attach an evidence image. Previously selected button values can be combined with the free-text message. If required information is still missing, the activity remains in `Proceso` rather than forcing the user to restart.

The system is designed to tolerate common variations such as:

```text
11:00 to 12:30
1100 to 1230
03/07/2026
03072026
```

This reduces time spent correcting formatting, capitalization, punctuation, or minor differences in how users write.

## Guided and hybrid workflows

The `/tarea` command starts a guided flow:

```text
Type
  ↓
Component
  ↓
Subcomponent
  ↓
Responsible person, when applicable
  ↓
Description + time + evidence
```

The buttons are generated from valid labels already present in the user's planner rather than from one fixed menu for everyone.

Users can also mix both approaches: select categories through buttons, then complete the activity with a natural-language message and image.

## Evidence automation and fieldwork

A major source of friction in the original workflow was evidence handling.

### Manual workflow

```text
Take photo
  ↓
Open Google Drive
  ↓
Find the correct folder
  ↓
Upload image
  ↓
Copy the link
  ↓
Open planner
  ↓
Paste link
```

### With AI Planner Bot

```text
Attach image in Telegram
          ↓
Upload to Drive + planner link handled automatically
```

This is especially useful for fieldwork. If an activity cannot be documented immediately, the user can later register it with the appropriate date and time and catch up more quickly from a phone or computer.

## Analytics and adoption monitoring

In addition to the individual planner record, the bot can create a centralized analytics event for each submission.

The public implementation supports a **private analytics alias** configured through Script Properties so adoption can be monitored without storing raw Telegram IDs in the analytics sheet.

The analytics record includes:

- submission timestamp;
- configured user alias;
- user role;
- final status;
- evidence present / absent;
- activity type;
- component;
- subcomponent;
- activity date.

It intentionally does **not** store the task description, Telegram user ID, evidence link, or message body in the analytics sheet.

These metrics can be used to:

- identify higher or lower adoption;
- observe changes in use over time;
- identify users who may need support;
- guide targeted feedback conversations;
- generate charts and usage indicators;
- combine bot-use metrics with other automated organizational analytics.

This creates a feedback loop from **implementation → measurement → user feedback → improvement**.

## Tutorial, onboarding, and support

The bot includes a built-in `/tutorial` command for new users. It explains:

- free-text registration;
- the guided `/tarea` flow;
- recognized planner fields;
- evidence attachment;
- `Proceso` and `Terminado` states;
- cancellation of an active registration;
- examples of valid input styles.

A support contact can also be configured through `SUPPORT_EMAIL` in Script Properties so users can report problems, ask questions, or suggest improvements. No production support address is included in this repository.

## Real-world use

The tool is in active use by a substantial portion of the team for which it was developed. This provides real usage data and direct user feedback, allowing the workflow to be improved based on observed adoption rather than only on assumptions.

Its value is especially visible when several activities must be documented in the same day or when fieldwork activities need to be registered after returning.

## Architecture

```text
                         ┌──────────────────────┐
                         │        User          │
                         │   Mobile / Desktop   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Telegram        │
                         └──────────┬───────────┘
                                    │ Webhook
                                    ▼
                         ┌──────────────────────┐
                         │ Google Apps Script   │
                         └──────┬───────┬───────┘
                                │       │
                   ┌────────────┘       └────────────┐
                   ▼                                 ▼
          ┌──────────────────┐             ┌──────────────────┐
          │    OpenAI API    │             │   Google Drive   │
          │ Text extraction  │             │ Evidence storage │
          └────────┬─────────┘             └────────┬─────────┘
                   │                                │
                   └──────────────┬─────────────────┘
                                  ▼
                         ┌──────────────────────┐
                         │    Google Sheets     │
                         │ Planner + Analytics  │
                         └──────────────────────┘
```

## Technology stack

| Technology | Purpose |
|---|---|
| Google Apps Script | Backend and workflow automation |
| Telegram Bot API | Messaging interface |
| OpenAI API | Natural-language interpretation |
| Google Sheets | Activity planners and analytics |
| Google Drive | Evidence storage |
| PropertiesService | Private deployment configuration |
| CacheService | Temporary state for guided workflows |

## Planner structure

The implementation locates columns by header name rather than relying only on fixed column positions.

Typical headers include:

```text
tipo
compo
sub_comp
descripcion
fecha
hora inicio
hora fin
estado
respaldo - link
```

Some roles may also use:

```text
encargado
```

The structure reflects the workflow for which the tool was originally developed and can be adapted to other teams.

## Configuration

Deployment-specific values are stored in **Google Apps Script Script Properties**, not in source control.

See [CONFIGURATION.example.md](CONFIGURATION.example.md) for the full configuration example.

Main properties include:

- `TELEGRAM_TOKEN`
- `WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `DIRECTORIO_CARPETAS`
- `PLANNERS_CONTRATADOS`
- `PLANNERS_PASANTES`
- `ID_PLANILLA_ANALITICAS` (optional)
- `ANALYTICS_USER_ALIASES` (optional; recommended when adoption analytics are enabled)
- `SUPPORT_EMAIL` (optional)
- `TIME_ZONE` (optional)
- `OPENAI_MODEL` (optional)

Production authorization mappings use stable numeric Telegram user IDs. The actual IDs and Google resource identifiers remain private in Script Properties.

## Security and privacy

The public repository is intentionally separated from the production environment.

Key safeguards in the public implementation include:

- deployment-specific webhook secret;
- private Telegram chat validation;
- authorization by stable Telegram user ID;
- credentials and resource mappings stored outside the repository;
- spreadsheet formula-injection neutralization;
- basic redaction of obvious emails, URLs, and phone-like strings before task text is sent for AI classification;
- analytics that use configurable aliases instead of raw Telegram IDs;
- analytics that exclude message bodies, descriptions, and evidence links.

Task text and relevant planner labels are still sent to the configured AI provider for classification. Automated redaction is not a guarantee of complete de-identification, so each deployment remains responsible for its own privacy, retention, contractual, and data-governance requirements.

See [SECURITY.md](SECURITY.md).

## Project provenance and professional relevance

The software originated from a real process-improvement need in a **research center**. The initial assignment focused on improving a reminder/planner workflow; the repository author subsequently designed and developed the broader bot-based implementation documented here.

**Technical design and source-code development of this public implementation were carried out by the repository author.**

The sanitized public version is released with permission as an **academic and professional portfolio implementation**. The institution is intentionally not identified, and production data, credentials, user information, evidence, and private infrastructure are excluded.

From a portfolio perspective, the project documents the full path from:

**operational need → workflow redesign → technical implementation → real-world use → adoption measurement → iterative improvement**.

See [PROVENANCE.md](PROVENANCE.md) for the project-provenance note.

## Current limitations

- The project depends on Google Apps Script quotas and execution limits.
- The main application logic currently runs in Google Apps Script, which is appropriate for the current scale but may require more scalable infrastructure for substantially larger deployments.
- Natural-language extraction quality depends on the configured model response.
- Analytics are designed for operational adoption monitoring rather than full product telemetry.
- The interface is optimized around the existing planner workflow.

## Possible future improvements

- Editing or correcting previously submitted activities from Telegram.
- Voice-message transcription.
- Multiple evidence files per activity.
- Structured schema validation for AI outputs.
- Automated usage dashboards and configurable reports.
- Reminders for incomplete records.
- Automated tests and further code modularization.
- Additional messaging-platform integrations.
- Migration to more scalable infrastructure if usage grows substantially.

## Deployment

1. Create a Google Apps Script project.
2. Add `Code.gs` and `appsscript.json`.
3. Configure the required Script Properties.
4. Authorize the required Google services.
5. Deploy the project as a Web App.
6. Add the private `WEBHOOK_SECRET` to the deployment URL.
7. Configure that private URL as the Telegram webhook.
8. Test with a non-production user before broader deployment.

For clasp-based workflows, `.clasp.json.example` is provided while the real `.clasp.json` is excluded by `.gitignore`.

## Status and licensing

**Status:** Active / iterative.

The sanitized source code and documentation contained in this public repository are distributed under the [MIT License](LICENSE).

Within this monorepo, that same MIT License — copyright Fernando Andres Rojas Blanco — governs `apps/capibarabot/`. The root `LICENSE` of the monorepo does not apply to this directory.

The license applies only to the material included in this repository. Production credentials, organizational data, private infrastructure, operational evidence, personal information, and other non-public resources from the original operational environment are not part of this repository and are not covered by this public release.

For additional context regarding the origin of the project and the technical contribution documented here, see [PROVENANCE.md](PROVENANCE.md).

---

**Stack:** JavaScript · Google Apps Script · Telegram Bot API · OpenAI API · Google Sheets · Google Drive
