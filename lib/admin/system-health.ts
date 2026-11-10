import { performance } from 'node:perf_hooks';
import { requireRole } from '../backend/auth.js';
import { sendJson, type VercelRequest, type VercelResponse } from '../backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../backend/supabase.js';

type ServiceStatus = 'operational' | 'not_configured' | 'unavailable';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Metode tidak diizinkan.' });
    return;
  }

  if (!isSupabaseConfigured()) {
    sendJson(response, 503, { error: 'Backend Supabase belum dikonfigurasi.' });
    return;
  }

  const supabase = createAdminClient();
  const admin = await requireRole(request, response, supabase, ['admin']);
  if (!admin) return;

  const databaseStartedAt = performance.now();
  const { error } = await supabase.from('profiles').select('id').limit(1);
  const databaseLatencyMs = Math.round(performance.now() - databaseStartedAt);

  if (error) {
    console.error('Unable to check admin system health:', error.message);
  }

  const supabaseProjectRef = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i
    .exec(process.env.SUPABASE_URL ?? '')?.[1];
  const supabaseDashboardUrl = supabaseProjectRef
    ? `https://supabase.com/dashboard/project/${supabaseProjectRef}`
    : undefined;

  const checks = [
    {
      id: 'api',
      name: 'API di Vercel',
      status: 'operational' as ServiceStatus,
      detail: process.env.VERCEL ? 'Fungsi serverless berhasil merespons.' : 'Fungsi API berhasil merespons di lingkungan lokal.',
      latencyMs: null,
      actionUrl: 'https://vercel.com/dashboard',
      actionLabel: 'Buka Vercel',
    },
    {
      id: 'database',
      name: 'Database Supabase',
      status: error ? 'unavailable' as ServiceStatus : 'operational' as ServiceStatus,
      detail: error ? 'Tidak dapat terhubung ke database.' : 'Koneksi database berhasil.',
      latencyMs: error ? null : databaseLatencyMs,
      ...(supabaseDashboardUrl ? {
        actionUrl: supabaseDashboardUrl,
        actionLabel: 'Buka Supabase',
      } : {}),
    },
    {
      id: 'auth',
      name: 'Supabase Auth',
      status: 'operational' as ServiceStatus,
      detail: 'Sesi admin berhasil diverifikasi.',
      latencyMs: null,
      ...(supabaseDashboardUrl ? {
        actionUrl: supabaseDashboardUrl,
        actionLabel: 'Buka Supabase Auth',
      } : {}),
    },
    {
      id: 'payment',
      name: 'Payment gateway',
      status: 'not_configured' as ServiceStatus,
      detail: 'Belum terintegrasi; pembayaran belum dapat diproses.',
      latencyMs: null,
    },
  ];

  sendJson(response, 200, {
    checkedAt: new Date().toISOString(),
    checks,
  });
}
