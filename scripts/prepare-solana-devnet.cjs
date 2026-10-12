const fs=require('node:fs');
const {Connection,Keypair,LAMPORTS_PER_SOL}=require('@solana/web3.js');
const file='.env.solana.local';
(async()=>{
  const connection=new Connection('https://api.devnet.solana.com',{commitment:'confirmed',disableRetryOnRateLimit:true,
    fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})});
  if(await connection.getGenesisHash()!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw new Error('Rede diferente de Devnet');
  if(!fs.existsSync(file)){
    const key=Keypair.generate();
    fs.writeFileSync(file,`SOLANA_ENABLED=true\nSOLANA_RPC_URL=https://api.devnet.solana.com\nSOLANA_SECRET_KEY=${JSON.stringify(Array.from(key.secretKey))}\n`,{flag:'wx',mode:0o600});
  }
  process.loadEnvFile(file);
  const key=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_SECRET_KEY)));
  let balance=await connection.getBalance(key.publicKey);
  console.log('Solana Devnet • endereço público: '+key.publicKey.toBase58());
  console.log('Configuração salva no arquivo local ignorado '+file+'; chave não exibida.');
  if(balance<10000000){
    try{const signature=await connection.requestAirdrop(key.publicKey,LAMPORTS_PER_SOL);console.log('Airdrop solicitado: '+signature);}
    catch{console.log('Faucet RPC indisponível ou limitado. Financie o endereço público pelo faucet oficial de Devnet.');}
  }else console.log('Saldo disponível: '+balance/LAMPORTS_PER_SOL+' SOL de teste');
})().catch(()=>{console.error('Preparação Devnet não concluída; nenhuma chave exibida.');process.exitCode=1});
