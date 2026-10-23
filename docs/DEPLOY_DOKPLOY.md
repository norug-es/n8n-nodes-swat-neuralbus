# n8n + Dokploy — staging deployment runbook

## State

Source preview only, no npm release or production deployment. Do not install the source ZIP as an npm community node: build the package first, then install a verified package from a trusted registry or build a pinned custom image.

## Local acceptance first

1. Install Node.js 22.22+ and verify `node -v`.
2. `npm install && npm run lint && npm test && npm run build`.
3. `npm run dev` starts an n8n editor provided by `@n8n/node-cli`.
4. Configure `SWAT NeuralBus API` credential in the n8n UI. Use an unprivileged, disposable SWAT user.
5. Run `Account > Get Profile` and `Blockchain > List Supported Chains`.
6. In a **staging** environment only, analyze a public demo address; verify `analysis.status`, warnings and case visibility.
7. Generate a graph with `executeSensors=false`; confirm graph ownership and retrieve data.
8. Only with authorization, test graph sharing with short TTL; verify expiry and revocation server-side.

## Deploy to Dokploy (safe path)

- Create a separate **staging n8n** app with its own persistent state. Backup the existing production volumes and DB before any production rollout.
- Prefer a **version-pinned Docker image** with `n8n-nodes-swat-neuralbus` preinstalled once it is packaged and tested, rather than writing into an ephemeral container.
- If using queue mode, ensure main, webhook and workers use the **same installed node version**. Restart/redeploy all of them together.
- Validate n8n node type discovery and credentials for that instance, workflows, job executions, Web UI, and worker logs.
- Do not enable `N8N_COMMUNITY_PACKAGES_MANAGED_BY_ENV=true` without explicitly including **all** existing packages in the manifest: omitted packages can be removed.
- Pin n8n and plugin versions; run smoke tests and a rollback exercise. Never publish or check in the nb_ key.

## Reserved remote project and release

Expected owner/repository: `norug-es/n8n-nodes-swat-neuralbus`.

If the GitHub repository does not exist, create an **empty private repository** under `norug-es`, with no generated README/license. From this extracted directory:

```bash
git init -b main
git add .
git commit -m 'feat: bootstrap SWAT NeuralBus n8n node v0.1.0'
git remote add origin git@github.com:norug-es/n8n-nodes-swat-neuralbus.git
git push -u origin main
```

Or, with GitHub CLI and organization creation rights:

```bash
gh auth login
gh repo create norug-es/n8n-nodes-swat-neuralbus --private --source . --remote origin --push
```

The package has `"private": true` intentionally. After proper staging and security review, remove it for npm publishing and add provenance-enabled release automation. Do not treat this source prototype as verified/published.
