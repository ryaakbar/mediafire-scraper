// routes/api.js — API Routes
// by ryaakbar

'use strict';

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { scrapeMediaFire, isValidMediaFireURL } = require('../scraper');

const router = express.Router();

// Rate limiter — max 20 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Terlalu banyak request. Coba lagi dalam 1 menit.',
        code: 'RATE_LIMITED',
    },
});

// ── POST /api/scrape ───────────────────────────
router.post('/scrape', limiter, async (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'URL wajib diisi.',
            code: 'MISSING_URL',
        });
    }

    const trimmed = url.trim();

    if (!isValidMediaFireURL(trimmed)) {
        return res.status(400).json({
            success: false,
            error: 'URL tidak valid. Harus berupa link MediaFire.',
            code: 'INVALID_URL',
        });
    }

    try {
        const data = await scrapeMediaFire(trimmed);
        return res.json({ success: true, data });
    } catch (err) {
        console.error('[scrape]', err.message);

        const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
        const isNetwork = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED';

        return res.status(502).json({
            success: false,
            error: isTimeout ? 'Request timeout. Coba lagi.'
                 : isNetwork ? 'Tidak dapat terhubung ke MediaFire.'
                 : err.message || 'Gagal scrape. Coba lagi.',
            code: isTimeout ? 'TIMEOUT' : isNetwork ? 'NETWORK_ERROR' : 'SCRAPE_FAILED',
        });
    }
});

// ── POST /api/validate ─────────────────────────
router.post('/validate', (req, res) => {
    const { url } = req.body;
    res.json({ valid: isValidMediaFireURL(url?.trim() || '') });
});

// ── GET /api/health ────────────────────────────
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
