import { MEMO_PROGRAM,parsedReceiptMatches,receiptMemo,solanaEventHash,SolanaService } from '../src/solana/solana.service';
import { DatabaseService } from '../src/database/database.service';
import { Keypair } from '@solana/web3.js';
const event={id:'event',organization_id:'org',farm_id:'farm',device_id:'device',type:'demo.action_recorded',schema_version:1,occurred_at:'2026-10-12T12:00:00Z',payload:{simulated:true,command:'irrigation.repair'}};
const pubkey=(text:string)=>({toString:()=>text});
test('hash inclui envelope e memo contém somente hash',()=>{
  const hash=solanaEventHash(event);expect(hash).toMatch(/^[a-f0-9]{64}$/);expect(solanaEventHash({...event,payload:{simulated:true,command:'other'}})).not.toBe(hash);expect(receiptMemo(hash)).not.toContain('farm');
});
test('recibo exige memo, programa, emissor signatário e execução sem erro',()=>{
  const memo=receiptMemo(solanaEventHash(event));
  const tx={meta:{err:null},transaction:{message:{accountKeys:[{signer:true,pubkey:pubkey('issuer')}],instructions:[{programId:pubkey(MEMO_PROGRAM),parsed:memo}]}}};
  expect(parsedReceiptMatches(tx,memo,'issuer')).toBe(true);
  expect(parsedReceiptMatches(tx,memo,'other')).toBe(false);expect(parsedReceiptMatches(tx,'different','issuer')).toBe(false);
  tx.meta.err={} as any;expect(parsedReceiptMatches(tx,memo,'issuer')).toBe(false);
});
test('RPC de outra rede bloqueia antes de carregar carteira ou enviar',async()=>{
  const service=new SolanaService({} as DatabaseService);
  jest.spyOn(service.connection,'getGenesisHash').mockResolvedValue('mainnet');
  const wallet=jest.spyOn(service as any,'wallet');const send=jest.spyOn(service.connection,'sendRawTransaction');
  await expect(service.submit({})).rejects.toThrow('Somente Solana Devnet');expect(wallet).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();
});
test('resposta perdida reenvia os mesmos bytes e conserva assinatura persistida',async()=>{
  let saved:any;
  const db={query:jest.fn(async(_sql:string,params:any[])=>{
    saved={event_id:params[0],signature:params[1],raw_transaction:params[2],issuer:params[3],last_valid_block_height:params[5],event_hash:'a'.repeat(64)};
    return {rows:[saved]};
  })};
  const service=new SolanaService(db as unknown as DatabaseService);
  jest.spyOn(service.connection,'getGenesisHash').mockResolvedValue('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
  jest.spyOn(service as any,'wallet').mockReturnValue(Keypair.generate());
  jest.spyOn(service.connection,'getLatestBlockhash').mockResolvedValue({blockhash:'11111111111111111111111111111111',lastValidBlockHeight:1000});
  jest.spyOn(service.connection,'getParsedTransaction').mockResolvedValue(null);
  jest.spyOn(service.connection,'getBlockHeight').mockResolvedValue(900);
  const send=jest.spyOn(service.connection,'sendRawTransaction').mockRejectedValueOnce(new Error('ACK perdido')).mockResolvedValueOnce('same-signature');
  await expect(service.submit({event_id:'event',event_hash:'a'.repeat(64)})).rejects.toThrow('ACK perdido');
  expect(saved.signature).toBeTruthy();await service.submit(saved);
  expect(Buffer.from(send.mock.calls[0][0]).equals(Buffer.from(send.mock.calls[1][0]))).toBe(true);
  expect(db.query).toHaveBeenCalledTimes(1);
});
