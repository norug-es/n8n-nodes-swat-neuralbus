import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const show = (resource: string, operation: string) => ({
  show: { resource: [resource], operation: [operation] },
});

function encodedId(value: string, label: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null') {
    throw new Error(`${label} is required`);
  }
  return encodeURIComponent(cleaned);
}

export function safeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  const parsed = new URL(normalized);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
    throw new Error('NeuralBus Base URL must use HTTPS (except localhost during development)');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('NeuralBus Base URL must be only the origin, without a path, query or credentials');
  }
  return parsed.origin;
}

export class SwatNeuralBus implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SWAT NeuralBus',
    name: 'swatNeuralBus',
    icon: 'file:swat.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Investigate blockchain entities, evidence, and forensic graphs with SWAT NeuralBus',
    defaults: { name: 'SWAT NeuralBus' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'swatNeuralBusApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Account', value: 'account' },
          { name: 'Blockchain', value: 'blockchain' },
          { name: 'Case', value: 'case' },
          { name: 'Forensic Graph', value: 'graph' },
        ],
        default: 'blockchain',
      },
      {
        displayName: 'Operation', name: 'operation', type: 'options',
        noDataExpression: true, displayOptions: { show: { resource: ['account'] } },
        options: [
          { name: 'Get Profile', value: 'profile', action: 'Get my NeuralBus profile' },
        ], default: 'profile',
      },
      {
        displayName: 'Operation', name: 'operation', type: 'options',
        noDataExpression: true, displayOptions: { show: { resource: ['blockchain'] } },
        options: [
          { name: 'Analyze Entity', value: 'analyze', action: 'Analyze a blockchain entity' },
          { name: 'List Supported Chains', value: 'chains', action: 'List supported blockchain networks' },
        ], default: 'analyze',
      },
      {
        displayName: 'Operation', name: 'operation', type: 'options',
        noDataExpression: true, displayOptions: { show: { resource: ['case'] } },
        options: [
          { name: 'Get', value: 'get', action: 'Get an investigation case' },
          { name: 'Get Evidence', value: 'evidence', action: 'Get evidence from a case' },
          { name: 'Verify Proof', value: 'verify', action: 'Verify case proof status' },
        ], default: 'get',
      },
      {
        displayName: 'Operation', name: 'operation', type: 'options',
        noDataExpression: true, displayOptions: { show: { resource: ['graph'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Generate a forensic graph' },
          { name: 'Get', value: 'get', action: 'Get a forensic graph' },
          { name: 'Get Data', value: 'data', action: 'Get forensic graph nodes and edges' },
          { name: 'List', value: 'list', action: 'List my forensic graphs' },
          { name: 'Share', value: 'share', action: 'Create an expiring graph share link' },
        ], default: 'create',
      },
      {
        displayName: 'Blockchain', name: 'chain', type: 'string', default: 'bitcoin',
        description: 'Blockchain ID, such as bitcoin, solana, ethereum, base or polygon',
        required: true,
        displayOptions: { show: { resource: ['blockchain', 'graph'], operation: ['analyze', 'create'] } },
      },
      {
        displayName: 'Entity Type', name: 'entityType', type: 'options', default: 'wallet',
        options: [
          { name: 'Wallet', value: 'wallet' },
          { name: 'Address', value: 'address' },
          { name: 'Transaction', value: 'transaction' },
          { name: 'Token', value: 'token' },
          { name: 'Contract', value: 'contract' },
          { name: 'Program', value: 'program' },
        ],
        displayOptions: { show: { resource: ['blockchain', 'graph'], operation: ['analyze', 'create'] } },
      },
      {
        displayName: 'Address / Transaction / Entity', name: 'value', type: 'string', default: '',
        required: true, description: 'Blockchain entity value. Expressions like {{$json.address}} are supported.',
        displayOptions: { show: { resource: ['blockchain', 'graph'], operation: ['analyze', 'create'] } },
      },
      {
        displayName: 'Network', name: 'network', type: 'string', default: 'mainnet',
        displayOptions: show('blockchain', 'analyze'),
      },
      {
        displayName: 'Execute Sensors', name: 'executeSensors', type: 'boolean', default: true,
        description: 'Whether to request live sensor analysis. Availability and quotas depend on the server.',
        displayOptions: { show: { resource: ['blockchain', 'graph'], operation: ['analyze', 'create'] } },
      },
      {
        displayName: 'Analysis Query', name: 'query', type: 'string', default: '',
        description: 'Optional free-text research question passed to sensor routing',
        displayOptions: show('blockchain', 'analyze'),
      },
      {
        displayName: 'Case ID', name: 'caseId', type: 'string', default: '', required: true,
        description: 'SWAT-... identifier',
        displayOptions: { show: { resource: ['case'] } },
      },
      {
        displayName: 'Source Case ID', name: 'sourceCaseId', type: 'string', default: '',
        description: 'Optional existing case owned by the connected account',
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'Graph ID', name: 'graphId', type: 'string', default: '', required: true,
        description: 'GRF-... identifier',
        displayOptions: { show: { resource: ['graph'], operation: ['get', 'data', 'share'] } },
      },
      {
        displayName: 'Title', name: 'title', type: 'string', default: '',
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'Depth', name: 'depth', type: 'number', default: 2,
        typeOptions: { minValue: 1, maxValue: 4 },
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'Maximum Nodes', name: 'maxNodes', type: 'number', default: 120,
        typeOptions: { minValue: 10, maxValue: 5000 },
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'Graph Mode', name: 'mode', type: 'options', default: 'fund-flow',
        options: [
          { name: 'Fund Flow', value: 'fund-flow' },
          { name: 'Relationships', value: 'relationship' },
          { name: 'Contamination', value: 'contamination' },
          { name: 'Cluster', value: 'cluster' },
          { name: 'Case', value: 'case' },
          { name: 'Token Path', value: 'token-path' },
        ],
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'Visual Style', name: 'style', type: 'options', default: 'swat-dark',
        options: [
          { name: 'SWAT Dark', value: 'swat-dark' },
          { name: 'SWAT Danger', value: 'swat-danger' },
          { name: 'SWAT Executive', value: 'swat-executive' },
        ],
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'Include Risk', name: 'includeRisk', type: 'boolean', default: true,
        displayOptions: show('graph', 'create'),
      },
      {
        displayName: 'TTL (Minutes)', name: 'ttlMinutes', type: 'number', default: 60,
        description: 'Anyone with the temporary link can see the shared graph until it expires. Do not share sensitive data.',
        typeOptions: { minValue: 5, maxValue: 10080 },
        displayOptions: show('graph', 'share'),
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const input = this.getInputData();
    const output: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('swatNeuralBusApi');
    const base = safeBaseUrl(String(credentials.baseUrl ?? 'https://neuralbus.norug.es'));

    for (let i = 0; i < input.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        let method: IHttpRequestOptions['method'] = 'GET';
        let path: string;
        let body: IDataObject | undefined;

        if (resource === 'account' && operation === 'profile') {
          path = '/api/v1/product/me';
        } else if (resource === 'blockchain' && operation === 'chains') {
          path = '/api/v1/chains';
        } else if (resource === 'blockchain' && operation === 'analyze') {
          path = '/api/v1/analyze';
          method = 'POST';
          body = {
            chain: this.getNodeParameter('chain', i),
            network: this.getNodeParameter('network', i),
            entity_type: this.getNodeParameter('entityType', i),
            value: this.getNodeParameter('value', i),
            execute_sensors: this.getNodeParameter('executeSensors', i),
          };
          const query = String(this.getNodeParameter('query', i, '')).trim();
          if (query) body.query = query;
        } else if (resource === 'case' && ['get', 'evidence', 'verify'].includes(operation)) {
          const caseId = encodedId(String(this.getNodeParameter('caseId', i)), 'Case ID');
          path = operation === 'verify'
            ? `/api/v1/proof/${caseId}/verify`
            : `/api/v1/cases/${caseId}${operation === 'evidence' ? '/evidence' : ''}`;
        } else if (resource === 'graph' && operation === 'list') {
          path = '/api/v1/graphs';
        } else if (resource === 'graph' && operation === 'create') {
          path = '/api/v1/graphs';
          method = 'POST';
          const depth = Number(this.getNodeParameter('depth', i));
          const maxNodes = Number(this.getNodeParameter('maxNodes', i));
          if (!Number.isInteger(depth) || depth < 1 || depth > 4) throw new Error('Depth must be 1–4');
          if (!Number.isInteger(maxNodes) || maxNodes < 10 || maxNodes > 5000) throw new Error('Maximum Nodes must be 10–5000');
          body = {
            chain: this.getNodeParameter('chain', i),
            entity_type: this.getNodeParameter('entityType', i),
            value: this.getNodeParameter('value', i),
            execute_sensors: this.getNodeParameter('executeSensors', i),
            depth, max_nodes: maxNodes,
            mode: this.getNodeParameter('mode', i),
            style: this.getNodeParameter('style', i),
            include_risk: this.getNodeParameter('includeRisk', i),
          };
          const title = String(this.getNodeParameter('title', i, '')).trim();
          const caseId = String(this.getNodeParameter('sourceCaseId', i, '')).trim();
          if (title) body.title = title;
          if (caseId) body.case_id = caseId;
        } else if (resource === 'graph' && ['get', 'data', 'share'].includes(operation)) {
          const graphId = encodedId(String(this.getNodeParameter('graphId', i)), 'Graph ID');
          path = `/api/v1/graphs/${graphId}`;
          if (operation === 'data') path += '/data';
          if (operation === 'share') {
            path += '/share';
            method = 'POST';
            const ttlMinutes = Number(this.getNodeParameter('ttlMinutes', i));
            if (!Number.isInteger(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 10080) {
              throw new Error('TTL must be 5–10080 minutes');
            }
            body = { ttl_minutes: ttlMinutes };
          }
        } else {
          throw new Error(`Unsupported resource/operation combination: ${resource}/${operation}`);
        }

        const request: IHttpRequestOptions = {
          method,
          url: `${base}${path}`,
          headers: { Accept: 'application/json' },
          json: true,
          disableFollowRedirect: true,
          sendCredentialsOnCrossOriginRedirect: false,
          timeout: 45000,
        };
        if (body) {
          request.body = body;
          request.headers = { ...request.headers, 'Content-Type': 'application/json' };
        }
        const result = await this.helpers.httpRequestWithAuthentication.call(
          this, 'swatNeuralBusApi', request,
        ) as unknown;
        const json = result !== null && typeof result === 'object' && !Array.isArray(result)
          ? result as IDataObject
          : { result } as IDataObject;
        output.push({ json, pairedItem: { item: i } });
      } catch (error) {
        const e = error instanceof Error ? error : new Error(String(error));
        // Prevent accidental exposure of API keys in execution logs.
        const apiKey = String(credentials.apiKey ?? '');
        const safeMessage = apiKey ? e.message.split(apiKey).join('[REDACTED]') : e.message;
        if (this.continueOnFail()) {
          output.push({ json: { error: safeMessage }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), safeMessage, { itemIndex: i });
      }
    }
    return [output];
  }
}
