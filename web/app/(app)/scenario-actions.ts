'use server';
import { apiGet, apiSend } from '@/lib/api';
import { revalidatePath } from 'next/cache';
export async function readScenario(farmId:string):Promise<any> {
  return apiGet(`/v1/demo/farms/${encodeURIComponent(farmId)}`);
}
export async function runScenarioAction(farmId:string,id:string,command:string,target?:string):Promise<any> {
  const result=await apiSend('POST',`/v1/demo/farms/${encodeURIComponent(farmId)}/actions`,{id,command,target});
  revalidatePath('/comando');
  return result;
}
export async function publishSolanaReceipt(eventId:string):Promise<any>{return apiSend('POST',`/v1/solana/receipts/${encodeURIComponent(eventId)}`,{});}
export async function verifySolanaReceipt(eventId:string):Promise<any>{return apiGet(`/v1/solana/verify/${encodeURIComponent(eventId)}`);}
