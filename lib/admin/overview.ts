import { requireRole } from '../backend/auth.js';
import { sendJson, type VercelRequest, type VercelResponse } from '../backend/http.js';
import { createAdminClient, isSupabaseConfigured } from '../backend/supabase.js';

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
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

  const [applications, sellers, products, categories, lowStockCount, lowStockProducts] = await Promise.all([
    supabase
      .from('seller_applications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'seller'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('stock', 5),
    supabase
      .from('products')
      .select('id, name, stock')
      .eq('status', 'active')
      .lte('stock', 5)
      .order('stock', { ascending: true })
      .limit(5),
  ]);

  const failedQuery = [applications, sellers, products, categories, lowStockCount, lowStockProducts]
    .find((result) => result.error);
  if (failedQuery?.error) {
    console.error('Unable to fetch admin overview:', failedQuery.error.message);
    sendJson(response, 500, { error: 'Ringkasan dashboard tidak dapat dimuat.' });
    return;
  }

  sendJson(response, 200, {
    metrics: {
      pendingApplications: applications.count ?? 0,
      sellers: sellers.count ?? 0,
      activeProducts: products.count ?? 0,
      activeCategories: categories.count ?? 0,
      lowStockCount: lowStockCount.count ?? 0,
      lowStockProducts: lowStockProducts.data ?? [],
    },
  });
}
