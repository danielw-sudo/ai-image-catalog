// ============================================
// AI Image Catalog - Script
// ============================================

var ENTRIES_FILE = 'entries.json';
var GITHUB_API = 'https://api.github.com';
var ENTRIES_PER_PAGE = 12;
var PROMPT_TRUNCATE_LENGTH = 200;

var PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
  '<rect width="800" height="600" fill="#f0f2f5"/>' +
  '<text x="400" y="290" text-anchor="middle" fill="#9ca3af" ' +
  'font-family="sans-serif" font-size="20">Image not available</text>' +
  '<text x="400" y="320" text-anchor="middle" fill="#c7c7cc" ' +
  'font-family="sans-serif" font-size="14">Check the URL or try refreshing</text>' +
  '</svg>'
);

// --- State ---
var allEntries = [];
var activeFilter = 'all';
var searchQuery = '';
var displayLimit = ENTRIES_PER_PAGE;
var editingSlug = null;
var pendingDeleteSlug = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', init);

function init() {
  setupEventListeners();
  setDefaultDate();
  loadSettingsIntoForm();
  updateConnectionStatus();
  loadDarkMode();
  loadCatalog();
}

// ============================================
// Settings (localStorage)
// ============================================

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('catalog-settings') || '{}');
  } catch (e) {
    return {};
  }
}

function persistSettings(settings) {
  localStorage.setItem('catalog-settings', JSON.stringify(settings));
}

function isGitHubConfigured() {
  var s = getSettings();
  return !!(s.owner && s.repo && s.token);
}

function loadSettingsIntoForm() {
  var s = getSettings();
  document.getElementById('settings-owner').value = s.owner || '';
  document.getElementById('settings-repo').value = s.repo || '';
  document.getElementById('settings-branch').value = s.branch || 'main';
  document.getElementById('settings-token').value = s.token || '';
  document.getElementById('settings-tagline').value = s.tagline || '';
  applyTagline();
}

function saveSettingsFromForm() {
  var settings = {
    owner: document.getElementById('settings-owner').value.trim(),
    repo: document.getElementById('settings-repo').value.trim(),
    branch: document.getElementById('settings-branch').value.trim() || 'main',
    token: document.getElementById('settings-token').value.trim(),
    tagline: document.getElementById('settings-tagline').value.trim()
  };
  persistSettings(settings);
  updateConnectionStatus();
  applyTagline();
  showToast('Settings saved');
}

function applyTagline() {
  var s = getSettings();
  var subtitle = document.querySelector('.subtitle');
  if (subtitle) {
    subtitle.textContent = s.tagline || 'Your AI Generation Log';
  }
}

function updateConnectionStatus() {
  var dot = document.getElementById('status-dot');
  var text = document.getElementById('status-text');
  var saveBtn = document.getElementById('github-save-btn');

  if (isGitHubConfigured()) {
    var s = getSettings();
    dot.className = 'status-dot connected';
    text.textContent = s.owner + '/' + s.repo;
    if (saveBtn) saveBtn.disabled = false;
  } else {
    dot.className = 'status-dot';
    text.textContent = 'Not connected';
    if (saveBtn) saveBtn.disabled = true;
  }
}

async function testConnection() {
  var s = getSettings();
  if (!s.owner || !s.repo || !s.token) {
    showToast('Fill in all settings fields first');
    return;
  }

  var testBtn = document.getElementById('test-conn-btn');
  testBtn.textContent = 'Testing...';
  testBtn.disabled = true;

  try {
    var response = await fetch(
      GITHUB_API + '/repos/' + s.owner + '/' + s.repo,
      { headers: { 'Authorization': 'token ' + s.token } }
    );

    if (response.ok) {
      var data = await response.json();
      showToast('Connected to ' + data.full_name);
      updateConnectionStatus();
    } else if (response.status === 401) {
      showToast('Invalid token. Check your Personal Access Token.');
    } else if (response.status === 404) {
      showToast('Repo not found. Check owner and repo name.');
    } else {
      showToast('Connection failed (HTTP ' + response.status + ')');
    }
  } catch (err) {
    showToast('Network error. Check your connection.');
  } finally {
    testBtn.textContent = 'Test Connection';
    testBtn.disabled = false;
  }
}

// ============================================
// Dark Mode
// ============================================

function loadDarkMode() {
  var saved = localStorage.getItem('catalog-dark-mode');
  if (saved === 'true') {
    document.body.classList.add('dark');
  }
  updateDarkModeIcon();
}

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  var isDark = document.body.classList.contains('dark');
  localStorage.setItem('catalog-dark-mode', isDark);
  updateDarkModeIcon();
}

function updateDarkModeIcon() {
  var btn = document.getElementById('dark-mode-toggle');
  var isDark = document.body.classList.contains('dark');
  // Sun icon for dark mode (click to go light), moon for light mode (click to go dark)
  btn.innerHTML = isDark
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

// ============================================
// Catalog Loading
// ============================================

async function loadCatalog() {
  var grid = document.getElementById('catalog-grid');

  try {
    var response = await fetch(ENTRIES_FILE);
    if (!response.ok) throw new Error('Could not load entries.json');

    allEntries = await response.json();
    buildTagFilters();
    renderCatalog(getFilteredEntries());
  } catch (err) {
    grid.innerHTML = '';
    document.getElementById('empty-state').style.display = 'none';

    var el = document.createElement('div');
    el.className = 'error-state';
    el.innerHTML =
      '<h3>Could not load catalog</h3>' +
      '<p>If you opened this file directly, you need a local server. Run:</p>' +
      '<code>npx serve .</code>' +
      '<p style="margin-top:0.75rem">Or with Python:</p>' +
      '<code>python -m http.server 8000</code>';
    grid.parentNode.insertBefore(el, grid.nextSibling);
  }
}

// ============================================
// Rendering
// ============================================

function renderCatalog(entries) {
  var grid = document.getElementById('catalog-grid');
  var empty = document.getElementById('empty-state');

  if (entries.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    updateEntryCount(0);
    updatePagination(0, 0);
    return;
  }

  empty.style.display = 'none';

  var visible = entries.slice(0, displayLimit);
  grid.innerHTML = visible.map(createCardHTML).join('');

  updateEntryCount(allEntries.length);
  updatePagination(visible.length, entries.length);
}

function createCardHTML(entry) {
  var platformClass = getPlatformClass(entry.platform);
  var slug = entry.slug;

  var tagsHTML = entry.tags
    ? entry.tags.split(',').map(function(t) {
        var trimmed = t.trim();
        return trimmed ? '<span class="tag">' + escapeHTML(trimmed) + '</span>' : '';
      }).join('')
    : '';

  // Prompt truncation
  var isTruncated = entry.prompt.length > PROMPT_TRUNCATE_LENGTH;
  var displayPrompt = isTruncated
    ? entry.prompt.substring(0, PROMPT_TRUNCATE_LENGTH) + '...'
    : entry.prompt;

  var promptToggle = isTruncated
    ? '<button class="prompt-toggle" onclick="togglePrompt(\'' + escapeAttr(slug) + '\')">Show more</button>'
    : '';

  return (
    '<article class="card" id="card-' + escapeAttr(slug) + '">' +
      '<a class="card-image-link" href="' + escapeAttr(entry.imageUrl) + '" target="_blank" rel="noopener">' +
        '<img class="card-image" src="' + escapeAttr(entry.imageUrl) + '" alt="' + escapeAttr(entry.title) + '" loading="lazy" onerror="handleImageError(this)">' +
      '</a>' +
      '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHTML(entry.title) + '</h3>' +
        '<div class="card-meta">' +
          (entry.platform ? '<span class="platform-badge ' + platformClass + '">' + escapeHTML(entry.platform) + '</span>' : '') +
          (entry.date ? '<span class="card-date">' + escapeHTML(entry.date) + '</span>' : '') +
          '<div class="card-meta-actions">' +
            '<button class="prompt-copy" onclick="copyPrompt(\'' + escapeAttr(slug) + '\')">Copy prompt</button>' +
            '<button class="card-edit-btn" onclick="editEntry(\'' + escapeAttr(slug) + '\')">Edit</button>' +
            '<button class="share-btn" onclick="shareEntry(\'' + escapeAttr(slug) + '\')" title="Share on X/Twitter">Share</button>' +
          '</div>' +
        '</div>' +
        (tagsHTML ? '<div class="card-tags">' + tagsHTML + '</div>' : '') +
        (entry.prompt ? (
          '<div class="card-prompt">' +
            '<div class="prompt-text" id="prompt-' + escapeAttr(slug) + '" data-full="' + escapeAttr(entry.prompt) + '" data-truncated="' + escapeAttr(displayPrompt) + '" data-expanded="false">' +
              escapeHTML(displayPrompt) +
            '</div>' +
            (isTruncated ? '<div class="prompt-actions">' + promptToggle + '</div>' : '') +
          '</div>'
        ) : '') +
      '</div>' +
    '</article>'
  );
}

function getPlatformClass(platform) {
  if (!platform) return 'other';
  var p = platform.toLowerCase();
  if (p.includes('gemini'))     return 'gemini';
  if (p.includes('grok'))       return 'grok';
  if (p.includes('meta'))       return 'meta-ai';
  if (p.includes('chatgpt') || p.includes('dall')) return 'chatgpt';
  if (p.includes('midjourney')) return 'midjourney';
  return 'other';
}

function updateEntryCount(count) {
  var el = document.getElementById('entry-count');
  el.textContent = count + (count === 1 ? ' entry' : ' entries');
}

// ============================================
// Pagination
// ============================================

function updatePagination(showing, total) {
  var section = document.getElementById('load-more-section');
  var countEl = document.getElementById('showing-count');
  var btn = document.getElementById('load-more-btn');

  if (total === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'flex';
  countEl.textContent = 'Showing ' + showing + ' of ' + total + ' entries';

  if (showing >= total) {
    btn.style.display = 'none';
  } else {
    btn.style.display = 'inline-block';
    btn.textContent = 'Load More';
  }
}

function loadMore() {
  displayLimit += ENTRIES_PER_PAGE;
  renderCatalog(getFilteredEntries());
}

// ============================================
// Filtering & Search
// ============================================

function getFilteredEntries() {
  // Reverse so newest entries appear first
  var filtered = allEntries.slice().reverse();

  if (activeFilter !== 'all') {
    filtered = filtered.filter(function(e) {
      if (!e.tags) return false;
      var tags = e.tags.split(',').map(function(t) { return t.trim().toLowerCase(); });
      return tags.indexOf(activeFilter.toLowerCase()) >= 0;
    });
  }

  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    filtered = filtered.filter(function(e) {
      return (
        e.title.toLowerCase().includes(q) ||
        e.prompt.toLowerCase().includes(q) ||
        (e.tags && e.tags.toLowerCase().includes(q)) ||
        e.platform.toLowerCase().includes(q)
      );
    });
  }

  return filtered;
}

function filterEntries() {
  displayLimit = ENTRIES_PER_PAGE;
  renderCatalog(getFilteredEntries());
}

// ============================================
// Tag Filters
// ============================================

var FALLBACK_TAGS = ['Beauty', 'Cutie', 'Scenery'];

function getTopTags(entries, count) {
  var freq = {};
  entries.forEach(function(e) {
    if (!e.tags) return;
    e.tags.split(',').forEach(function(t) {
      var tag = t.trim();
      if (!tag) return;
      var key = tag.toLowerCase();
      if (!freq[key]) freq[key] = { name: tag, count: 0 };
      freq[key].count++;
    });
  });

  var sorted = Object.keys(freq).sort(function(a, b) {
    return freq[b].count - freq[a].count;
  });

  if (sorted.length < count) {
    return FALLBACK_TAGS;
  }

  return sorted.slice(0, count).map(function(key) {
    return freq[key].name;
  });
}

function buildTagFilters() {
  var container = document.getElementById('tag-filters');
  var topTags = getTopTags(allEntries, 3);

  var html = '<span class="filter-label">Tags:</span>';
  html += '<button class="filter-btn' + (activeFilter === 'all' ? ' active' : '') + '" data-tag="all">All</button>';
  topTags.forEach(function(tag) {
    var isActive = activeFilter.toLowerCase() === tag.toLowerCase();
    html += '<button class="filter-btn' + (isActive ? ' active' : '') + '" data-tag="' + escapeAttr(tag) + '">' + escapeHTML(tag) + '</button>';
  });

  container.innerHTML = html;

  // Attach click handlers
  container.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-tag');
      filterEntries();
    });
  });
}

// ============================================
// Prompt: Truncation, Expand, Copy
// ============================================

function togglePrompt(slug) {
  var el = document.getElementById('prompt-' + slug);
  if (!el) return;

  var expanded = el.getAttribute('data-expanded') === 'true';
  var btn = el.parentNode.querySelector('.prompt-toggle');

  if (expanded) {
    el.textContent = el.getAttribute('data-truncated');
    el.setAttribute('data-expanded', 'false');
    if (btn) btn.textContent = 'Show more';
  } else {
    el.textContent = el.getAttribute('data-full');
    el.setAttribute('data-expanded', 'true');
    if (btn) btn.textContent = 'Show less';
  }
}

function copyPrompt(slug) {
  var el = document.getElementById('prompt-' + slug);
  if (!el) return;

  var fullPrompt = el.getAttribute('data-full');
  copyToClipboard(fullPrompt);
  showToast('Prompt copied to clipboard');
}

// ============================================
// Share
// ============================================

function shareEntry(slug) {
  var entry = allEntries.find(function(e) { return e.slug === slug; });
  if (!entry) return;

  var platformTag = entry.platform.replace(/[\s\/]+/g, '');
  var text = 'Check out this AI-generated image: ' + entry.title + '\n\n' +
    'Created with ' + entry.platform + '\n\n' +
    entry.imageUrl + '\n' +
    '#AIArt #' + platformTag;

  var url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  window.open(url, '_blank', 'width=550,height=420');
}

// ============================================
// Form - Build Entry from Fields
// ============================================

function buildEntryFromForm() {
  var title    = document.getElementById('entry-title').value.trim();
  var platform = document.getElementById('entry-platform').value;
  var imageUrl = document.getElementById('entry-image').value.trim();
  var date     = document.getElementById('entry-date').value;
  var tags     = document.getElementById('entry-tags').value.trim();
  var prompt   = document.getElementById('entry-prompt').value.trim();

  if (!title || !platform || !imageUrl || !prompt) {
    showToast('Please fill in all required fields');
    return null;
  }

  return {
    slug: slugify(title),
    title: title,
    imageUrl: imageUrl,
    platform: platform,
    date: date,
    tags: tags,
    prompt: prompt
  };
}

function generateEntryMarkdown(entry) {
  var promptLines = wrapText(entry.prompt, 72);
  var promptBlock = promptLines.map(function(l) { return '> ' + l; }).join('\n');

  var md = '### ' + entry.title + '\n\n';
  md += '![' + entry.title + '](' + entry.imageUrl + ')\n\n';
  md += '- **Platform:** ' + entry.platform + '\n';
  md += '- **Date:** ' + entry.date + '\n';
  if (entry.tags) {
    md += '- **Tags:** ' + entry.tags + '\n';
  }
  md += '\n' + promptBlock + '\n';
  return md;
}

function clearForm() {
  document.getElementById('entry-title').value = '';
  document.getElementById('entry-platform').value = '';
  document.getElementById('entry-image').value = '';
  document.getElementById('entry-tags').value = '';
  document.getElementById('entry-prompt').value = '';
  document.getElementById('markdown-output').classList.remove('visible');
  setDefaultDate();
}

// ============================================
// Edit Entry
// ============================================

function editEntry(slug) {
  if (!isGitHubConfigured()) {
    showToast('Connect GitHub in Settings to edit entries');
    return;
  }

  var entry = allEntries.find(function(e) { return e.slug === slug; });
  if (!entry) return;

  editingSlug = slug;

  // Populate form
  document.getElementById('entry-title').value = entry.title;
  document.getElementById('entry-platform').value = entry.platform;
  document.getElementById('entry-image').value = entry.imageUrl;
  document.getElementById('entry-date').value = entry.date;
  document.getElementById('entry-tags').value = entry.tags || '';
  document.getElementById('entry-prompt').value = entry.prompt;

  // Update form UI for edit mode
  document.getElementById('form-heading').textContent = 'Edit Entry';
  document.getElementById('github-save-btn').textContent = 'Update on GitHub';
  document.getElementById('form-delete-btn').style.display = 'inline-block';
  document.getElementById('form-panel').classList.add('open');
  document.getElementById('markdown-output').classList.remove('visible');

  // Scroll to form
  document.getElementById('form-panel').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editingSlug = null;
  document.getElementById('form-heading').textContent = 'Add New Entry';
  document.getElementById('github-save-btn').textContent = 'Save to GitHub';
  document.getElementById('form-delete-btn').style.display = 'none';
  clearForm();
}

function deleteFromForm() {
  if (!editingSlug) return;
  confirmDelete(editingSlug);
}

// ============================================
// GitHub API - Save (Create & Edit)
// ============================================

async function saveToGitHub() {
  var entry = buildEntryFromForm();
  if (!entry) return;

  if (!isGitHubConfigured()) {
    showToast('Set up GitHub in Settings first');
    return;
  }

  var s = getSettings();
  var btn = document.getElementById('github-save-btn');
  var originalText = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;

  var headers = {
    'Authorization': 'token ' + s.token,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    if (editingSlug) {
      await updateEntryOnGitHub(entry, headers, s);
    } else {
      await createEntryOnGitHub(entry, headers, s);
    }

    // Reset UI
    activeFilter = 'all';
    searchQuery = '';
    displayLimit = ENTRIES_PER_PAGE;
    document.getElementById('search').value = '';
    buildTagFilters();
    renderCatalog(getFilteredEntries());

    cancelEdit();
    document.getElementById('form-panel').classList.remove('open');
    showToast(editingSlug ? 'Updated on GitHub!' : 'Saved to GitHub! Site updates in ~30s.');

  } catch (err) {
    showToast('Save failed: ' + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    editingSlug = null;
    document.getElementById('form-heading').textContent = 'Add New Entry';
    document.getElementById('github-save-btn').textContent = 'Save to GitHub';
  }
}

async function createEntryOnGitHub(entry, headers, s) {
  // Step 1: Create the .md file
  var mdContent = generateEntryMarkdown(entry);
  var mdPath = 'entries/' + entry.slug + '.md';
  await githubCreateFile(s, headers, mdPath, mdContent, 'Add entry: ' + entry.title);

  // Step 2: Update entries.json
  var indexData = await githubGetFile(s, headers, 'entries.json');
  var currentEntries = JSON.parse(fromBase64(indexData.content));
  currentEntries.push(entry);

  var updatedContent = JSON.stringify(currentEntries, null, 2) + '\n';
  await githubUpdateFile(s, headers, 'entries.json', updatedContent, indexData.sha, 'Update index: add ' + entry.title);

  // Update local state
  allEntries.push(entry);
}

async function updateEntryOnGitHub(entry, headers, s) {
  var oldSlug = editingSlug;
  var newSlug = entry.slug;
  var slugChanged = oldSlug !== newSlug;

  // Step 1: Create/update the new .md file
  var mdContent = generateEntryMarkdown(entry);
  await githubCreateFile(s, headers, 'entries/' + newSlug + '.md', mdContent, 'Update entry: ' + entry.title);

  // Step 2: If slug changed, delete the old .md file
  if (slugChanged) {
    try {
      await githubDeleteFile(s, headers, 'entries/' + oldSlug + '.md', 'Rename entry: ' + oldSlug + ' -> ' + newSlug);
    } catch (e) {
      // Old file might not exist, continue
    }
  }

  // Step 3: Update entries.json
  var indexData = await githubGetFile(s, headers, 'entries.json');
  var currentEntries = JSON.parse(fromBase64(indexData.content));

  var idx = currentEntries.findIndex(function(e) { return e.slug === oldSlug; });
  if (idx >= 0) {
    currentEntries[idx] = entry;
  } else {
    currentEntries.push(entry);
  }

  var updatedContent = JSON.stringify(currentEntries, null, 2) + '\n';
  await githubUpdateFile(s, headers, 'entries.json', updatedContent, indexData.sha, 'Update index: edit ' + entry.title);

  // Update local state
  var localIdx = allEntries.findIndex(function(e) { return e.slug === oldSlug; });
  if (localIdx >= 0) {
    allEntries[localIdx] = entry;
  }
}

// ============================================
// GitHub API - Delete
// ============================================

function confirmDelete(slug) {
  if (!isGitHubConfigured()) {
    showToast('Connect GitHub in Settings to delete entries');
    return;
  }

  var entry = allEntries.find(function(e) { return e.slug === slug; });
  if (!entry) return;

  pendingDeleteSlug = slug;
  document.getElementById('modal-title').textContent = 'Delete Entry';
  document.getElementById('modal-message').textContent = 'Delete "' + entry.title + '"? This cannot be undone.';
  document.getElementById('modal-overlay').style.display = 'flex';
}

async function executeDelete() {
  var slug = pendingDeleteSlug;
  if (!slug) return;

  hideModal();

  var entry = allEntries.find(function(e) { return e.slug === slug; });
  if (!entry) return;

  var s = getSettings();
  var headers = {
    'Authorization': 'token ' + s.token,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    // Step 1: Delete the .md file
    await githubDeleteFile(s, headers, 'entries/' + slug + '.md', 'Delete entry: ' + entry.title);

    // Step 2: Update entries.json
    var indexData = await githubGetFile(s, headers, 'entries.json');
    var currentEntries = JSON.parse(fromBase64(indexData.content));
    currentEntries = currentEntries.filter(function(e) { return e.slug !== slug; });

    var updatedContent = JSON.stringify(currentEntries, null, 2) + '\n';
    await githubUpdateFile(s, headers, 'entries.json', updatedContent, indexData.sha, 'Update index: remove ' + entry.title);

    // Update local state
    allEntries = allEntries.filter(function(e) { return e.slug !== slug; });
    renderCatalog(getFilteredEntries());

    // Close form if we deleted from edit mode
    if (editingSlug === slug) {
      cancelEdit();
      document.getElementById('form-panel').classList.remove('open');
    }

    showToast('Deleted "' + entry.title + '"');

  } catch (err) {
    showToast('Delete failed: ' + err.message);
  }
}

function hideModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  pendingDeleteSlug = null;
}

// ============================================
// GitHub API - Low Level
// ============================================

async function githubGetFile(settings, headers, path) {
  var response = await fetch(
    GITHUB_API + '/repos/' + settings.owner + '/' + settings.repo +
    '/contents/' + path + '?ref=' + settings.branch,
    { headers: headers }
  );
  if (!response.ok) {
    throw new Error('Could not read ' + path + ' (HTTP ' + response.status + ')');
  }
  return response.json();
}

async function githubCreateFile(settings, headers, path, content, message) {
  // Check if file exists to get SHA
  var sha = null;
  try {
    var existing = await githubGetFile(settings, headers, path);
    sha = existing.sha;
  } catch (e) {
    // File doesn't exist, that's fine
  }

  var body = {
    message: message,
    content: toBase64(content),
    branch: settings.branch
  };
  if (sha) body.sha = sha;

  var response = await fetch(
    GITHUB_API + '/repos/' + settings.owner + '/' + settings.repo + '/contents/' + path,
    { method: 'PUT', headers: headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    var errData = await response.json().catch(function() { return {}; });
    throw new Error(errData.message || 'Failed to create ' + path);
  }

  return response.json();
}

async function githubUpdateFile(settings, headers, path, content, sha, message) {
  var response = await fetch(
    GITHUB_API + '/repos/' + settings.owner + '/' + settings.repo + '/contents/' + path,
    {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify({
        message: message,
        content: toBase64(content),
        sha: sha,
        branch: settings.branch
      })
    }
  );

  if (!response.ok) {
    var errData = await response.json().catch(function() { return {}; });
    throw new Error(errData.message || 'Failed to update ' + path);
  }

  return response.json();
}

async function githubDeleteFile(settings, headers, path, message) {
  var fileData = await githubGetFile(settings, headers, path);

  var response = await fetch(
    GITHUB_API + '/repos/' + settings.owner + '/' + settings.repo + '/contents/' + path,
    {
      method: 'DELETE',
      headers: headers,
      body: JSON.stringify({
        message: message,
        sha: fileData.sha,
        branch: settings.branch
      })
    }
  );

  if (!response.ok) {
    var errData = await response.json().catch(function() { return {}; });
    throw new Error(errData.message || 'Failed to delete ' + path);
  }
}

// ============================================
// Download Fallback
// ============================================

function downloadEntry() {
  var entry = buildEntryFromForm();
  if (!entry) return;

  var md = generateEntryMarkdown(entry);
  downloadFile(entry.slug + '.md', md, 'text/markdown');

  var updated = allEntries.slice();
  updated.push(entry);
  var json = JSON.stringify(updated, null, 2) + '\n';
  downloadFile('entries.json', json, 'application/json');

  showToast('Downloaded 2 files. Drop them into your project folder.');
}

function downloadFile(filename, content, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// Copy Markdown & Toggle Panels
// ============================================

function toggleForm() {
  var panel = document.getElementById('form-panel');
  if (panel.classList.contains('open') && editingSlug) {
    cancelEdit();
  }
  panel.classList.toggle('open');
}

function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('open');
}

function previewMarkdown() {
  var entry = buildEntryFromForm();
  if (!entry) return;

  var md = generateEntryMarkdown(entry);
  var output = document.getElementById('markdown-output');
  var preview = document.getElementById('md-preview');
  preview.textContent = md;
  output.classList.add('visible');
}

async function copyMarkdown() {
  var entry = buildEntryFromForm();
  if (!entry) return;

  var md = generateEntryMarkdown(entry);
  var output = document.getElementById('markdown-output');
  var preview = document.getElementById('md-preview');
  preview.textContent = md;
  output.classList.add('visible');

  await copyToClipboard(md);
  showToast('Markdown copied to clipboard');
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
  // Toggle panels
  document.getElementById('toggle-form').addEventListener('click', toggleForm);
  document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);

  // Search
  document.getElementById('search').addEventListener('input', function(e) {
    searchQuery = e.target.value;
    filterEntries();
  });

  // Form buttons
  document.getElementById('preview-btn').addEventListener('click', previewMarkdown);
  document.getElementById('copy-btn').addEventListener('click', copyMarkdown);
  document.getElementById('github-save-btn').addEventListener('click', saveToGitHub);
  document.getElementById('download-btn').addEventListener('click', downloadEntry);
  document.getElementById('form-delete-btn').addEventListener('click', deleteFromForm);
  document.getElementById('copy-again-btn').addEventListener('click', function() {
    var md = document.getElementById('md-preview').textContent;
    copyToClipboard(md);
    showToast('Copied again!');
  });

  // Settings buttons
  document.getElementById('save-settings-btn').addEventListener('click', saveSettingsFromForm);
  document.getElementById('test-conn-btn').addEventListener('click', testConnection);

  // Load more
  document.getElementById('load-more-btn').addEventListener('click', loadMore);

  // Modal
  document.getElementById('modal-confirm').addEventListener('click', executeDelete);
  document.getElementById('modal-cancel').addEventListener('click', hideModal);
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) hideModal();
  });
}

// ============================================
// Utilities
// ============================================

function setDefaultDate() {
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('entry-date').value = today;
}

function handleImageError(img) {
  img.onerror = null;
  img.src = PLACEHOLDER_IMAGE;
}

function showToast(message) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(function() {
    toast.classList.remove('show');
  }, 3000);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function wrapText(text, maxLen) {
  var words = text.split(/\s+/);
  var lines = [];
  var current = '';
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (current && (current.length + 1 + word.length > maxLen)) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function fromBase64(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
