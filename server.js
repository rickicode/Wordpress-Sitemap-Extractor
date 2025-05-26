const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const cors = require('cors');
const morgan = require('morgan');

// Create Express app
const app = express();

// Configure middleware
app.use(cors()); // Enable CORS for all routes
app.use(morgan('dev')); // HTTP request logging
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// Configuration
const DEFAULT_LIMIT = 5;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TIMEOUT_MS = 10000; // 10 seconds

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

// Extract article URLs from WordPress sitemap
async function extractArticleUrls(baseUrl, limit = DEFAULT_LIMIT) {
    baseUrl = sanitizeUrl(baseUrl);
    if (!baseUrl) {
        throw new Error('Invalid URL format');
    }
    
    const allUrls = [];
    
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
            console.log(`Found ${urls.length} URLs in primary sitemap`);
            
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
                            console.log(`Found ${additionalUrls.length} URLs in additional sitemap #${sitemapIndex}`);
                            
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
        console.log('Primary sitemap not found. Trying to locate sitemap index...');
        
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
                                    console.log(`Found ${urls.length} URLs in sitemap ${sitemapUrl}`);
                                }
                            } catch (sitemapError) {
                                console.error(`Error processing sitemap ${sitemapUrl}: ${sitemapError.message}`);
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
                                        console.log(`Found ${urls.length} URLs in sitemap ${sitemap.loc}`);
                                    }
                                } catch (sitemapError) {
                                    console.error(`Error processing sitemap ${sitemap.loc}: ${sitemapError.message}`);
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
                                        console.log(`Found ${urls.length} URLs in HTML-referenced sitemap ${absoluteLink}`);
                                    }
                                } catch (sitemapError) {
                                    console.error(`Error processing potential sitemap ${absoluteLink}: ${sitemapError.message}`);
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
            throw new Error(`Could not find any WordPress sitemap for ${baseUrl}`);
        }
    }
    
    // Return only up to the limit if specified
    if (limit > 0) {
        return allUrls.slice(0, limit);
    }
    
    return allUrls;
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
                
                // Extract article URLs from site
                const articleUrls = await extractArticleUrls(sanitizedUrl, parseInt(limit));
                
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
                            urls: checkValidity ? validUrls : articleUrls
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
                            urls: articleUrls
                        };
                    }
                } else {
                    result.failedSites++;
                    result.siteResults[sanitizedUrl] = {
                        totalUrls: 0,
                        validUrls: 0,
                        invalidUrls: 0,
                        error: 'No URLs found'
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
