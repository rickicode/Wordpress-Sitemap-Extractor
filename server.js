const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Auth middleware for protected routes
function requireAuth(req, res, next) {
    const authPassword = process.env.AUTH_PASSWORD;
    
    if (!authPassword) {
        return res.status(503).json({
            error: 'Authentication not configured',
            message: 'AUTH_PASSWORD environment variable is required'
        });
    }
    
    const providedPassword = req.headers['x-auth-password'] || req.body.password || req.query.password;
    
    if (!providedPassword || providedPassword !== authPassword) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Valid password required to access this resource'
        });
    }
    
    next();
}

// Create Express app
const app = express();

// Middleware to log public IP
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[ACCESS] ${ip} - ${req.method} - ${req.originalUrl}`);
    next();
});

// Configure middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// Configuration
const DEFAULT_LIMIT = 5;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TIMEOUT_MS = 10000; // 10 seconds

// PostgreSQL Configuration (Supabase)
let pool = null;
let databaseEnabled = false;

if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'postgresql://localhost:5432/test') {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    databaseEnabled = true;
    
    // Initialize database
    async function initializeDatabase() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sitemaps (
                    id SERIAL PRIMARY KEY,
                    custom_id VARCHAR(255) UNIQUE,
                    site_url TEXT NOT NULL,
                    urls TEXT[] NOT NULL,
                    source VARCHAR(50) NOT NULL,
                    page_views INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_custom_id ON sitemaps(custom_id);
                CREATE INDEX IF NOT EXISTS idx_site_url ON sitemaps(site_url);
            `);
            
            // Add page_views column if it doesn't exist (for existing databases)
            try {
                await pool.query(`
                    ALTER TABLE sitemaps
                    ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0;
                `);
                console.log('✅ Database schema updated with page_views column');
            } catch (alterError) {
                console.log('ℹ️ Page views column already exists or could not be added:', alterError.message);
            }
            
            console.log('✅ Database tables initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing database:', error);
            databaseEnabled = false;
        }
    }
    
    // Initialize database on startup
    initializeDatabase();
} else {
    console.log('⚠️  Database not configured. Sitemap collection features will be disabled.');
    console.log('   To enable database features, set DATABASE_URL in .env file.');
}

// Create axios instance with default configuration
const http = axios.create({
    timeout: TIMEOUT_MS,
    headers: {
        'User-Agent': USER_AGENT
    }
});

// Sanitize URL (ensure it has protocol and no trailing slash)
function sanitizeUrl(url) {
    if (!url) return '';
    
    // Remove trailing slash if present
    url = url.trim().replace(/\/$/, '');
    
    // Ensure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    try {
        new URL(url);
        return url;
    } catch (error) {
        return '';
    }
}

// Try to fetch the XML content from a URL
async function fetchXml(url) {
    try {
        const response = await http.get(url);
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
}

// Parse XML content
async function parseXml(xmlContent) {
    try {
        const parser = new xml2js.Parser({ explicitArray: false });
        return await parser.parseStringPromise(xmlContent);
    } catch (error) {
        throw new Error(`Failed to parse XML: ${error.message}`);
    }
}

// Check if a URL returns 200 OK (valid) or 404 (invalid)
async function checkUrlValidity(url) {
    try {
        const response = await http.head(url, {
            validateStatus: status => true // Accept all status codes
        });
        
        return {
            url,
            status: response.status,
            valid: response.status >= 200 && response.status < 300
        };
    } catch (error) {
        return {
            url,
            status: 0,
            valid: false,
            error: error.message
        };
    }
}

// Extract article URLs with priority: Feed first, then Sitemap
async function extractArticleUrls(baseUrl, limit = DEFAULT_LIMIT) {
    baseUrl = sanitizeUrl(baseUrl);
    if (!baseUrl) {
        throw new Error('Invalid URL format');
    }
    
    let allUrls = [];
    let source = 'sitemap'; // Default source
    
    // STEP 1: Try to extract from RSS/Atom feeds first
    console.log(`\n=== Trying FEED extraction for ${baseUrl} ===`);
    
    // Common WordPress feed paths
    const commonFeeds = [
        `${baseUrl}/feed/`,
        `${baseUrl}/feed`,
        `${baseUrl}/rss/`,
        `${baseUrl}/rss`,
        `${baseUrl}/atom.xml`,
        `${baseUrl}/rss.xml`,
        `${baseUrl}/feed.xml`,
        `${baseUrl}/index.php?feed=rss2`,
        `${baseUrl}/index.php?feed=rss`,
        `${baseUrl}/index.php?feed=atom`
    ];
    
    // Try each common feed URL and extract article URLs
    for (const feedUrl of commonFeeds) {
        try {
            console.log(`Checking feed at: ${feedUrl}`);
            const xmlContent = await fetchXml(feedUrl);
            const xmlData = await parseXml(xmlContent);
            
            // Extract URLs from RSS feed
            if (xmlData.rss && xmlData.rss.channel && xmlData.rss.channel.item) {
                const items = Array.isArray(xmlData.rss.channel.item)
                    ? xmlData.rss.channel.item
                    : [xmlData.rss.channel.item];
                
                const urls = items
                    .map(item => item.link)
                    .filter(url => url && typeof url === 'string');
                
                allUrls.push(...urls);
                source = 'feed';
                console.log(`✅ Found ${urls.length} URLs in RSS feed: ${feedUrl}`);
                break; // Stop after finding first working feed
            }
            
            // Extract URLs from Atom feed
            if (xmlData.feed && xmlData.feed.entry) {
                const entries = Array.isArray(xmlData.feed.entry)
                    ? xmlData.feed.entry
                    : [xmlData.feed.entry];
                
                const urls = entries
                    .map(entry => {
                        if (entry.link) {
                            // Atom link can be object with href or string
                            if (typeof entry.link === 'string') {
                                return entry.link;
                            } else if (entry.link.$ && entry.link.$.href) {
                                return entry.link.$.href;
                            } else if (entry.link.href) {
                                return entry.link.href;
                            }
                        }
                        return null;
                    })
                    .filter(url => url && typeof url === 'string');
                
                allUrls.push(...urls);
                source = 'feed';
                console.log(`✅ Found ${urls.length} URLs in Atom feed: ${feedUrl}`);
                break; // Stop after finding first working feed
            }
            
        } catch (error) {
            console.log(`❌ Could not fetch feed ${feedUrl}: ${error.message}`);
            continue;
        }
    }
    
    // If no feeds worked, try to discover feeds from the main page
    if (allUrls.length === 0) {
        try {
            console.log(`🔍 Trying to discover feeds from HTML...`);
            const response = await http.get(baseUrl);
            const $ = cheerio.load(response.data);
            
            // Look for feed links in HTML head
            const discoveredFeeds = [];
            $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, element) => {
                const href = $(element).attr('href');
                if (href) {
                    const absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
                    discoveredFeeds.push(absoluteUrl);
                }
            });
            
            // Try discovered feeds
            for (const feedUrl of discoveredFeeds) {
                try {
                    console.log(`Trying discovered feed: ${feedUrl}`);
                    const xmlContent = await fetchXml(feedUrl);
                    const xmlData = await parseXml(xmlContent);
                    
                    // Extract URLs from RSS feed
                    if (xmlData.rss && xmlData.rss.channel && xmlData.rss.channel.item) {
                        const items = Array.isArray(xmlData.rss.channel.item)
                            ? xmlData.rss.channel.item
                            : [xmlData.rss.channel.item];
                        
                        const urls = items
                            .map(item => item.link)
                            .filter(url => url && typeof url === 'string');
                        
                        allUrls.push(...urls);
                        source = 'feed';
                        console.log(`✅ Found ${urls.length} URLs in discovered RSS feed: ${feedUrl}`);
                        break;
                    }
                    
                    // Extract URLs from Atom feed
                    if (xmlData.feed && xmlData.feed.entry) {
                        const entries = Array.isArray(xmlData.feed.entry)
                            ? xmlData.feed.entry
                            : [xmlData.feed.entry];
                        
                        const urls = entries
                            .map(entry => {
                                if (entry.link) {
                                    if (typeof entry.link === 'string') {
                                        return entry.link;
                                    } else if (entry.link.$ && entry.link.$.href) {
                                        return entry.link.$.href;
                                    } else if (entry.link.href) {
                                        return entry.link.href;
                                    }
                                }
                                return null;
                            })
                            .filter(url => url && typeof url === 'string');
                        
                        allUrls.push(...urls);
                        source = 'feed';
                        console.log(`✅ Found ${urls.length} URLs in discovered Atom feed: ${feedUrl}`);
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Could not fetch discovered feed ${feedUrl}: ${error.message}`);
                    continue;
                }
            }
        } catch (error) {
            console.log(`❌ Could not parse HTML for feed discovery: ${error.message}`);
        }
    }
    
    // STEP 2: If no URLs found from feeds, fallback to sitemap extraction
    if (allUrls.length === 0) {
        console.log(`\n=== Feed extraction failed, trying SITEMAP extraction for ${baseUrl} ===`);
        
        // First try the direct approach - wp-sitemap-posts-post-1.xml
        try {
            const directSitemapUrl = `${baseUrl}/wp-sitemap-posts-post-1.xml`;
            console.log(`Checking for sitemap at: ${directSitemapUrl}`);
            
            const xmlContent = await fetchXml(directSitemapUrl);
            const xmlData = await parseXml(xmlContent);
            
            if (xmlData.urlset && xmlData.urlset.url) {
                const urls = Array.isArray(xmlData.urlset.url)
                    ? xmlData.urlset.url.map(item => item.loc)
                    : [xmlData.urlset.url.loc];
                
                allUrls.push(...urls);
                source = 'sitemap';
                console.log(`✅ Found ${urls.length} URLs in primary sitemap`);
                
                // Try to find more sitemaps if we haven't hit the limit yet
                if (limit === 0 || allUrls.length < limit) {
                    let sitemapIndex = 2;
                    while (true) {
                        try {
                            const additionalSitemapUrl = `${baseUrl}/wp-sitemap-posts-post-${sitemapIndex}.xml`;
                            console.log(`Checking for additional sitemap: ${additionalSitemapUrl}`);
                            
                            const additionalXmlContent = await fetchXml(additionalSitemapUrl);
                            const additionalXmlData = await parseXml(additionalXmlContent);
                            
                            if (additionalXmlData.urlset && additionalXmlData.urlset.url) {
                                const additionalUrls = Array.isArray(additionalXmlData.urlset.url)
                                    ? additionalXmlData.urlset.url.map(item => item.loc)
                                    : [additionalXmlData.urlset.url.loc];
                                
                                if (additionalUrls.length === 0) break;
                                
                                allUrls.push(...additionalUrls);
                                console.log(`✅ Found ${additionalUrls.length} URLs in additional sitemap #${sitemapIndex}`);
                                
                                sitemapIndex++;
                                
                                // Break if we've reached the limit
                                if (limit > 0 && allUrls.length >= limit) break;
                            } else {
                                break;
                            }
                        } catch (error) {
                            break; // Stop if no more sitemaps found
                        }
                    }
                }
            }
        } catch (directError) {
            // If direct approach fails, try to find a sitemap index
            console.log('❌ Primary sitemap not found. Trying to locate sitemap index...');
            
            const possibleIndexes = [
                `${baseUrl}/sitemap.xml`,
                `${baseUrl}/sitemap_index.xml`,
                `${baseUrl}/wp-sitemap.xml`
            ];
            
            let foundIndex = false;
            
            for (const indexUrl of possibleIndexes) {
                try {
                    console.log(`Checking for sitemap index at: ${indexUrl}`);
                    
                    const indexXmlContent = await fetchXml(indexUrl);
                    
                    // First try parsing as XML
                    try {
                        const indexXmlData = await parseXml(indexXmlContent);
                        
                        if (indexXmlData.sitemapindex && indexXmlData.sitemapindex.sitemap) {
                            foundIndex = true;
                            const sitemaps = Array.isArray(indexXmlData.sitemapindex.sitemap)
                                ? indexXmlData.sitemapindex.sitemap
                                : [indexXmlData.sitemapindex.sitemap];
                            
                            const postSitemapUrls = sitemaps
                                .map(item => item.loc)
                                .filter(url => url.includes('post') || url.includes('article'));
                            
                            console.log(`Found ${postSitemapUrls.length} post sitemaps in index`);
                            
                            // Process each post sitemap found in the index
                            for (const sitemapUrl of postSitemapUrls) {
                                if (limit > 0 && allUrls.length >= limit) break;
                                
                                try {
                                    console.log(`Processing sitemap: ${sitemapUrl}`);
                                    
                                    const sitemapXmlContent = await fetchXml(sitemapUrl);
                                    const sitemapXmlData = await parseXml(sitemapXmlContent);
                                    
                                    if (sitemapXmlData.urlset && sitemapXmlData.urlset.url) {
                                        const urls = Array.isArray(sitemapXmlData.urlset.url)
                                            ? sitemapXmlData.urlset.url.map(item => item.loc)
                                            : [sitemapXmlData.urlset.url.loc];
                                        
                                        allUrls.push(...urls);
                                        source = 'sitemap';
                                        console.log(`✅ Found ${urls.length} URLs in sitemap ${sitemapUrl}`);
                                    }
                                } catch (sitemapError) {
                                    console.error(`❌ Error processing sitemap ${sitemapUrl}: ${sitemapError.message}`);
                                }
                            }
                            
                            // If no post-specific sitemaps found but there are sitemaps, try the first few
                            if (postSitemapUrls.length === 0 && sitemaps.length > 0) {
                                const firstFewSitemaps = sitemaps.slice(0, 3);
                                
                                for (const sitemap of firstFewSitemaps) {
                                    if (limit > 0 && allUrls.length >= limit) break;
                                    
                                    try {
                                        console.log(`Processing sitemap: ${sitemap.loc}`);
                                        
                                        const sitemapXmlContent = await fetchXml(sitemap.loc);
                                        const sitemapXmlData = await parseXml(sitemapXmlContent);
                                        
                                        if (sitemapXmlData.urlset && sitemapXmlData.urlset.url) {
                                            const urls = Array.isArray(sitemapXmlData.urlset.url)
                                                ? sitemapXmlData.urlset.url.map(item => item.loc)
                                                : [sitemapXmlData.urlset.url.loc];
                                            
                                            allUrls.push(...urls);
                                            source = 'sitemap';
                                            console.log(`✅ Found ${urls.length} URLs in sitemap ${sitemap.loc}`);
                                        }
                                    } catch (sitemapError) {
                                        console.error(`❌ Error processing sitemap ${sitemap.loc}: ${sitemapError.message}`);
                                    }
                                }
                            }
                            
                            break; // Successfully found and processed index
                        }
                    } catch (parseError) {
                        // If XML parsing fails, try treating it as HTML and find sitemap links
                        try {
                            const $ = cheerio.load(indexXmlContent);
                            const sitemapLinks = $('a[href*="sitemap"], a[href*=".xml"]')
                                .map((_, el) => $(el).attr('href'))
                                .get()
                                .filter(url => url.includes('.xml'));
                            
                            if (sitemapLinks.length > 0) {
                                foundIndex = true;
                                console.log(`Found ${sitemapLinks.length} potential sitemap links in HTML`);
                                
                                for (const link of sitemapLinks) {
                                    if (limit > 0 && allUrls.length >= limit) break;
                                    
                                    // Make sure we have absolute URLs
                                    const absoluteLink = link.startsWith('http') ? link : new URL(link, baseUrl).toString();
                                    
                                    try {
                                        console.log(`Processing potential sitemap: ${absoluteLink}`);
                                        
                                        const sitemapXmlContent = await fetchXml(absoluteLink);
                                        const sitemapXmlData = await parseXml(sitemapXmlContent);
                                        
                                        if (sitemapXmlData.urlset && sitemapXmlData.urlset.url) {
                                            const urls = Array.isArray(sitemapXmlData.urlset.url)
                                                ? sitemapXmlData.urlset.url.map(item => item.loc)
                                                : [sitemapXmlData.urlset.url.loc];
                                            
                                            allUrls.push(...urls);
                                            source = 'sitemap';
                                            console.log(`✅ Found ${urls.length} URLs in HTML-referenced sitemap ${absoluteLink}`);
                                        }
                                    } catch (sitemapError) {
                                        console.error(`❌ Error processing potential sitemap ${absoluteLink}: ${sitemapError.message}`);
                                    }
                                }
                            }
                        } catch (htmlError) {
                            // Continue to the next possible index
                            continue;
                        }
                    }
                } catch (indexError) {
                    // Continue to the next possible index
                    continue;
                }
            }
            
            if (!foundIndex) {
                throw new Error(`Could not find any WordPress feeds or sitemaps for ${baseUrl}`);
            }
        }
    }
    
    // Return only up to the limit if specified, along with source information
    if (limit > 0) {
        return {
            urls: allUrls.slice(0, limit),
            source: source,
            total: allUrls.length
        };
    }
    
    return {
        urls: allUrls,
        source: source,
        total: allUrls.length
    };
}

// Legacy function for backward compatibility
async function extractFeedUrls(baseUrl, limit = 0) {
    const result = await extractArticleUrls(baseUrl, limit);
    return result.urls;
}


// API endpoint to extract URLs from WordPress sitemaps
app.post('/api/extract', async (req, res) => {
    try {
        const { sites, limit = DEFAULT_LIMIT, checkValidity = false } = req.body;
        
        if (!sites || !Array.isArray(sites) || sites.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of WordPress site URLs' });
        }
        
        const result = {
            totalSites: sites.length,
            processedSites: 0,
            successfulSites: 0,
            failedSites: 0,
            totalUrls: 0,
            validUrls: 0,
            invalidUrls: 0,
            allUrls: [],
            siteResults: {}
        };
        
        // Process each WordPress site
        for (const siteUrl of sites) {
            try {
                const sanitizedUrl = sanitizeUrl(siteUrl);
                if (!sanitizedUrl) {
                    throw new Error('Invalid URL format');
                }
                
                result.processedSites++;
                
                // Extract article URLs from site (priority: feed first, then sitemap)
                const extractionResult = await extractArticleUrls(sanitizedUrl, parseInt(limit));
                const articleUrls = extractionResult.urls;
                const source = extractionResult.source;
                
                if (articleUrls.length > 0) {
                    result.successfulSites++;
                    result.totalUrls += articleUrls.length;
                    
                    // Check validity of each article URL if requested
                    if (checkValidity) {
                        const validityResults = [];
                        
                        for (const url of articleUrls) {
                            const validityResult = await checkUrlValidity(url);
                            validityResults.push(validityResult);
                        }
                        
                        const validUrls = validityResults.filter(result => result.valid).map(result => result.url);
                        const invalidUrls = validityResults.filter(result => !result.valid).map(result => result.url);
                        
                        result.validUrls += validUrls.length;
                        result.invalidUrls += invalidUrls.length;
                        
                        // Add only valid URLs to the result
                        result.allUrls.push(...validUrls);
                        
                        // Store detailed results for this site
                        result.siteResults[sanitizedUrl] = {
                            totalUrls: articleUrls.length,
                            validUrls: validUrls.length,
                            invalidUrls: invalidUrls.length,
                            urls: checkValidity ? validUrls : articleUrls,
                            source: source // Add source information
                        };
                    } else {
                        // Add all URLs without validation
                        result.allUrls.push(...articleUrls);
                        result.validUrls += articleUrls.length;
                        
                        // Store results for this site
                        result.siteResults[sanitizedUrl] = {
                            totalUrls: articleUrls.length,
                            validUrls: articleUrls.length,
                            invalidUrls: 0,
                            urls: articleUrls,
                            source: source // Add source information
                        };
                    }
                } else {
                    result.failedSites++;
                    result.siteResults[sanitizedUrl] = {
                        totalUrls: 0,
                        validUrls: 0,
                        invalidUrls: 0,
                        error: 'No URLs found',
                        source: 'unknown'
                    };
                }
            } catch (error) {
                result.failedSites++;
                // Ensure we have a valid key for siteResults even if sanitizedUrl is not defined
                const urlKey = typeof sanitizedUrl !== 'undefined' ? sanitizedUrl : sanitizeUrl(siteUrl);
                result.siteResults[urlKey || siteUrl] = {
                    totalUrls: 0,
                    validUrls: 0,
                    invalidUrls: 0,
                    error: error.message
                };
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error processing extraction request:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API endpoint to check if specific URLs are valid
app.post('/api/check-urls', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of URLs to check' });
        }
        
        const results = [];
        
        for (const url of urls) {
            const result = await checkUrlValidity(url);
            results.push(result);
        }
        
        res.json({
            totalUrls: urls.length,
            validUrls: results.filter(result => result.valid).length,
            invalidUrls: results.filter(result => !result.valid).length,
            results
        });
    } catch (error) {
        console.error('Error checking URLs:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Endpoint to extract feed URLs - supports both GET and POST
app.all('/feed', async (req, res) => {
    try {
        let sitesToProcess = [];
        
        if (req.method === 'GET') {
            // Handle GET request with query parameters
            const { site, sites } = req.query;
            
            if (site) {
                sitesToProcess = [site];
            } else if (sites) {
                // Support comma-separated sites
                sitesToProcess = sites.split(',').map(s => s.trim());
            } else {
                return res.status(400).json({
                    error: 'Please provide a site parameter or sites parameter (comma-separated)'
                });
            }
        } else if (req.method === 'POST') {
            // Handle POST request with JSON body
            const { sites } = req.body;
            
            if (!sites || !Array.isArray(sites) || sites.length === 0) {
                return res.status(400).json({ error: 'Please provide an array of WordPress site URLs' });
            }
            
            sitesToProcess = sites;
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const result = {
            totalSites: sitesToProcess.length,
            processedSites: 0,
            successfulSites: 0,
            failedSites: 0,
            totalUrls: 0,
            allUrls: [],
            siteResults: {}
        };
        
        // Process each WordPress site
        for (const siteUrl of sitesToProcess) {
            try {
                const sanitizedUrl = sanitizeUrl(siteUrl);
                if (!sanitizedUrl) {
                    throw new Error('Invalid URL format');
                }
                
                result.processedSites++;
                
                // Extract article URLs from feeds
                const articleUrls = await extractFeedUrls(sanitizedUrl);
                
                if (articleUrls.length > 0) {
                    result.successfulSites++;
                    result.totalUrls += articleUrls.length;
                    result.allUrls.push(...articleUrls);
                    
                    // Store results for this site
                    result.siteResults[sanitizedUrl] = {
                        totalUrls: articleUrls.length,
                        validUrls: articleUrls.length,
                        invalidUrls: 0,
                        urls: articleUrls
                    };
                } else {
                    result.failedSites++;
                    result.siteResults[sanitizedUrl] = {
                        totalUrls: 0,
                        validUrls: 0,
                        invalidUrls: 0,
                        error: 'No feeds found'
                    };
                }
            } catch (error) {
                result.failedSites++;
                const urlKey = typeof sanitizedUrl !== 'undefined' ? sanitizedUrl : sanitizeUrl(siteUrl);
                result.siteResults[urlKey || siteUrl] = {
                    totalUrls: 0,
                    validUrls: 0,
                    invalidUrls: 0,
                    error: error.message
                };
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error processing feed extraction request:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API endpoint to save sitemap collection
app.post('/api/sitemap/save', requireAuth, async (req, res) => {
    if (!databaseEnabled) {
        return res.status(503).json({
            error: 'Database not configured',
            message: 'Sitemap collection requires a database connection. Please configure DATABASE_URL in .env file.'
        });
    }
    
    try {
        const { sites, customId, limit = DEFAULT_LIMIT, checkValidity = false } = req.body;
        
        if (!sites || !Array.isArray(sites) || sites.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of WordPress site URLs' });
        }
        
        // Extract URLs from all sites
        const allUrls = [];
        const siteResults = {};
        let successfulSites = 0;
        let failedSites = 0;
        
        for (const siteUrl of sites) {
            try {
                const sanitizedUrl = sanitizeUrl(siteUrl);
                if (!sanitizedUrl) {
                    throw new Error('Invalid URL format');
                }
                
                const extractionResult = await extractArticleUrls(sanitizedUrl, parseInt(limit));
                const articleUrls = extractionResult.urls;
                const source = extractionResult.source;
                
                if (articleUrls.length > 0) {
                    successfulSites++;
                    allUrls.push(...articleUrls);
                    
                    siteResults[sanitizedUrl] = {
                        totalUrls: articleUrls.length,
                        urls: articleUrls,
                        source: source
                    };
                } else {
                    failedSites++;
                    siteResults[sanitizedUrl] = {
                        totalUrls: 0,
                        error: 'No URLs found'
                    };
                }
            } catch (error) {
                failedSites++;
                siteResults[sanitizeUrl(siteUrl) || siteUrl] = {
                    totalUrls: 0,
                    error: error.message
                };
            }
        }
        
        if (allUrls.length === 0) {
            return res.status(400).json({ error: 'No URLs extracted from any site' });
        }
        
        // Generate custom ID if not provided
        let finalCustomId = customId || Math.random().toString(36).substr(2, 9);
        
        // Save to database (replace if exists and reset page views)
        const query = `
            INSERT INTO sitemaps (custom_id, site_url, urls, source, page_views, updated_at)
            VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)
            ON CONFLICT (custom_id)
            DO UPDATE SET
                site_url = EXCLUDED.site_url,
                urls = EXCLUDED.urls,
                source = EXCLUDED.source,
                page_views = 0,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        
        const result = await pool.query(query, [
            finalCustomId,
            sites.join(', '),
            allUrls,
            'mixed' // Since we can have multiple sources
        ]);
        
        res.json({
            success: true,
            sitemapId: finalCustomId,
            sitemapUrl: `/sitemap/${finalCustomId}.xml`,
            totalSites: sites.length,
            successfulSites,
            failedSites,
            totalUrls: allUrls.length,
            siteResults,
            saved: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error saving sitemap:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API endpoint to save sitemap collection directly from extracted URLs
app.post('/api/sitemap/save-direct', requireAuth, async (req, res) => {
    if (!databaseEnabled) {
        return res.status(503).json({
            error: 'Database not configured',
            message: 'Sitemap collection requires a database connection. Please configure DATABASE_URL in .env file.'
        });
    }
    
    try {
        const { urls, customId, siteUrl } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of URLs' });
        }
        
        if (!customId) {
            return res.status(400).json({ error: 'Please provide a custom ID' });
        }
        
        // Save to database (replace if exists and reset page views)
        const query = `
            INSERT INTO sitemaps (custom_id, site_url, urls, source, page_views, updated_at)
            VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)
            ON CONFLICT (custom_id)
            DO UPDATE SET
                site_url = EXCLUDED.site_url,
                urls = EXCLUDED.urls,
                source = EXCLUDED.source,
                page_views = 0,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        
        const result = await pool.query(query, [
            customId,
            siteUrl || 'Direct URLs',
            urls,
            'direct'
        ]);
        
        res.json({
            success: true,
            sitemapId: customId,
            sitemapUrl: `/sitemap/${customId}.xml`,
            totalUrls: urls.length,
            saved: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error saving sitemap directly:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API endpoint to get sitemap by ID
app.get('/api/sitemap/:id', requireAuth, async (req, res) => {
    if (!databaseEnabled) {
        return res.status(503).json({
            error: 'Database not configured',
            message: 'Sitemap collection requires a database connection.'
        });
    }
    
    try {
        const { id } = req.params;
        
        const query = 'SELECT * FROM sitemaps WHERE custom_id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }
        
        const sitemap = result.rows[0];
        res.json({
            id: sitemap.custom_id,
            siteUrl: sitemap.site_url,
            urls: sitemap.urls,
            source: sitemap.source,
            createdAt: sitemap.created_at,
            updatedAt: sitemap.updated_at,
            totalUrls: sitemap.urls.length
        });
        
    } catch (error) {
        console.error('Error retrieving sitemap:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Serve sitemap page - only accepts .xml extension (e.g., /sitemap/123.xml or /sitemap/139-24.xml)
app.get('/sitemap/:id([a-zA-Z0-9-]+).xml', async (req, res) => {
    if (!databaseEnabled) {
        return res.status(503).send('<?xml version="1.0" encoding="UTF-8"?><error>Database not configured</error>');
    }
    
    try {
        const { id } = req.params;
        
        const query = 'SELECT * FROM sitemaps WHERE custom_id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap not found</error>');
        }
        
        const sitemap = result.rows[0];
        
        // Increment page views count and get updated count
        let pageViews = sitemap.page_views + 1;
        try {
            const updateResult = await pool.query(
                'UPDATE sitemaps SET page_views = page_views + 1 WHERE custom_id = $1 RETURNING page_views',
                [id]
            );
            pageViews = updateResult.rows[0].page_views;
        } catch (updateError) {
            console.error('Error updating page views:', updateError);
            // Continue serving the sitemap even if page view tracking fails
            pageViews = sitemap.page_views;
        }
        
        // Generate XML sitemap with page views
        const xmlContent = generateXMLSitemap(sitemap.urls, pageViews);
        
        // Set appropriate headers to indicate this is a sitemap.xml
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('X-Sitemap-ID', id);
        res.set('X-Page-Views', pageViews.toString());
        res.send(xmlContent);
        
    } catch (error) {
        console.error('Error serving sitemap:', error);
        res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Error loading sitemap</error>');
    }
});

// API endpoint to list all sitemaps
app.get('/api/sitemaps', requireAuth, async (req, res) => {
    if (!databaseEnabled) {
        return res.json({ sitemaps: [] });
    }
    
    try {
        const query = 'SELECT custom_id, site_url, source, created_at, updated_at, array_length(urls, 1) as url_count, page_views FROM sitemaps ORDER BY updated_at DESC';
        const result = await pool.query(query);
        
        res.json({
            sitemaps: result.rows.map(row => ({
                id: row.custom_id,
                siteUrl: row.site_url,
                source: row.source,
                urlCount: row.url_count || 0,
                pageViews: row.page_views || 0,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                sitemapUrl: `/sitemap/${row.custom_id}.xml`
            }))
        });
        
    } catch (error) {
        console.error('Error listing sitemaps:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// API endpoint to delete sitemap by ID
app.delete('/api/sitemap/:id', requireAuth, async (req, res) => {
    if (!databaseEnabled) {
        return res.status(503).json({
            error: 'Database not configured',
            message: 'Sitemap collection requires a database connection.'
        });
    }
    
    try {
        const { id } = req.params;
        
        const query = 'DELETE FROM sitemaps WHERE custom_id = $1 RETURNING *';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sitemap not found' });
        }
        
        res.json({
            success: true,
            message: `Sitemap '${id}' deleted successfully`,
            deleted: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error deleting sitemap:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Serve manage page
app.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// Helper function to shuffle array (Fisher-Yates shuffle)
function shuffleArray(array) {
    const shuffled = [...array]; // Create a copy to avoid modifying original
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Function to generate XML sitemap (WordPress style) with random URL order
function generateXMLSitemap(urls, pageViews = 0) {
    const currentDate = new Date();
    
    // Randomize the order of URLs each time the sitemap is generated
    const shuffledUrls = shuffleArray(urls);
    
    // Generate XML with XSL stylesheet reference and page views data
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="${process.env.SITEMAP_XSL_URL || '/wp-sitemap.xsl'}" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:pageviews="http://xmlekstraktor.com/pageviews">
    <pageviews:stats>
        <pageviews:count>${pageViews}</pageviews:count>
    </pageviews:stats>`;
    
    const xmlFooter = '</urlset>';
    
    const urlEntries = shuffledUrls.map((url, index) => {
        // Generate realistic timestamps (spread over recent days)
        const daysAgo = Math.floor(index / 2); // 2 URLs per day
        const hoursOffset = (index % 2) * 12; // Morning/afternoon
        const urlDate = new Date(currentDate.getTime() - (daysAgo * 24 * 60 * 60 * 1000) + (hoursOffset * 60 * 60 * 1000));
        const lastmod = urlDate.toISOString();
        
        return `<url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod></url>`;
    }).join('');
    
    return xmlHeader + urlEntries + xmlFooter;
}

// Helper function to escape XML characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Serve the index.html file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});

// Helper function to escape HTML characters
function escapeHtml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&#x27;';
            case '"': return '&quot;';
        }
    });
}
