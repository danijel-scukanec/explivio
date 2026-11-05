# Manual Azure deploy — one-time setup

`deploy.yml` is a **push-button** workflow (Actions → *Deploy to Azure (manual)* → **Run workflow** →
type `deploy`). It runs `azd up` to provision + deploy. It is **not** triggered on push, so the stack
only costs money when you choose to deploy; tear it down afterwards with `azd down --purge`.

CI (`build-and-test`) still runs automatically on every PR — only the **deploy** is manual.

## 1. Azure login (OIDC — no stored password)

Easiest path, run once locally:

```bash
azd pipeline config --provider github
```

This creates an Azure app registration + **federated credential** for GitHub and sets the repo secrets
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. It also generates an `azure-dev.yml`
workflow that **is** push-triggered — **delete that file** and keep `deploy.yml` (manual) instead.

## 2. Repo variables + secrets

The app config lives in repo settings, not in git. **No AI key is required** — the app authenticates to
Azure OpenAI with its managed identity.

**Variables** (Settings → Secrets and variables → Actions → *Variables*):

| Name | Example |
|------|---------|
| `AZURE_ENV_NAME` | `explivio` |
| `AZURE_LOCATION` | `swedencentral` |

**Secrets** (same page → *Secrets*) — values are in your local `.azure/<env>/.env`:

| Name | Notes |
|------|-------|
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | set by `azd pipeline config` |
| `AI_ENDPOINT` | `https://explivio-openai.openai.azure.com/openai/v1` |
| `AI_MODEL` | `gpt-5-mini` |
| `AI_EMBEDDING_ENDPOINT` | same as `AI_ENDPOINT` |
| `AI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `AI_OPENAI_RESOURCE_ID` | `/subscriptions/.../resourceGroups/rg-explivio-auth/providers/Microsoft.CognitiveServices/accounts/explivio-openai` |
| `ENTRA_AUTHORITY` | `https://<tenant>.ciamlogin.com/<tenantId>/v2.0` |
| `ENTRA_AUDIENCE` | the API app registration's client id |

You can set them from the CLI, e.g.:

```bash
gh variable set AZURE_ENV_NAME --body explivio
gh variable set AZURE_LOCATION --body swedencentral
gh secret set AI_ENDPOINT --body 'https://explivio-openai.openai.azure.com/openai/v1'
# ...and the rest
```

## 3. After deploy

Add the deployed URL as a redirect URI on the SPA app registration in Entra (External ID tenant),
under **Authentication → Single-page application**, if it isn't there already.

Tear down when finished:

```bash
azd down --purge
```
