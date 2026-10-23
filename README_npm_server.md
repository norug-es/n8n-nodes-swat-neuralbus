# SWAT NeuralBus community node for n8n

> **Status: v0.1.0 source-only prototype. NOT published on npm, NOT verified by n8n, NOT deployed or E2E-tested against production.**

An n8n community node for blockchain investigations, case evidence, proof checks and forensic graph generation using SWAT NeuralBus. Designed as a standalone npm package. It does not contain or require the NeuralBus backend source code.

## Available operations

| Resource | Operations | REST API |
| --- | --- | --- |
| Account | Get Profile | `GET /api/v1/product/me` |
| Blockchain | List Supported Chains, Analyze Entity | `GET /api/v1/chains`, `POST /api/v1/analyze` |
| Case | Get, Get Evidence, Verify Proof | `GET /api/v1/cases/:id`, `GET /api/v1/cases/:id/evidence`, `GET /api/v1/proof/:id/verify` |
| Forensic Graph | Create, Get, Get Data, List, Share | `POST/GET /api/v1/graphs`, `GET /api/v1/graphs/:id`, `GET /api/v1/graphs/:id/data`, `POST /api/v1/graphs/:id/share` |

The node uses n8n's encrypted credential store with `X-API-Key`. It accepts a NeuralBus base URL so the same source can be tested against staging. Operation responses preserve native server fields (status, warnings, evidence metadata, etc.) and are not presented as independently validated forensic conclusions.

### Prerequisites

- Node.js >=22.22, npm, git.
- A working **staging** n8n instance or `n8n-node dev` for local tests.
- An API key from NeuralBus beginning `nb_` and access to the corresponding REST endpoints.
- A TLS-valid NeuralBus host. Never bypass HTTPS verification.

### Build and run

```bash
npm install
npm run lint
npm run test
npm run build
npm run dev
```

In the local n8n editor, add **SWAT NeuralBus**. Create **SWAT NeuralBus API** credentials with base URL `https://neuralbus.norug.es` and your private API key. Select **Account → Get Profile** for a low-impact first test. **Do not paste secrets into workflow JSON**.

For read-only REST verification before starting n8n:

```bash
export NEURALBUS_BASE_URL=https://neuralbus.norug.es
read -rsp 'NeuralBus API Key: ' NEURALBUS_API_KEY; echo
export NEURALBUS_API_KEY
./scripts/smoke.sh
unset NEURALBUS_API_KEY
```

`tests/node.test.cjs` uses an isolated mock of the n8n runtime. Passing tests is **not** evidence that npm installation, production routing, Graph Intelligence data, or Dokploy persistence works. Validate the installed node in an actual n8n staging instance.

### Example workflow

Import `examples/bitcoin-analysis-graph.json`, then select your NeuralBus credential on both SWAT nodes. It runs **Manual Trigger → Input Address → Analyze Wallet → Generate Graph**. It is not scheduled and does not automatically publish/share sensitive outputs.

### Deployment

See [docs/DEPLOY_DOKPLOY.md](docs/DEPLOY_DOKPLOY.md) for staging and Dokploy guidance and [docs/SECURITY.md](docs/SECURITY.md) for authorization, sensitive outputs and limits.

### Architecture and boundaries

- NeuralBus remains the central backend for identity, authorization, case ledger and graphs.
- The n8n node calls documented REST routes. MCP access can be done separately through n8n's official MCP Client.
- No webhook trigger is shipped: NeuralBus event/webhook and polling contracts have not been validated.
- No CU balance or quotation interface is shipped: the usage/billing API needs a verified contract.
- Graph `share` creates a tokenized URL that can be accessed by people who possess it; use only with authorization and a short TTL.
- SWAT NeuralBus main repository is separate, with its own licensing and deployment. This plugin is licensed MIT independently and does not copy backend code.

### Source contract

The v0.1 routes and graph constraints were checked against `norug-es/swat-neuralbus` repository files: `app/proof_api.py`, `app/models/proof_schemas.py`, `app/models/graph_schemas.py`, `app/graphs.py`, `app/product.py`. A production response/permission smoke test is still required.

### Roadmap

1. Complete staging integration/QA with real n8n node CLI and a non-production SWAT account.
2. Enable CI lint/build and pin the resulting lock file.
3. Add pagination, graph analytics and case search after validating response contracts.
4. Build an event-backed trigger only after adding authenticated, signed webhooks or durable event cursors to NeuralBus.
5. Implement CU quote and usage APIs; never charge on implicit retries without idempotency.
6. Review public release requirements before publishing an npm package.

The repository URL in `package.json` is **reserved for the intended GitHub repository**. It does not establish that the repository already exists.
