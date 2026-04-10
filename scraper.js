// scraper.js — MediaFire Scraper Core
// by ryaakbar

'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const path    = require('path');

const MEDIAFIRE_REGEX = /^https?:\/\/(www\.)?mediafire\.com\/(file|download|view)\//i;

/**
 * Validate MediaFire URL
 * @param {string} url
 * @returns {boolean}
 */
function isValidMediaFireURL(url) {
    try {
        const u = new URL(url);
        return u.hostname.includes('mediafire.com');
    } catch {
        return false;
    }
}

/**
 * Parse file size string to bytes for analytics
 * @param {string} sizeStr
 * @returns {number}
 */
function parseSizeToBytes(sizeStr) {
    if (!sizeStr || sizeStr === 'Unknown') return 0;
    const match = sizeStr.match(/([\d.,]+)\s*(bytes?|KB|MB|GB|TB)/i);
    if (!match) return 0;
    const num  = parseFloat(match[1].replace(',', ''));
    const unit = match[2].toUpperCase();
    const map  = { BYTE: 1, BYTES: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
    return Math.round(num * (map[unit] || 1));
}

/**
 * Scrape MediaFire URL
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function scrapeMediaFire(url) {
    if (!isValidMediaFireURL(url)) {
        throw new Error('URL tidak valid. Gunakan link MediaFire yang benar.');
    }

    const response = await axios.get(url, {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Filename — multiple selectors for robustness
    const filename =
        $('div.filename').text().trim()       ||
        $('div#downloadButton-filename').text().trim() ||
        $('a#downloadButton').attr('title')?.trim()    ||
        $('h1').first().text().trim()         ||
        'Unknown File';

    // Download link
    const link =
        $('#downloadButton').attr('href')     ||
        $('a.input[type="submit"]').attr('href') ||
        $('a[id*="download"]').first().attr('href') ||
        null;

    // File details list
    const fileinfo = $('ul.details li')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);

    // Filesize
    const filesize =
        fileinfo.find(x => /bytes|KB|MB|GB|TB/i.test(x))?.replace(/.*?(\d[\d.,]*\s*(?:bytes?|KB|MB|GB|TB))/i, '$1').trim() ||
        $('div.file-info-block .details li').filter((_, el) => /bytes|KB|MB|GB/i.test($(el).text())).text().trim() ||
        'Unknown';

    // Upload date
    const upload_date =
        fileinfo.find(x => /\d{4}/.test(x) && !/bytes|KB|MB|GB/i.test(x)) ||
        $('time').attr('datetime') ||
        '-';

    // Filetype from extension
    const ext = path.extname(filename);
    const filetype = ext ? ext.replace('.', '').toUpperCase() : 'Unknown';

    // File description / additional meta
    const description = $('div.file-description').text().trim() || null;

    // Uploader name
    const uploader = $('div.owner-name a').text().trim() || null;

    // Views / downloads count
    const views = fileinfo.find(x => /view|download/i.test(x)) || null;

    // Size in bytes for analytics
    const sizeBytes = parseSizeToBytes(filesize);

    if (!link) {
        throw new Error('Link download tidak ditemukan. File mungkin dihapus atau private.');
    }

    return {
        filename,
        link,
        filesize,
        sizeBytes,
        upload_date,
        filetype,
        description,
        uploader,
        views,
        source_url: url,
        scraped_at: new Date().toISOString(),
    };
}

module.exports = { scrapeMediaFire, isValidMediaFireURL, parseSizeToBytes };
