<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html>
<head>
    <title>XML Sitemap</title>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="robots" content="noindex, nofollow"/>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #0073aa 0%, #005177 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.2rem;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .stats {
            background: #f8f9fa;
            padding: 20px 30px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .stats-item {
            font-weight: 600;
            color: #495057;
        }
        
        .stats-value {
            color: #0073aa;
            font-weight: 700;
        }
        
        .url-list {
            padding: 0;
        }
        
        .url-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 30px;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s ease;
        }
        
        .url-item:hover {
            background-color: #f8f9fa;
        }
        
        .url-item:last-child {
            border-bottom: none;
        }
        
        .url-link {
            color: #0073aa;
            text-decoration: none;
            font-weight: 500;
            word-break: break-all;
            flex: 1;
            margin-right: 20px;
        }
        
        .url-link:hover {
            text-decoration: underline;
            color: #005177;
        }
        
        .url-date {
            color: #6c757d;
            font-size: 0.9rem;
            white-space: nowrap;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #6c757d;
            font-size: 0.9rem;
            border-top: 1px solid #e9ecef;
        }
        
        @media (max-width: 768px) {
            .stats {
                flex-direction: column;
                text-align: center;
            }
            
            .url-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
                padding: 20px 30px;
            }
            
            .url-link {
                margin-right: 0;
                margin-bottom: 5px;
            }
            
            .url-date {
                align-self: flex-end;
                font-size: 0.8rem;
            }
            
            .header h1 {
                font-size: 1.8rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>XML Sitemap</h1>
            <p>This sitemap contains <span class="stats-value"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span> URLs</p>
        </div>
        
        <div class="stats">
            <div class="stats-item">
                Total URLs: <span class="stats-value"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span>
            </div>
            <div class="stats-item">
                Generated: <span class="stats-value"><xsl:value-of select="substring(sitemap:urlset/sitemap:url[1]/sitemap:lastmod, 1, 10)"/></span>
            </div>
        </div>
        
        <div class="url-list">
            <xsl:for-each select="sitemap:urlset/sitemap:url">
                <div class="url-item">
                    <a href="{sitemap:loc}" class="url-link" rel="nofollow noreferrer" target="_blank">
                        <xsl:value-of select="sitemap:loc"/>
                    </a>
                    <div class="url-date">
                        <xsl:value-of select="substring(sitemap:lastmod, 1, 19)"/>
                    </div>
                </div>
            </xsl:for-each>
        </div>
        
        <div class="footer">
            Generated by XML Extractor
        </div>
    </div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>