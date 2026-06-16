/**
 * Free3Dicons Build Script
 * Fetches all icon data from WordPress REST API
 * Generates static HTML pages + icons.json
 * Pushes to GitHub → Cloudflare Pages auto-deploys
 *
 * Run: node build.js
 * Or via WP plugin: triggered automatically on publish
 */

const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const http     = require('http');

// Config from environment variables (set by GitHub Actions secrets)
const CONFIG = {
    wpApiUrl:     process.env.WP_API_URL    || 'https://cmsadmin.free3dicons.com/wp-json/wp/v2',
    wpApiKey:     process.env.WP_API_KEY    || '',
    outputDir:    process.env.OUTPUT_DIR    || '.',
    cdnBase:      process.env.CDN_BASE      || 'https://cdn.free3dicons.com',
    devMode:      process.env.DEV_MODE      || 'no',
    siteUrl:      process.env.SITE_URL      || 'https://free3dicons.com',
    buildReason:  process.env.BUILD_REASON  || 'Manual build',
};

const OUTPUT  = CONFIG.outputDir;
const SITE    = CONFIG.siteUrl;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${ts}] ${msg}`);
    fs.appendFileSync(path.join(__dirname, 'build.log'), `[${ts}] ${msg}\n`);
}

function mkdir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function write(filePath, content) {
    mkdir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const opts = { headers: { 'User-Agent': 'Free3Dicons-Builder/1.0' } };

        if (CONFIG.wpApiKey) {
            opts.headers['Authorization'] = 'Basic ' +
                Buffer.from('admin:' + CONFIG.wpApiKey).toString('base64');
        }

        protocol.get(url, opts, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error: ' + data.substring(0, 200))); }
            });
        }).on('error', reject);
    });
}

// ─── Fetch ALL icons from WP REST API (handles pagination) ────────────────────

async function fetchAllIcons() {
    log('Fetching icons from WordPress REST API...');
    let icons = [];
    let page  = 1;
    let total = null;

    while (true) {
        const url  = `${CONFIG.wpApiUrl}/f3d_icon?per_page=100&page=${page}&_embed=1`;
        const data = await fetchJson(url);

        if (!Array.isArray(data) || data.length === 0) break;

        const mapped = data.map(icon => ({
            id:          icon.id,
            name:        icon.title?.rendered || '',
            slug:        icon.slug,
            url:         `${SITE}/icon/${icon.slug}/`,
            preview_url: icon.preview_url || '',
            full_url:    icon.full_url    || '',
            premium:     icon.premium     || 'no',
            status:      icon.icon_status || 'published',
            // Taxonomies
            categories:  icon.categories_list || [],
            colors:      icon.colors_list     || [],
            styles:      icon.styles_list     || [],
            moods:       icon.moods_list      || [],
            usecases:    icon.usecases_list   || [],
            tags:        icon.tags_list       || [],
            // Slugs for frontend filtering
            color_slugs:   icon.colors_slugs   || [],
            style_slugs:   icon.styles_slugs   || [],
            mood_slugs:    icon.moods_slugs    || [],
            usecase_slugs: icon.usecases_slugs || [],
            date:        icon.date?.substring(0, 10) || '',
        }));

        // Only include published icons in frontend
        icons = icons.concat(mapped.filter(i => i.status === 'published'));

        log(`  Page ${page}: ${data.length} icons fetched`);
        if (data.length < 100) break;
        page++;
    }

    log(`Total icons fetched: ${icons.length}`);
    return icons;
}

// ─── Fetch packs ──────────────────────────────────────────────────────────────

async function fetchAllPacks() {
    log('Fetching packs...');
    const data = await fetchJson(`${CONFIG.wpApiUrl}/f3d_pack?per_page=100`);
    if (!Array.isArray(data)) return [];
    return data.map(pack => ({
        id:        pack.id,
        name:      pack.title?.rendered || '',
        slug:      pack.slug,
        url:       `${SITE}/pack/${pack.slug}/`,
        icon_ids:  pack.icon_ids  || [],
        icon_count: pack.icon_count || 0,
    }));
}

// ─── Generate icons.json ──────────────────────────────────────────────────────

function generateIconsJson(icons) {
    log('Generating icons.json...');
    const jsonPath = path.join(OUTPUT, 'data', 'icons.json');
    write(jsonPath, JSON.stringify(icons, null, 2));
    log(`  icons.json written: ${icons.length} icons, ${(fs.statSync(jsonPath).size / 1024).toFixed(1)}KB`);
}

// ─── HTML Templates ───────────────────────────────────────────────────────────

function baseHead(title, description, canonicalUrl, ogImage = '') {
    return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${escHtml(title)}">
  <meta property="og:description" content="${escHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="/css/bootstrap.min.css">
  <link rel="stylesheet" href="/css/style.css">
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','GA_MEASUREMENT_ID');</script>
  <!-- AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
  <!-- Cloudflare Analytics -->
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"XXXXXXXXXXXXXXXX"}'></script>`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function schemaImageObject(icon) {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type':    'ImageObject',
        'name':     icon.name,
        'contentUrl': icon.full_url,
        'license':  `${SITE}/license/`,
        'acquireLicensePage': icon.url,
        'creator':  { '@type': 'Organization', 'name': 'Free3Dicons' },
        'encodingFormat': 'image/png',
        'width': 1024,
        'height': 1024,
    });
}

// ─── Generate individual icon pages ───────────────────────────────────────────

function generateIconPages(icons) {
    log('Generating individual icon pages...');
    let count = 0;

    for (const icon of icons) {
        const title       = `${icon.name} - Free 3D Icon PNG Download | Free3Dicons`;
        const description = `Download ${icon.name} as free 3D icon in PNG format. Available in 64px, 128px, 256px, 512px and 1024px. ${icon.style} style.`;
        const filePath    = path.join(OUTPUT, 'icon', icon.slug, 'index.html');
        const tags        = icon.tags.join(', ');
        const catLinks    = icon.categories.map(c =>
            `<a href="/category/${c.toLowerCase().replace(/\s+/g,'-')}/" class="badge bg-secondary me-1">${escHtml(c)}</a>`
        ).join('');
        const tagLinks    = icon.tags.map(t =>
            `<a href="/tag/${t.toLowerCase().replace(/\s+/g,'-')}/" class="badge bg-light text-dark me-1 mb-1">${escHtml(t)}</a>`
        ).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>${baseHead(title, description, icon.url, icon.preview_url)}
  <script type="application/ld+json">${schemaImageObject(icon)}</script>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="/">Free3Dicons</a>
      <div class="d-flex">
        <a href="/" class="nav-link text-white me-3">Browse</a>
        <a href="/request-icon/" class="nav-link text-white">Request Icon</a>
      </div>
    </div>
  </nav>

  <div class="container py-4">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="/">Home</a></li>
        ${icon.categories[0] ? `<li class="breadcrumb-item"><a href="/category/${icon.categories[0].toLowerCase().replace(/\s+/g,'-')}/">${escHtml(icon.categories[0])}</a></li>` : ''}
        <li class="breadcrumb-item active">${escHtml(icon.name)}</li>
      </ol>
    </nav>

    <div class="row g-4">
      <div class="col-lg-5 text-center">
        <div class="icon-preview-box p-4 bg-light rounded-3 mb-3">
          <img src="${escHtml(icon.preview_url)}"
               alt="${escHtml(icon.name)} PNG free download"
               class="img-fluid" style="max-width:256px;" width="256" height="256"
               id="iconPreviewImg">
        </div>

        <div class="download-section p-3 border rounded-3 bg-white">
          <h5 class="mb-3">Download Free PNG</h5>

          <div class="d-flex gap-2 justify-content-center flex-wrap mb-3">
            <button class="btn btn-outline-primary btn-download" onclick="downloadIcon('${escHtml(icon.full_url)}','${escHtml(icon.slug)}',64)">64px</button>
            <button class="btn btn-outline-primary btn-download" onclick="downloadIcon('${escHtml(icon.full_url)}','${escHtml(icon.slug)}',128)">128px</button>
            <button class="btn btn-primary btn-download" onclick="downloadIcon('${escHtml(icon.full_url)}','${escHtml(icon.slug)}',256)">256px ⭐</button>
            <button class="btn btn-outline-primary btn-download" onclick="downloadIcon('${escHtml(icon.full_url)}','${escHtml(icon.slug)}',512)">512px</button>
            <button class="btn btn-outline-primary btn-download" onclick="downloadIcon('${escHtml(icon.full_url)}','${escHtml(icon.slug)}',1024)">1024px</button>
          </div>

          <div class="d-flex gap-2 justify-content-center align-items-center mb-3">
            <span class="text-muted small">Format:</span>
            <button class="btn btn-sm btn-dark fmt-btn active" onclick="setFormat('png',this)">PNG</button>
            <button class="btn btn-sm btn-outline-secondary fmt-btn" onclick="setFormat('webp',this)">WebP</button>
            <button class="btn btn-sm btn-outline-secondary fmt-btn" onclick="setFormat('jpeg',this)">JPG</button>
          </div>

          <div class="input-group mb-0">
            <input type="number" class="form-control" id="customSize"
                   placeholder="Custom size px" min="16" max="2048">
            <button class="btn btn-outline-secondary"
                    onclick="downloadCustom('${escHtml(icon.full_url)}','${escHtml(icon.slug)}')">
                    Download
            </button>
          </div>
        </div>
      </div>

      <div class="col-lg-7">
        <h1 class="h2 mb-2">${escHtml(icon.name)}</h1>
        <div class="mb-3">${catLinks}</div>
        <div class="mb-3">${tagLinks}</div>

        <table class="table table-sm table-bordered">
          <tr><th>Style</th><td>${escHtml(ucfirst(icon.style))}</td></tr>
          <tr><th>Format</th><td>PNG (transparent background)</td></tr>
          <tr><th>Sizes</th><td>64, 128, 256, 512, 1024px</td></tr>
          <tr><th>License</th><td><a href="/license/">Free for personal &amp; commercial use</a></td></tr>
        </table>

        <!-- AdSense Manual Unit -->
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins>
        <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
      </div>
    </div>
  </div>

  <script src="/js/bootstrap.bundle.min.js"></script>
  <script src="/js/download.js"></script>
</body>
</html>`;

        write(filePath, html);
        count++;
        if (count % 500 === 0) log(`  ${count} icon pages generated...`);
    }

    log(`  Total icon pages: ${count}`);
}

// ─── Generate category pages ──────────────────────────────────────────────────

function generateCategoryPages(icons) {
    log('Generating category pages...');

    const categories = {};
    for (const icon of icons) {
        for (const cat of icon.categories) {
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(icon);
        }
    }

    for (const [cat, catIcons] of Object.entries(categories)) {
        const slug  = cat.toLowerCase().replace(/\s+/g, '-');
        const title = `Free ${cat} 3D Icons - PNG Download | Free3Dicons`;
        const desc  = `Download free ${cat} 3D icons in PNG format. ${catIcons.length} icons available in glossy, clay, flat and minimal styles.`;
        const url   = `${SITE}/category/${slug}/`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>${baseHead(title, desc, url)}</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="/">Free3Dicons</a>
    </div>
  </nav>
  <div class="container py-4">
    <h1 class="mb-1">Free ${escHtml(cat)} 3D Icons</h1>
    <p class="text-muted mb-4">${catIcons.length} icons available</p>
    <div class="row g-3" id="iconGrid">
      ${catIcons.map(icon => iconCard(icon)).join('')}
    </div>
  </div>
  <script src="/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

        write(path.join(OUTPUT, 'category', slug, 'index.html'), html);
    }

    log(`  Category pages: ${Object.keys(categories).length}`);
}

function iconCard(icon) {
    return `<div class="col-6 col-sm-4 col-md-3 col-lg-2">
  <a href="/icon/${escHtml(icon.slug)}/" class="text-decoration-none text-dark">
    <div class="card h-100 text-center p-2 icon-card">
      <img src="${escHtml(icon.preview_url)}" alt="${escHtml(icon.name)}"
           class="card-img-top" width="128" height="128" loading="lazy">
      <div class="card-body p-1">
        <p class="card-text small text-truncate">${escHtml(icon.name)}</p>
      </div>
    </div>
  </a>
</div>`;
}

function ucfirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Generate sitemaps ────────────────────────────────────────────────────────

function generateSitemaps(icons) {
    log('Generating sitemaps...');
    const CHUNK = 2500;
    const chunks = [];

    for (let i = 0; i < icons.length; i += CHUNK) {
        chunks.push(icons.slice(i, i + CHUNK));
    }

    // Icon sitemaps
    chunks.forEach((chunk, idx) => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.map(icon => `  <url>
    <loc>${SITE}/icon/${icon.slug}/</loc>
    <lastmod>${icon.date || new Date().toISOString().substring(0,10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;
        write(path.join(OUTPUT, `sitemap-icons-${idx + 1}.xml`), xml);
    });

    // Category sitemap
    const cats = [...new Set(icons.flatMap(i => i.categories))];
    const catXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${cats.map(c => `  <url>
    <loc>${SITE}/category/${c.toLowerCase().replace(/\s+/g,'-')}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;
    write(path.join(OUTPUT, 'sitemap-categories.xml'), catXml);

    // Sitemap index
    const now = new Date().toISOString().substring(0, 10);
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE}/sitemap-categories.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
${chunks.map((_, idx) => `  <sitemap>
    <loc>${SITE}/sitemap-icons-${idx + 1}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
    write(path.join(OUTPUT, 'sitemap-index.xml'), indexXml);

    log(`  Sitemaps: ${chunks.length} icon sitemaps + categories + index`);
}

// GitHub push is handled by the GitHub Actions workflow
// build.js only generates files — workflow commits and pushes
function pushToGitHub() {
    log('File generation complete. GitHub Actions will commit and push.');
    return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    log('═══ Build started ═══');
    log('Reason: ' + CONFIG.buildReason);

    try {
        mkdir(OUTPUT);
        mkdir(path.join(OUTPUT, 'data'));
        mkdir(path.join(OUTPUT, 'icon'));
        mkdir(path.join(OUTPUT, 'category'));
        mkdir(path.join(OUTPUT, 'tag'));
        mkdir(path.join(OUTPUT, 'pack'));

        const [icons, packs] = await Promise.all([
            fetchAllIcons(),
            fetchAllPacks(),
        ]);

        generateIconsJson(icons);
        generateIconPages(icons);
        generateCategoryPages(icons);
        generateSitemaps(icons);

        pushToGitHub();

        log('═══ Build complete ═══');
        log(`Icons: ${icons.length} | Packs: ${packs.length}`);

    } catch (err) {
        log('BUILD FAILED: ' + err.message);
        console.error(err);
        process.exit(1);
    }
}

main();
