import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync("./kuromart_catalog_200.json", "utf8"));
const products = Object.entries(catalog.categories).flatMap(
  ([category, names]) => names.map(name => ({ category, name }))
);

const start = 0;
const end = 20;
const checkpoint = "./catalog-review/batch-progress.json";
const output = "./catalog-review/candidates.json";

fs.mkdirSync("./catalog-review", { recursive: true });

let results = fs.existsSync(checkpoint)
  ? JSON.parse(fs.readFileSync(checkpoint, "utf8"))
  : {};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function search(name) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: name,
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "400",
    format: "json"
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(
        "https://commons.wikimedia.org/w/api.php?" + params,
        {
          headers: {
            "User-Agent": "KUROMARTCatalogReview/1.0 (catalog image review)"
          },
          signal: AbortSignal.timeout(30000)
        }
      );

      if (res.status === 429) {
        const retry = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retry) && retry > 0
          ? retry * 1000
          : attempt * 20000;

        console.log("Rate limit. Menunggu", wait / 1000, "detik");
        await sleep(wait);
        continue;
      }

      if (!res.ok) throw new Error("HTTP " + res.status);

      const json = await res.json();

      return Object.values(json.query?.pages || {})
        .map(p => {
          const info = p.imageinfo?.[0];
          const meta = info?.extmetadata || {};

          return {
            title: p.title,
            image: info?.thumburl || info?.url || "",
            original: info?.url || "",
            page: info?.descriptionurl || "",
            license: meta.LicenseShortName?.value || "Unknown",
            artist: meta.Artist?.value || "",
            source: "Wikimedia Commons"
          };
        })
        .filter(x => x.image);

    } catch (e) {
      console.log("Percobaan", attempt, name, e.message);

      if (attempt < 4) {
        await sleep(attempt * 10000);
      }
    }
  }

  return null;
}

for (let i = start; i < end; i++) {
  if (results[i]?.candidates?.length) {
    console.log("Lewati:", products[i].name);
    continue;
  }

  console.log("Pencarian", i + 1, "/", end, products[i].name);

  const candidates = await search(products[i].name);

  if (candidates === null) {
    console.log("Gagal sementara. Progres sebelumnya tetap tersimpan.");
    break;
  }

  results[i] = {
    ...products[i],
    candidates,
    selected: null
  };

  fs.writeFileSync(checkpoint, JSON.stringify(results, null, 2));

  console.log("Kandidat:", candidates.length);
  await sleep(12000);
}

const merged = products.map((p, i) =>
  results[i] || { ...p, candidates: [], selected: null }
);

fs.writeFileSync(output, JSON.stringify(merged, null, 2));

console.log("Batch selesai atau berhenti sementara. Progres tersimpan.");
