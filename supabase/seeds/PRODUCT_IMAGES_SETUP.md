# Product image downloader

This script searches Pixabay for photos using each active product name, rejects repeated byte-identical files, downloads them into `public/images/products/catalog`, uploads them to Supabase Storage, and updates each product's `image_url`.

## Setup
1. Create a public Storage bucket named `product-images` in Supabase (or set `PRODUCT_IMAGE_BUCKET`).
2. Get a Pixabay API key from Pixabay's API page.
3. Add to project-root `.env.local`:
   ```
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   PIXABAY_API_KEY=YOUR_PIXABAY_KEY
   PRODUCT_IMAGE_BUCKET=product-images
   ```
   Keep this file private and never commit it.
4. Install dependencies if needed: `npm install @supabase/supabase-js`
5. Run from project root: `node supabase/seeds/download_product_images.mjs`

## Notes
- The script uses active rows in `products`, not only demo seed records. Review search results visually before treating them as final catalog photography.
- Pixabay results are search matches, not guaranteed exact SKU/product photographs. The script cannot confirm visual suitability.
- If Pixabay returns no usable image or the file is duplicate, the product is listed as a failure; run again later or assign a verified photo manually.
- Local files are created in `public/images/products/catalog`; the public URL is stored in the database.
- A public bucket makes its uploaded files publicly viewable. Do not use it for private images.
