const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Tests use the TypeScript compiler as a dev dependency and a deliberately tiny
// n8n runtime stub. They check request contracts, NOT a live NeuralBus server.
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'nodes', 'SwatNeuralBus', 'SwatNeuralBus.node.ts');
const js = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const stubWorkflow = {
  NodeConnectionTypes: { Main: 'main' },
  NodeOperationError: class NodeOperationError extends Error {
    constructor(_node, message, ctx) { super(message); this.context = ctx; }
  },
};
const baseLoad = Module._load;
let exported;
try {
  Module._load = function (request, parent, isMain) {
    return request === 'n8n-workflow' ? stubWorkflow : baseLoad.call(this, request, parent, isMain);
  };
  const mod = new Module(source, module);
  mod.filename = source;
  mod.paths = Module._nodeModulePaths(path.dirname(source));
  mod._compile(js, source);
  exported = mod.exports;
} finally {
  Module._load = baseLoad;
}
const { SwatNeuralBus, safeBaseUrl } = exported;
const node = new SwatNeuralBus();

function context(resource, operation, params = {}, options = {}) {
  const sent = [];
  const count = options.items || 1;
  const ctx = {
    getInputData: () => Array.from({length:count}, (_, i) => ({ json: { index: i } })),
    getNodeParameter: (key, index, defaultValue) => key === 'resource' ? resource
      : key === 'operation' ? operation
      : Object.hasOwn(params, key) ? (typeof params[key] === 'function' ? params[key](index) : params[key]) : defaultValue,
    getCredentials: async () => ({ baseUrl: options.baseUrl || 'https://neuralbus.norug.es', apiKey: 'nb_SECRET_EXAMPLE' }),
    getNode: () => ({ name: 'SWAT NeuralBus', type: 'swatNeuralBus' }),
    continueOnFail: () => Boolean(options.continueOnFail),
    helpers: {
      httpRequestWithAuthentication: async (_credentialName, request) => {
        sent.push(request);
        if (options.fail) throw new Error(options.fail);
        return { success: true, path: request.url, body: request.body };
      },
    },
  };
  return { ctx, sent };
}

test('safeBaseUrl enforces HTTPS and rejects unsafe path/credentials', () => {
  assert.equal(safeBaseUrl('https://neuralbus.norug.es/'), 'https://neuralbus.norug.es');
  assert.equal(safeBaseUrl('http://localhost:5678/'), 'http://localhost:5678');
  assert.throws(() => safeBaseUrl('http://untrusted.example'), /HTTPS/);
  assert.throws(() => safeBaseUrl('https://test.example/api/v1'), /only the origin/);
  assert.throws(() => safeBaseUrl('https://alice:secret@test.example/'), /only the origin/);
});

test('profile and supported chains use correct authenticated GET routes', async () => {
  const who = context('account','profile');
  await node.execute.call(who.ctx);
  assert.equal(who.sent[0].url, 'https://neuralbus.norug.es/api/v1/product/me');
  const chains = context('blockchain','chains');
  await node.execute.call(chains.ctx);
  assert.equal(chains.sent[0].url, 'https://neuralbus.norug.es/api/v1/chains');
  assert.equal(chains.sent[0].method, 'GET');
});

test('analyze uses canonical REST request and pairs multiple inputs', async () => {
  const mock = context('blockchain', 'analyze', {
    chain:'bitcoin',network:'mainnet', entityType:'wallet',
    value: (i) => `bc1test${i}`,executeSensors:true,query:'Research funds',
  }, {items:2});
  const [out] = await node.execute.call(mock.ctx);
  assert.equal(out.length,2);
  assert.equal(out[1].pairedItem.item,1);
  assert.equal(mock.sent[0].method,'POST');
  assert.deepEqual(mock.sent[1].body, {
    chain:'bitcoin',network:'mainnet',entity_type:'wallet',
    value:'bc1test1',execute_sensors:true,query:'Research funds',
  });
});

test('case evidence uses escaped ID; proof verification path is correct', async () => {
  const evidence = context('case','evidence',{caseId:'SWAT-XYZ/TEST'});
  await node.execute.call(evidence.ctx);
  assert.ok(evidence.sent[0].url.endsWith('/api/v1/cases/SWAT-XYZ%2FTEST/evidence'));
  const proof = context('case','verify',{caseId:'SWAT-XYZ'});
  await node.execute.call(proof.ctx);
  assert.ok(proof.sent[0].url.endsWith('/api/v1/proof/SWAT-XYZ/verify'));
});

test('case GET and graph list/get/data use documented endpoints', async () => {
  const cases = context('case', 'get', {caseId:'SWAT-OK'});
  await node.execute.call(cases.ctx);
  assert.ok(cases.sent[0].url.endsWith('/api/v1/cases/SWAT-OK'));
  for (const [operation, suffix] of [['list',''], ['get','/GRF-OK'], ['data','/GRF-OK/data']]) {
    const item = context('graph', operation, {graphId:'GRF-OK'});
    await node.execute.call(item.ctx);
    assert.equal(item.sent[0].method, 'GET');
    assert.ok(item.sent[0].url.endsWith(`/api/v1/graphs${suffix}`));
    assert.equal(item.sent[0].disableFollowRedirect, true);
    assert.equal(item.sent[0].sendCredentialsOnCrossOriginRedirect, false);
  }
});

test('graph create sends documented schema and validates depth', async () => {
  const params = { chain:'bitcoin',entityType:'wallet',value:'bc1test',
    executeSensors:true,depth:2,maxNodes:120,mode:'fund-flow',style:'swat-dark',
    includeRisk:true, title:'Demo', sourceCaseId:'SWAT-A' };
  const create = context('graph','create',params);
  await node.execute.call(create.ctx);
  assert.equal(create.sent[0].method,'POST');
  assert.deepEqual(create.sent[0].body,{
    chain:'bitcoin',entity_type:'wallet',value:'bc1test',
    execute_sensors:true,depth:2,max_nodes:120,mode:'fund-flow',style:'swat-dark',
    include_risk:true,title:'Demo',case_id:'SWAT-A',
  });
  const invalid = context('graph','create',{...params,depth:6});
  await assert.rejects(node.execute.call(invalid.ctx),/Depth must be 1/);
  assert.equal(invalid.sent.length,0);
});

test('graph share requires an explicit TTL within safe bounds', async () => {
  const share = context('graph','share',{graphId:'GRF-ABC', ttlMinutes:15});
  await node.execute.call(share.ctx);
  assert.equal(share.sent[0].url, 'https://neuralbus.norug.es/api/v1/graphs/GRF-ABC/share');
  assert.deepEqual(share.sent[0].body, {ttl_minutes:15});
  const invalid = context('graph','share',{graphId:'GRF-ABC', ttlMinutes:1});
  await assert.rejects(node.execute.call(invalid.ctx),/TTL must/);
});

test('continueOnFail redacts credentials from errors', async () => {
  const bad = context('account','profile',{}, {continueOnFail:true,fail:'Request failed with nb_SECRET_EXAMPLE'});
  const [out] = await node.execute.call(bad.ctx);
  assert.equal(out.length,1);
  assert.ok(out[0].json.error.includes('[REDACTED]'));
  assert.ok(!JSON.stringify(out).includes('nb_SECRET_EXAMPLE'));
});

test('package metadata lists node and credential outputs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.private,true); // staging: publish is intentionally disabled
  assert.equal(pkg.n8n.nodes.length,1);
  assert.equal(pkg.n8n.credentials.length,1);
  assert.ok(fs.existsSync(path.join(root, 'nodes/SwatNeuralBus/swat.svg')));
});
