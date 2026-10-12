import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { eventLeafData, LeafSource } from '../proof/event-leaf';

export const DEVNET_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export function solanaEventHash(event:LeafSource){return createHash('sha256').update(eventLeafData(event)).digest('hex');}
export function receiptMemo(hash:string){return `aerogaze:receipt:v1:${hash}`;}
export function parsedReceiptMatches(tx:any,memo:string,issuer:string):boolean {
  if(!tx||!tx.meta||tx.meta.err!==null)return false;
  const message=tx.transaction.message;
  const signed=message.accountKeys.some((k:any)=>k.signer&&k.pubkey.toString()===issuer);
  const matches=message.instructions.some((i:any)=>i.programId.toString()===MEMO_PROGRAM&&typeof i.parsed==='string'&&i.parsed===memo);
  return signed&&matches;
}

@Injectable()
export class SolanaService implements OnApplicationBootstrap,OnApplicationShutdown {
  private timer?:NodeJS.Timeout;
  private running=false;
  readonly enabled=process.env.SOLANA_ENABLED==='true';
  readonly connection=new Connection(process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com',{
    commitment:'confirmed',disableRetryOnRateLimit:true,
    fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)}) as any,
  });
  constructor(private readonly db:DatabaseService){}
  onApplicationBootstrap(){if(this.enabled){void this.tick();this.timer=setInterval(()=>void this.tick(),30000);}}
  onApplicationShutdown(){if(this.timer)clearInterval(this.timer);}
  async assertDevnet(){if(await this.connection.getGenesisHash()!==DEVNET_GENESIS)throw new ServiceUnavailableException('Somente Solana Devnet é permitida');}
  private wallet(){
    if(!this.enabled||!process.env.SOLANA_SECRET_KEY)throw new ServiceUnavailableException('Solana Devnet ainda não configurada');
    try {const values=JSON.parse(process.env.SOLANA_SECRET_KEY);if(!Array.isArray(values)||values.length!==64||values.some(v=>!Number.isInteger(v)||v<0||v>255))throw new Error();return Keypair.fromSecretKey(Uint8Array.from(values));}
    catch {throw new ServiceUnavailableException('Carteira Solana inválida');}
  }
  async enqueue(event:any){
    await this.db.query(`INSERT INTO solana_receipts(event_id,organization_id,farm_id,event_hash) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING`,[event.id,event.organization_id,event.farm_id,solanaEventHash(event)]);
  }
  async tick(){
    if(!this.enabled||this.running)return;this.running=true;
    try {
      const events=await this.db.query(`SELECT e.* FROM sync_events e JOIN demo_actions a ON a.id=e.id LEFT JOIN solana_receipts r ON r.event_id=e.id WHERE r.event_id IS NULL ORDER BY e.received_at LIMIT 20`);
      for(const event of events.rows)await this.enqueue(event);
      const claimed=await this.db.query(`UPDATE solana_receipts SET next_attempt_at=now()+interval '1 minute' WHERE event_id IN
        (SELECT event_id FROM solana_receipts WHERE status IN ('pendente','enviado') AND next_attempt_at<=now() ORDER BY created_at LIMIT 3 FOR UPDATE SKIP LOCKED) RETURNING *`);
      for(const row of claimed.rows){try{await this.submit(row);}catch{await this.db.query("UPDATE solana_receipts SET last_error='RPC ou carteira indisponível; recibo preservado',next_attempt_at=now()+interval '1 minute' WHERE event_id=$1",[row.event_id]);}}
    }catch{/* Uma indisponibilidade nunca interrompe as tarefas ou a prova Base. */}
    finally{this.running=false;}
  }
  async submit(row:any){
    // A identidade da rede é conferida antes de acessar a chave.
    await this.assertDevnet();
    if(row.signature){
      const tx=await this.connection.getParsedTransaction(row.signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});
      if(tx){
        if(!parsedReceiptMatches(tx,receiptMemo(row.event_hash),row.issuer))throw new Error('Recibo não confere');
        await this.db.query("UPDATE solana_receipts SET status='confirmado',confirmed_at=now(),last_error=NULL WHERE event_id=$1",[row.event_id]);return;
      }
      if(await this.connection.getBlockHeight('confirmed')>Number(row.last_valid_block_height)){
        // Não produz uma nova assinatura automaticamente após resposta perdida.
        await this.db.query("UPDATE solana_receipts SET status='expirado',last_error='Transação não localizada antes da expiração; revisar antes de reenviar' WHERE event_id=$1",[row.event_id]);return;
      }
    }else{
      const wallet=this.wallet();
      const latest=await this.connection.getLatestBlockhash('confirmed');
      const tx=new Transaction({feePayer:wallet.publicKey,blockhash:latest.blockhash,lastValidBlockHeight:latest.lastValidBlockHeight});
      tx.add(new TransactionInstruction({programId:new PublicKey(MEMO_PROGRAM),keys:[{pubkey:wallet.publicKey,isSigner:true,isWritable:false}],data:Buffer.from(receiptMemo(row.event_hash))}));
      tx.sign(wallet);
      const signature=(require('bs58') as {encode(b:Uint8Array):string}).encode(tx.signature!);
      const raw=tx.serialize().toString('base64');
      const prepared=await this.db.query(`UPDATE solana_receipts SET signature=$2,raw_transaction=$3,issuer=$4,blockhash=$5,last_valid_block_height=$6,status='enviado' WHERE event_id=$1 AND signature IS NULL RETURNING *`,[row.event_id,signature,raw,wallet.publicKey.toBase58(),latest.blockhash,latest.lastValidBlockHeight]);
      if(!prepared.rows[0])return; // Outro worker já persistiu a assinatura; só ele envia neste ciclo.
      row=prepared.rows[0];
    }
    // Cada retry transmite os mesmos bytes: a rede conserva a mesma assinatura.
    await this.connection.sendRawTransaction(Buffer.from(row.raw_transaction,'base64'),{skipPreflight:false,maxRetries:0,preflightCommitment:'confirmed'});
  }
  async verify(eventId:string){
    const result=await this.db.query(`SELECT r.*,e.id,e.organization_id,e.farm_id,e.device_id,e.type,e.schema_version,e.occurred_at,e.payload FROM solana_receipts r JOIN sync_events e ON e.id=r.event_id WHERE r.event_id=$1`,[eventId]);
    const r=result.rows[0];if(!r)return {eventId,network:'solana-devnet',status:'ausente',checked:false,valid:false};
    const base={eventId,network:'solana-devnet',configured:this.enabled,status:r.status,signature:r.signature,issuer:r.issuer,eventHash:r.event_hash,simulated:r.payload?.simulated===true,
      explorer:r.signature?`https://explorer.solana.com/tx/${r.signature}?cluster=devnet`:null};
    if(!r.signature)return {...base,checked:false,valid:false};
    try{
      await this.assertDevnet();
      const tx=await this.connection.getParsedTransaction(r.signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});
      if(!tx)return {...base,checked:false,valid:false};
      const valid=solanaEventHash(r)===r.event_hash&&parsedReceiptMatches(tx,receiptMemo(r.event_hash),r.issuer);
      return {...base,status:valid?'confirmado':'divergente',checked:true,valid};
    }catch{return {...base,checked:false,valid:false,rpcUnavailable:true};}
  }
}
