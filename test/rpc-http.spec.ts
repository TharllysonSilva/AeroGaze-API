import { createServer } from 'node:http';
import { AbiCoder, ZeroAddress, ZeroHash } from 'ethers';
import { EvmAnchorService } from '../src/proof/evm-anchor.service';
import { loadEnv } from '../src/config/env';

test('real HTTP RPC timeout is bounded and read recovers without sending a transaction', async () => {
  let offline = true;
  const methods: string[] = [];
  const root = '0x' + '11'.repeat(32);
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ['tuple(bytes32,address,uint64,uint32,uint32,bool,bytes32)'],
    [[root,ZeroAddress,1,1,1,false,ZeroHash]],
  );
  const server = createServer((req,res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (offline) return; // Connected transport deliberately never answers.
      const input = JSON.parse(body);
      const answer = (request: any) => {
        methods.push(request.method);
        return { jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? '0x14a34' : encoded };
      };
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify(Array.isArray(input) ? input.map(answer) : answer(input)));
    });
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const service = new EvmAnchorService(loadEnv({
    NODE_ENV:'test', DATABASE_URL:'postgresql://not-used', JWT_SECRET:'test-secret-not-used-with-database',
    ANCHOR_MODE:'evm', EVM_CHAIN_ID:'84532',
    EVM_RPC_URL:`http://127.0.0.1:${(server.address() as any).port}`,
    EVM_REGISTRY_ADDRESS:'0x1111111111111111111111111111111111111111',
    EVM_ANCHOR_PRIVATE_KEY:'0x'+'01'.repeat(32), // Fictitious key, loopback RPC only.
  }));
  try {
    const start = Date.now();
    await expect(service.readAnchor('batch-http-test')).rejects.toThrow();
    expect(Date.now()-start).toBeLessThan(20000);
    offline = false;
    expect(await service.readAnchor('batch-http-test')).toEqual({root,revoked:false});
    expect(methods).toContain('eth_call');
    expect(methods.some(method => /send.*Transaction/i.test(method))).toBe(false);
  } finally {
    (service as any).provider.destroy();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
},30000);
