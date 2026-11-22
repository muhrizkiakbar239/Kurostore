import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

try { process.loadEnvFile('.env.local'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXABAY_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PIXABAY_API_KEY) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PIXABAY_API_KEY in .env.local');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: products, error } = await supabase.from('products').select('id,name,image_url').eq('status','active');
if (error) throw error;
const delay = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
for (let i=0;i<products.length;i++) {
  const p=products[i];
  const query=String(p.name).trim();
  try {
    const url='https://pixabay.com/api/?key='+PIXABAY_API_KEY+'&q='+encodeURIComponent(query)+'&image_type=photo&safesearch=true&per_page=5';
    let response;
    for(let retry=0;retry<4;retry++) {
      response=await fetch(url);
      if(response.ok) break;
      if((response.status===429||response.status>=500)&&retry<3){await delay(2000*(retry+1));continue;}
      throw new Error('Pixabay HTTP '+response.status);
    }
    const hits=(await response.json()).hits||[];
    rows.push({id:p.id,name:p.name,current_image:p.image_url||'',query,candidates:hits.slice(0,5).map(h=>h.largeImageURL||h.webformatURL)});
    console.log('SEARCH ['+(i+1)+'/'+products.length+'] '+p.name+' — '+hits.length+' candidates');
  } catch(e) {
    rows.push({id:p.id,name:p.name,current_image:p.image_url||'',query,candidates:[]});
    console.warn('ERROR '+p.name+': '+e.message);
  }
  await delay(1200);
}
const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const header=['product_id','product_name','current_image','search_query','candidate_1','candidate_2','candidate_3','candidate_4','candidate_5','approved_image_url'];
const csv=[header.map(esc).join(',')];
for(const r of rows) csv.push([r.id,r.name,r.current_image,r.query,...r.candidates,''].map(esc).join(','));
const out=path.resolve('product-image-review.csv');
await mkdir(path.dirname(out),{recursive:true});
await writeFile(out,csv.join('\n'),'utf8');
console.log('\nSaved '+out+'\nThis is a REVIEW file only. It does not download images or change the database.');
