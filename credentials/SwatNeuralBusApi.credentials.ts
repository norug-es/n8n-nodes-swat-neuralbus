import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class SwatNeuralBusApi implements ICredentialType {
  name = 'swatNeuralBusApi';
  displayName = 'SWAT NeuralBus API';
  icon = 'file:../nodes/SwatNeuralBus/swat.svg' as const;
  documentationUrl = 'https://neuralbus.norug.es/connect/';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://neuralbus.norug.es',
      required: true,
      description: 'NeuralBus REST base URL, without /mcp/ or /api/v1',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your nb_... key. n8n stores this as an encrypted credential.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-Key': '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      method: 'GET',
      url: '={{$credentials.baseUrl.replace(/\\/$/, "") + "/api/v1/product/me"}}',
      headers: { Accept: 'application/json' },
    },
  };
}
