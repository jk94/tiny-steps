# Alexa skill (Phase 8)

Talk to your TinySteps instance through Alexa: log feedings, diapers and sleep by voice, ask when
the baby was last fed / changed / asleep, get a daily summary, and set reminders for the next
feeding or a medication.

Because TinySteps is self-hosted, there is **no shared skill in the Alexa store**. You create a
private skill in your own Amazon developer account that points at *your* instance. This folder
contains everything the skill needs; the design is explained in
[ADR-0017](../docs/adr/0017-alexa-skill-account-linking-and-in-process-endpoint.md) and the scope in
[`docs/roadmap/phase-8/`](../docs/roadmap/phase-8/README.md).

```
alexa/
  skill-package/
    skill.json                         # manifest (endpoint URL, reminders permission)
    interactionModels/custom/de-DE.json
    interactionModels/custom/en-US.json
  account-linking.json                 # template for `ask smapi update-account-linking-info`
  ask-resources.json                   # lets `ask deploy` deploy the skill package
```

## Before you start

- Your instance must be reachable from the internet over **HTTPS with a publicly trusted
  certificate** (e.g. Let's Encrypt behind a reverse proxy). Amazon calls the skill endpoint
  directly. This exposes the instance to the internet — only do it if you are comfortable with
  that; every skill request is signature-checked and anything else is rejected.
- `PUBLIC_URL` is set to that HTTPS address (see `docker-compose.yml`).
- The backend needs **outbound** HTTPS to `s3.amazonaws.com` (Amazon's signing certificates) and
  `api.amazonalexa.com` / `api.eu.amazonalexa.com` (time zone and reminders).
- A free Amazon developer account (<https://developer.amazon.com/alexa/console/ask>), using the
  same Amazon account as your Echo devices.

Below, replace `https://tinysteps.example.com` with your instance's address.

## 1. Create a client secret

```bash
openssl rand -base64 48
```

Keep it — it goes into both the Alexa console and `config.yml`.

## 2. Create the skill

In the Alexa developer console: **Create Skill** → name `TinySteps` → primary locale **German
(DE)** (add **English (US)** later under *Language settings* if you want it) → type **Custom** →
hosting **Provision your own** → template **Start from Scratch**.

### Interaction model

*Build → Interaction Model → JSON Editor*: paste `skill-package/interactionModels/custom/de-DE.json`
(and, for English, switch the language and paste `en-US.json`). **Save** and **Build Skill**.

The invocation name is `tiny steps` ("Alexa, öffne tiny steps"). Change it in the JSON if you like.

### Endpoint

*Build → Endpoint* → **HTTPS** → Default Region:
`https://tinysteps.example.com/api/alexa/skill`, certificate option *"My development endpoint has a
certificate from a trusted certificate authority"*.

### Permissions

*Build → Permissions* → enable **Reminders**.

### Account linking

*Build → Account Linking*:

| Field | Value |
| --- | --- |
| Do you allow users to create an account or link to an existing account with you? | on |
| Allow users to enable skill without account linking | off |
| Security provider | Auth Code Grant |
| Your Web Authorization URI | `https://tinysteps.example.com/alexa/link` |
| Access Token URI | `https://tinysteps.example.com/api/alexa/oauth/token` |
| Your Client ID | e.g. `tinysteps-alexa` |
| Your Secret | the secret from step 1 |
| Your Authentication Scheme | HTTP Basic |
| Scope | `tracking` |
| Default Access Token Expiration Time | `3600` |

Save, then copy the **Alexa Redirect URLs** shown at the bottom of that page (three URLs starting
with `https://pitangui.amazon.com/…`, `https://layla.amazon.com/…`, `https://alexa.amazon.co.jp/…`).

> Prefer the command line? Put your endpoint into `skill-package/skill.json`, run `ask deploy` in
> this folder, then fill in `account-linking.json` and run
> `ask smapi update-account-linking-info --skill-id <skill id> --account-linking-request file:account-linking.json`.

## 3. Configure TinySteps

Add an `alexa` section to `config.yml` and restart the container:

```yaml
alexa:
  # Skill ID from the console (Build → Endpoint, or the skill list).
  skillId: "amzn1.ask.skill.00000000-0000-0000-0000-000000000000"
  clientId: "tinysteps-alexa"
  clientSecret: "<the secret from step 1>"
  # The "Alexa Redirect URLs" from the account-linking page, exactly as shown.
  redirectUris:
    - "https://pitangui.amazon.com/api/skill/link/MXXXXXXXXXXXXX"
    - "https://layla.amazon.com/api/skill/link/MXXXXXXXXXXXXX"
    - "https://alexa.amazon.co.jp/api/skill/link/MXXXXXXXXXXXXX"
```

Without this section the integration is completely off (all Alexa routes answer 404, the profile
page shows no Alexa block).

## 4. Link your account

In the Alexa app: *More → Skills & Games → Your Skills → Dev → TinySteps → Enable*. The app opens
your instance's consent page; sign in (local account or OIDC), optionally pick a **default child**,
and confirm. Alexa may then ask to allow reminders — say yes if you want them.

Every family member links **their own** Amazon account the same way, so entries are attributed to
the right person. If your household shares one Amazon account but uses Alexa **voice profiles**,
Alexa can hand TinySteps the recognized speaker's own link; otherwise everything spoken on that
account is attributed to whoever linked it.

Linked accounts are listed on the **Profile** page under *Alexa*, where you can change the default
child or unlink (effective immediately).

## Things to say

German (English works the same way with the English model):

| Goal | Example |
| --- | --- |
| Bottle | „Alexa, sag tiny steps Flasche mit 120 Millilitern für Emma" |
| Breastfeeding timer | „… Stillen links starten" – „… Stillen beendet" |
| Breastfeeding, finished | „… Emma wurde 15 Minuten rechts gestillt" |
| Diaper | „… Windel nass" / „… Emma hatte eine volle Windel" |
| Sleep | „… Emma schläft jetzt" – „… Emma ist aufgewacht" / „… Emma hat zwei Stunden geschlafen" |
| Last activity | „Alexa, frag tiny steps wann wurde Emma zuletzt gewickelt" / „… status" |
| Daily summary | „… wie war der Tag" / „… Zusammenfassung von gestern" |
| Feeding reminder | „… erinnere mich in drei Stunden ans Füttern" |
| Medication reminder | „… erinnere mich jeden Tag um acht Uhr an das Vitamin D" |
| Planned medications | „… welche Medikamente stehen an" |
| Default child | „… setze Paul als Standardkind" |

With several children, name the child in the command, set a default child, or just answer when
Alexa asks "Für welches Kind?".

## Permissions and fallbacks

Voice follows the household roles exactly like the app: an **Observer** can ask and set reminders
but not log anything, and Alexa explains that instead of failing silently. An unlinked or unlinked-
in-the-app account gets a "please link" answer plus a card in the Alexa app; a missing reminders
permission triggers Alexa's permission prompt, after which the reminder is created without
repeating yourself.

## Customizing

- **Responses:** override any spoken text per language in `config.yml`. Keys and placeholders are
  those in `apps/backend/src/alexa/skill/alexa-messages.ts`; unknown keys or placeholders stop the
  app from starting, so typos cannot reach your speaker.

  ```yaml
  alexa:
    # …
    responses:
      de:
        diaperLogged: "Erledigt – {diaperAdjective} Windel für {childName} notiert."
      en:
        goodbye: "See you!"
  ```

- **Utterances and invocation name:** edit the interaction model JSON in the console (or here, and
  redeploy). Keep intent and slot names unchanged — the backend relies on them, and a unit test
  keeps the shipped models and the code in sync.

## Troubleshooting

- *"Es gab ein Problem mit der Antwort des angeforderten Skills"*: check the backend log for
  `Rejected Alexa request: …`. Common causes: wrong `skillId`, the server clock is off by more
  than 150 seconds, or the backend cannot reach `s3.amazonaws.com`.
- Account linking ends on an error page: the redirect URLs in `config.yml` must match the console
  **exactly**; the consent page names the mismatching part.
- Times are spoken in the Echo's time zone; if it cannot be fetched, the server's time zone is used.
