// ============================================
// MEDIAFIRE SCRAPER — FRONTEND SCRIPT
// by ryaakbar
// ============================================

'use strict';

// ── STATE ─────────────────────────────────────
const STORAGE_KEY = 'mfscraper_history';
let currentResult = null;
let toastTimer    = null;

// ── FILE TYPE CONFIG ──────────────────────────
const FILE_ICONS = {
    ZIP: 'fa-file-zipper',   RAR: 'fa-file-zipper',   '7Z': 'fa-file-zipper',
    PDF: 'fa-file-pdf',      DOC: 'fa-file-word',      DOCX: 'fa-file-word',
    XLS: 'fa-file-excel',    XLSX: 'fa-file-excel',    PPT: 'fa-file-powerpoint', PPTX: 'fa-file-powerpoint',
    MP4: 'fa-file-video',    MKV: 'fa-file-video',     AVI: 'fa-file-video',      MOV: 'fa-file-video',
    MP3: 'fa-file-audio',    WAV: 'fa-file-audio',     FLAC: 'fa-file-audio',
    JPG: 'fa-file-image',    JPEG: 'fa-file-image',    PNG: 'fa-file-image',      GIF: 'fa-file-image',
    EXE: 'fa-file-code',     APK: 'fa-file-code',      DMG: 'fa-file-code',
    TXT: 'fa-file-lines',    CSV: 'fa-file-csv',       JSON: 'fa-file-code',
};

const FILE_COLORS = {
    ZIP: '#fbbf24', RAR: '#fbbf24', '7Z': '#fbbf24',
    PDF: '#f87171',
    DOC: '#60a5fa', DOCX: '#60a5fa',
    XLS: '#4ade80', XLSX: '#4ade80',
    MP4: '#a78bfa', MKV: '#a78bfa', AVI: '#a78bfa',
    MP3: '#fb923c', WAV: '#fb923c', FLAC: '#fb923c',
    JPG: '#34d399', PNG: '#34d399',
    EXE: '#f43f5e', APK: '#f43f5e',
};

function getFileIcon(type) {
    return FILE_ICONS[type?.toUpperCase()] || 'fa-file';
}
function getFileColor(type) {
    return FILE_COLORS[type?.toUpperCase()] || '#60a5fa';
}

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('urlInput');

    // URL input listener
    input.addEventListener('input', () => {
        const val = input.value.trim();
        const clearBtn = document.getElementById('urlClear');
        const validator = document.getElementById('urlValidator');
        clearBtn.style.display = val ? 'block' : 'none';
        if (!val) { validator.textContent = ''; return; }
        const valid = isValidMF(val);
        validator.textContent = valid ? '✓ URL Valid' : '✗ Bukan URL MediaFire';
        validator.className   = 'url-validator ' + (valid ? 'valid' : 'invalid');
    });

    // Enter key
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') scrapeURL();
    });

    // Load history & analytics
    renderHistory();
    renderAnalytics();
});

// ── VALIDATION ────────────────────────────────
function isValidMF(url) {
    try {
        const u = new URL(url);
        return u.hostname.includes('mediafire.com');
    } catch { return false; }
}

// ── SCRAPE ────────────────────────────────────
async function scrapeURL() {
    const input = document.getElementById('urlInput');
    const url   = input.value.trim();

    if (!url) {
        showToast('⚠️ Masukkan URL MediaFire dulu!', 'error');
        input.focus();
        return;
    }
    if (!isValidMF(url)) {
        showToast('❌ URL tidak valid. Gunakan link MediaFire.', 'error');
        return;
    }

    // UI: loading
    setSection('loading');
    setBtnLoading(true);

    try {
        const res  = await fetch('/api/scrape', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ url }),
        });
        const json = await res.json();

        if (!json.success) throw new Error(json.error || 'Scrape gagal.');

        currentResult = json.data;
        renderResult(json.data);
        addToHistory(json.data, url);
        renderAnalytics();
        showToast('✅ Berhasil discrape!', 'success');

    } catch (err) {
        setSection('error');
        document.getElementById('errorMsg').textContent = err.message;
        showToast('❌ ' + err.message, 'error');
    } finally {
        setBtnLoading(false);
    }
}

// ── RENDER RESULT ─────────────────────────────
function renderResult(data) {
    const color = getFileColor(data.filetype);
    const icon  = getFileIcon(data.filetype);

    // File icon
    const fileIcon = document.getElementById('resultFileIcon');
    fileIcon.style.background = `${color}20`;
    fileIcon.style.color      = color;
    fileIcon.style.borderColor = `${color}50`;
    fileIcon.innerHTML = `<i class="fas ${icon}"></i>`;

    // Text fields
    document.getElementById('resultFilename').textContent   = data.filename || 'Unknown';
    document.getElementById('resultUrlPreview').textContent = new URL(data.source_url).hostname + '/...';
    document.getElementById('metaSize').textContent  = data.filesize    || '—';
    document.getElementById('metaType').textContent  = data.filetype    || '—';
    document.getElementById('metaDate').textContent  = data.upload_date || '—';
    document.getElementById('metaTime').textContent  = fmtTime(data.scraped_at);
    document.getElementById('linkBoxUrl').textContent = data.link;

    // Download button
    const dlBtn = document.getElementById('downloadBtn');
    dlBtn.href = data.link;

    setSection('result');
}

// ── COPY LINK ─────────────────────────────────
async function copyLink() {
    if (!currentResult?.link) return;
    try {
        await navigator.clipboard.writeText(currentResult.link);
        const icon = document.getElementById('copyIcon');
        const text = document.getElementById('copyText');
        icon.className = 'fas fa-check';
        text.textContent = 'Tersalin!';
        showToast('📋 Link disalin ke clipboard!', 'success');
        setTimeout(() => {
            icon.className = 'fas fa-copy';
            text.textContent = 'Copy Link';
        }, 2000);
    } catch {
        showToast('❌ Gagal menyalin.', 'error');
    }
}

// ── SHARE ─────────────────────────────────────
async function shareLink() {
    if (!currentResult?.link) return;
    if (navigator.share) {
        try {
            await navigator.share({
                title: currentResult.filename,
                text:  `Download: ${currentResult.filename} (${currentResult.filesize})`,
                url:   currentResult.link,
            });
        } catch {}
    } else {
        copyLink();
    }
}

// ── RESET ─────────────────────────────────────
function resetScraper() {
    currentResult = null;
    document.getElementById('urlInput').value = '';
    document.getElementById('urlClear').style.display = 'none';
    document.getElementById('urlValidator').textContent = '';
    setSection('none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearInput() {
    const input = document.getElementById('urlInput');
    input.value = '';
    document.getElementById('urlClear').style.display = 'none';
    document.getElementById('urlValidator').textContent = '';
    input.focus();
}

// ── HISTORY ───────────────────────────────────
function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
}

function addToHistory(data, url) {
    let hist = getHistory();
    // Remove duplicate
    hist = hist.filter(h => h.source_url !== url);
    hist.unshift({
        filename:    data.filename,
        filetype:    data.filetype,
        filesize:    data.filesize,
        sizeBytes:   data.sizeBytes || 0,
        link:        data.link,
        source_url:  url,
        scraped_at:  data.scraped_at,
    });
    if (hist.length > 50) hist = hist.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
    renderHistory();
}

function deleteHistory(idx) {
    let hist = getHistory();
    hist.splice(idx, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hist));
    renderHistory();
    renderAnalytics();
    showToast('🗑️ Dihapus dari riwayat', '');
}

function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    renderAnalytics();
    showToast('🗑️ Semua riwayat dihapus', '');
}

function loadFromHistory(idx) {
    const hist = getHistory();
    const item = hist[idx];
    if (!item) return;
    document.getElementById('urlInput').value = item.source_url;
    document.getElementById('urlInput').dispatchEvent(new Event('input'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('📋 URL dimuat dari riwayat', '');
}

function renderHistory() {
    const hist    = getHistory();
    const section = document.getElementById('historySection');
    const list    = document.getElementById('historyList');

    if (!hist.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    list.innerHTML = hist.map((item, i) => `
        <div class="history-item" onclick="loadFromHistory(${i})">
            <div class="hi-type">${item.filetype || '?'}</div>
            <div class="hi-info">
                <div class="hi-name">${escHtml(item.filename)}</div>
                <div class="hi-meta">${item.filesize || '—'} &nbsp;·&nbsp; ${fmtTime(item.scraped_at)}</div>
            </div>
            <div class="hi-actions" onclick="event.stopPropagation()">
                <button class="hi-btn" title="Copy Link" onclick="navigator.clipboard.writeText('${escHtml(item.link)}').then(()=>showToast('📋 Link disalin!','success'))">
                    <i class="fas fa-copy"></i>
                </button>
                <a class="hi-btn" href="${escHtml(item.link)}" target="_blank" rel="noopener" title="Download">
                    <i class="fas fa-download"></i>
                </a>
                <button class="hi-btn del" title="Hapus" onclick="deleteHistory(${i})">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ── ANALYTICS ─────────────────────────────────
function renderAnalytics() {
    const hist    = getHistory();
    const section = document.getElementById('analyticsSection');
    const distCard = document.getElementById('distributionCard');

    if (!hist.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    // Total
    document.getElementById('acTotal').textContent = hist.length;

    // Total size
    const totalBytes = hist.reduce((s, h) => s + (h.sizeBytes || 0), 0);
    document.getElementById('acSize').textContent = fmtBytes(totalBytes);

    // Top filetype
    const typeCounts = {};
    hist.forEach(h => {
        const t = h.filetype || 'Unknown';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const topType = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('acTopType').textContent = topType ? topType[0] : '—';

    // Last scrape
    const last = hist[0]?.scraped_at;
    document.getElementById('acLastTime').textContent = last ? fmtTime(last) : '—';

    // Distribution
    if (Object.keys(typeCounts).length > 1) {
        distCard.style.display = 'block';
        const maxCount = Math.max(...Object.values(typeCounts));
        const sorted   = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).slice(0, 6);
        document.getElementById('distBars').innerHTML = sorted.map(([type, count]) => `
            <div class="dist-bar-row">
                <div class="dist-bar-label">${type}</div>
                <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width:${(count/maxCount*100).toFixed(1)}%;background:${getFileColor(type)}"></div>
                </div>
                <div class="dist-bar-count">${count}</div>
            </div>
        `).join('');
    } else {
        distCard.style.display = 'none';
    }
}

// ── UI HELPERS ────────────────────────────────
function setSection(which) {
    const sections = {
        loading: document.getElementById('loadingSection'),
        result:  document.getElementById('resultSection'),
        error:   document.getElementById('errorSection'),
    };
    Object.values(sections).forEach(s => s && (s.style.display = 'none'));
    if (which !== 'none' && sections[which]) sections[which].style.display = 'block';
}

function setBtnLoading(loading) {
    const btn = document.getElementById('scrapeBtn');
    btn.disabled = loading;
    btn.innerHTML = loading
        ? '<i class="fas fa-spinner fa-spin"></i><span>Scraping...</span>'
        : '<i class="fas fa-wand-magic-sparkles"></i><span>Scrape Sekarang</span><span class="btn-arrow">→</span>';
}

let _toastQ = [];
function showToast(msg, type = '') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        el.style.transition = '0.3s';
        setTimeout(() => el.remove(), 300);
    }, 2800);
}

// ── UTILS ─────────────────────────────────────
function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const now  = new Date();
    const diff = Math.round((now - d) / 1000);
    if (diff < 60)   return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff/60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff/3600)} jam lalu`;
    return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

function fmtBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)} KB`;
    if (bytes < 1024**3)    return `${(bytes/1024**2).toFixed(1)} MB`;
    return `${(bytes/1024**3).toFixed(2)} GB`;
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
