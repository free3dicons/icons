/**
 * Free3Dicons — Frontend Search & Filter
 * Loads icons.json once, searches + filters client-side
 */

(function () {
  'use strict';

  let allIcons   = [];
  let fuse       = null;
  let activeFilters = { category: '', color: '', style: '', mood: '' };
  let searchQuery   = '';
  let searchTimer   = null;

  // ── Boot ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    loadIcons();
  });

  function loadIcons() {
    const grid = document.getElementById('f3dGrid');
    if (grid) grid.innerHTML = '<div class="f3d-empty"><div class="f3d-empty-icon">⏳</div><p>Loading icons...</p></div>';

    fetch('/data/icons.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        allIcons = data;
        initFuse();
        initFilters();
        renderIcons(allIcons);
        updateCount(allIcons.length);
        initSearch();
      })
      .catch(function (err) {
        console.error('Failed to load icons.json:', err);
        if (grid) grid.innerHTML = '<div class="f3d-empty"><div class="f3d-empty-icon">⚠️</div><h3>Could not load icons</h3><p>' + err.message + '</p></div>';
      });
  }

  // ── Fuse.js setup ─────────────────────────────────────────────────────────
  function initFuse() {
    fuse = new Fuse(allIcons, {
      keys: [
        { name: 'name',       weight: 0.5 },
        { name: 'tags',       weight: 0.35 },
        { name: 'categories', weight: 0.15 },
      ],
      threshold:      0.35,
      includeScore:   true,
      minMatchCharLength: 2,
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────
  function initSearch() {
    const input = document.getElementById('f3dSearch');
    const clear = document.getElementById('f3dSearchClear');
    if (!input) return;

    input.addEventListener('input', function () {
      searchQuery = this.value.trim();
      if (clear) clear.classList.toggle('visible', searchQuery.length > 0);

      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        applyFiltersAndSearch();
        // Track search query
        if (searchQuery.length >= 2) trackSearch(searchQuery);
      }, 250);
    });

    if (clear) {
      clear.addEventListener('click', function () {
        input.value   = '';
        searchQuery   = '';
        clear.classList.remove('visible');
        applyFiltersAndSearch();
      });
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  function initFilters() {
    document.querySelectorAll('.f3d-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const group = this.dataset.group;
        const value = this.dataset.value;

        // Toggle: click active button to clear that filter
        if (activeFilters[group] === value) {
          activeFilters[group] = '';
          this.classList.remove('active');
        } else {
          // Deactivate siblings in same group
          document.querySelectorAll('.f3d-filter-btn[data-group="' + group + '"]')
            .forEach(function (b) { b.classList.remove('active'); });
          activeFilters[group] = value;
          this.classList.add('active');
        }

        applyFiltersAndSearch();
      });
    });
  }

  // ── Apply search + filters together ───────────────────────────────────────
  function applyFiltersAndSearch() {
    let results = allIcons;

    // Text search via Fuse.js
    if (searchQuery.length >= 2 && fuse) {
      results = fuse.search(searchQuery).map(function (r) { return r.item; });
    }

    // Apply taxonomy filters on top of search results
    results = results.filter(function (icon) {
      if (activeFilters.category && !icon.categories.some(function (c) {
        return c.toLowerCase() === activeFilters.category.toLowerCase();
      })) return false;

      if (activeFilters.color && !icon.color_slugs.includes(activeFilters.color)) return false;
      if (activeFilters.style && !icon.style_slugs.includes(activeFilters.style)) return false;
      if (activeFilters.mood  && !icon.mood_slugs.includes(activeFilters.mood))   return false;

      return true;
    });

    renderIcons(results);
    updateCount(results.length);
  }

  // ── Render icon grid ──────────────────────────────────────────────────────
  function renderIcons(icons) {
    const grid = document.getElementById('f3dGrid');
    if (!grid) return;

    if (icons.length === 0) {
      grid.innerHTML = '<div class="f3d-empty">' +
        '<div class="f3d-empty-icon">🔍</div>' +
        '<h3>No icons found</h3>' +
        '<p>Try a different search term or clear some filters.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = icons.map(function (icon) {
      const cat  = icon.categories[0] || '';
      const style = icon.styles[0]    || '';
      return '<a href="' + icon.url + '" class="f3d-card" data-id="' + icon.id + '">' +
        '<div class="f3d-card-img-wrap">' +
          '<img src="' + escHtml(icon.preview_url) + '" ' +
               'alt="' + escHtml(icon.name) + '" ' +
               'width="128" height="128" loading="lazy" ' +
               'onerror="this.src=\'https://placehold.co/128x128/eee/999?text=Icon\'">' +
        '</div>' +
        '<div class="f3d-card-body">' +
          '<div class="f3d-card-name">' + escHtml(icon.name.replace(' 3D Icon', '')) + '</div>' +
          '<div class="f3d-card-meta">' + escHtml(cat) + (style ? ' · ' + escHtml(style) : '') + '</div>' +
        '</div>' +
        '</a>';
    }).join('');
  }

  // ── Update count display ──────────────────────────────────────────────────
  function updateCount(n) {
    const el = document.getElementById('f3dCount');
    if (el) el.textContent = n.toLocaleString();

    const hero = document.getElementById('f3dHeroCount');
    if (hero) hero.textContent = n.toLocaleString() + ' icons';
  }

  // ── Track search to WP backend ────────────────────────────────────────────
  function trackSearch(query) {
    const apiBase = (document.querySelector('meta[name="wp-api"]') || {}).content;
    if (!apiBase) return;
    fetch(apiBase + '/f3d/v1/search-analytics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: query, results_count: 0 }),
    }).catch(function () {});
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Expose for detail page
  window.f3dSearch = { allIcons: function () { return allIcons; } };
})();
