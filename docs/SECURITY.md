# Security, privacy and correctness

- **Authentication:** use n8n encrypted credentials (`X-API-Key: nb_...`). Never pass keys in workflow parameters, URLs, exported workflow JSON, chat messages or logs.
- **Authorization:** backend is the source of truth for private cases and graphs. API-key owner must match the case/graph or have authorized role. Do not infer access from a known ID.
- **Network:** HTTPS required except local loopback development. No arbitrary endpoint or custom URL operation is exposed. Node credentials allow a configurable trusted base URL.
- **Provenance:** a SHA-256/evidence verification indicates integrity, not a guarantee that an allegation or heuristic attribution is correct. Read `analysis.status`, `warning`, evidence coverage and proof verification state.
- **Third-party sharing:** graph Share returns a bearer-style link. Anyone holding it may access the shared graph until expiry. Use explicit operator consent and short TTL; preserve revocation support.
- **Input/execution:** max graph depth 4, max nodes 5000 and share TTL 5–10080 min follow backend contracts. API handles quotas, logging, scopes, and rate limits.
- **Automation & costs:** creating cases/graphs executes remote work. The node has no verified CU estimation or balance API; avoid uncontrolled loops and retries. Trigger/webhook operation is postponed.
- **Staging:** use disposable key and test data; ensure no report or secret is posted publicly. Backup production before any Dokploy change.
- **Supply chain:** project has `private: true` and no publish workflow. Inspect dependency changes, pin lockfile after clean npm install, then enable CI and audited release provenance.
