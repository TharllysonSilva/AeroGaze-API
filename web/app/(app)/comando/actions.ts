'use server';

import { revalidatePath } from 'next/cache';
import { apiSend } from '@/lib/api';

const ALERT_STATUS = ['aberto', 'reconhecido', 'resolvido'];
const TASK_STATUS = ['pendente', 'em_progresso', 'concluida'];

export async function setAlertStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !ALERT_STATUS.includes(status)) return;
  await apiSend('PATCH', `/v1/alerts/${id}/status`, { status });
  revalidatePath('/comando');
}

export async function setTaskStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !TASK_STATUS.includes(status)) return;
  await apiSend('PATCH', `/v1/tasks/${id}/status`, { status });
  revalidatePath('/comando');
}
