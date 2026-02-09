// ============================================
// AI Image Catalog - Script
// ============================================

var ENTRIES_FILE = 'entries.json';
var GITHUB_API = 'https://api.github.com';

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

// --- Init ---
document.addEventListener('DOMContentLoaded', init);

function init() {
  setupEventListeners();
  setDefaultDate();
  loadSettingsIntoForm();
  updateConnectionStatus();
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
}

function saveSettingsFromForm() {
  var settings = {
    owner: document.getElementById('settings-owner').value.trim(),
    repo: document.getElementById('settings-repo').value.trim(),
    branch: document.getElementById('settings-branch').value.trim() || 'main',
    token: document.getElementById('settings-token').value.trim()
  };
  persistSettings(settings);
  updateConnectionStatus();
  showToast('Settings saved');
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
// Catalog Loading
// ============================================

async function loadCatalog() {
  var grid = document.getElementById('catalog-grid');

  try {
    var response = await fetch(ENTRIES_FILE);
    if (!response.ok) throw new Error('Could not load entries.json');

    allEntries = await response.json();
    renderCatalog(allEntries);
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
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = entries.map(createCardHTML).join('');
  updateEntryCount(entries.length);
}

function createCardHTML(entry) {
  var platformClass = getPlatformClass(entry.platform);
  var tagsHTML = entry.tags
    ? entry.tags.split(',').map(function(t) {
        return '<span class="tag">' + escapeHTML(t.trim()) + '</span>';
      }).join('')
    : '';

  return (
    '<article class="card">' +
      '<a class="card-image-link" href="' + escapeAttr(entry.imageUrl) + '" target="_blank" rel="noopener">' +
        '<img class="card-image" src="' + escapeAttr(entry.imageUrl) + '" alt="' + escapeAttr(entry.title) + '" loading="lazy" onerror="handleImageError(this)">' +
      '</a>' +
      '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHTML(entry.title) + '</h3>' +
        '<div class="card-meta">' +
          (entry.platform ? '<span class="platform-badge ' + platformClass + '">' + escapeHTML(entry.platform) + '</span>' : '') +
          (entry.date ? '<span class="card-date">' + escapeHTML(entry.date) + '</span>' : '') +
        '</div>' +
        (tagsHTML ? '<div class="card-tags">' + tagsHTML + '</div>' : '') +
        (entry.prompt ? '<div class="card-prompt">' + escapeHTML(entry.prompt) + '</div>' : '') +
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
// Filtering & Search
// ============================================

function filterEntries() {
  var filtered = allEntries;

  if (activeFilter !== 'all') {
    filtered = filtered.filter(function(e) {
      return e.platform.toLowerCase().includes(activeFilter.toLowerCase());
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

  renderCatalog(filtered);
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
// GitHub API - Save
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
  btn.textContent = 'Saving...';
  btn.disabled = true;

  var headers = {
    'Authorization': 'token ' + s.token,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    // Step 1: Create the individual .md file
    var mdContent = generateEntryMarkdown(entry);
    var mdPath = 'entries/' + entry.slug + '.md';

    await githubCreateFile(s, headers, mdPath, mdContent, 'Add entry: ' + entry.title);

    // Step 2: Update entries.json (fetch current, append, push)
    var indexResult = await fetch(
      GITHUB_API + '/repos/' + s.owner + '/' + s.repo + '/contents/entries.json?ref=' + s.branch,
      { headers: headers }
    );

    if (!indexResult.ok) {
      throw new Error('Could not read entries.json from repo (HTTP ' + indexResult.status + ')');
    }

    var indexData = await indexResult.json();
    var currentEntries = JSON.parse(fromBase64(indexData.content));
    currentEntries.push(entry);

    var updatedContent = JSON.stringify(currentEntries, null, 2) + '\n';

    await fetch(
      GITHUB_API + '/repos/' + s.owner + '/' + s.repo + '/contents/entries.json',
      {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          message: 'Update index: add ' + entry.title,
          content: toBase64(updatedContent),
          sha: indexData.sha,
          branch: s.branch
        })
      }
    );

    // Step 3: Update local state immediately
    allEntries.push(entry);
    activeFilter = 'all';
    searchQuery = '';
    document.getElementById('search').value = '';
    document.querySelectorAll('.filter-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-platform') === 'all');
    });
    renderCatalog(allEntries);

    clearForm();
    document.getElementById('form-panel').classList.remove('open');
    showToast('Saved to GitHub! Site updates in ~30s.');

  } catch (err) {
    showToast('Save failed: ' + err.message);
  } finally {
    btn.textContent = 'Save to GitHub';
    btn.disabled = false;
  }
}

async function githubCreateFile(settings, headers, path, content, message) {
  // Check if file already exists (to get SHA for update)
  var sha = null;
  try {
    var existing = await fetch(
      GITHUB_API + '/repos/' + settings.owner + '/' + settings.repo +
      '/contents/' + path + '?ref=' + settings.branch,
      { headers: headers }
    );
    if (existing.ok) {
      var data = await existing.json();
      sha = data.sha;
    }
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

// ============================================
// Download Fallback
// ============================================

function downloadEntry() {
  var entry = buildEntryFromForm();
  if (!entry) return;

  var md = generateEntryMarkdown(entry);

  // Download the .md file
  downloadFile(entry.slug + '.md', md, 'text/markdown');

  // Update entries.json and download it
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
// Copy Markdown (still available)
// ============================================

function toggleForm() {
  document.getElementById('form-panel').classList.toggle('open');
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

  // Search
  document.getElementById('search').addEventListener('input', function(e) {
    searchQuery = e.target.value;
    filterEntries();
  });

  // Platform filter buttons
  var filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-platform');
      filterEntries();
    });
  });

  // Form buttons
  document.getElementById('preview-btn').addEventListener('click', previewMarkdown);
  document.getElementById('copy-btn').addEventListener('click', copyMarkdown);
  document.getElementById('github-save-btn').addEventListener('click', saveToGitHub);
  document.getElementById('download-btn').addEventListener('click', downloadEntry);
  document.getElementById('copy-again-btn').addEventListener('click', function() {
    var md = document.getElementById('md-preview').textContent;
    copyToClipboard(md);
    showToast('Copied again!');
  });

  // Settings buttons
  document.getElementById('save-settings-btn').addEventListener('click', saveSettingsFromForm);
  document.getElementById('test-conn-btn').addEventListener('click', testConnection);
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
