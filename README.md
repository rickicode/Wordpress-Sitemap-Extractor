# WordPress Sitemap URL Extractor

A Node.js web application that extracts article URLs from WordPress sitemaps and validates them to check if they're accessible (not returning 404).

## Features

- **Dual Extraction Modes**:
  - **Sitemap Mode**: Extract article URLs from WordPress XML sitemaps
  - **Feed Mode**: Extract article URLs from RSS/Atom feeds
- Web interface for inputting multiple WordPress site URLs (one per line)
- Server-side processing of WordPress sitemaps and feeds for better performance and reliability
- **Smart sitemap detection** (Sitemap Mode):
  - First tries `/wp-sitemap-posts-post-1.xml`
  - If that fails, tries alternative locations (`/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml`)
  - Parses sitemap indexes to find all post-related sitemaps
- **Smart feed detection** (Feed Mode):
  - Tries common WordPress feed paths (`/feed/`, `/rss/`, `/atom.xml`, etc.)
  - Discovers feed URLs from HTML head tags
  - Extracts article URLs directly from RSS/Atom feed content
- Option to validate URLs to check if they're accessible (not returning 404) - Sitemap Mode only
- Configurable URL limit per site - Sitemap Mode only
- Copy to clipboard functionality for extracted URLs
- Detailed summary of extraction results
- Cross-origin request support through proper CORS configuration

## Prerequisites

- Node.js 14.x or higher
- npm (Node Package Manager)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

Start the web server:

```bash
npm start
```

Then access the application in your web browser:

```
http://localhost:3000
```

### Using the Web Interface

1. Enter multiple WordPress site URLs in the textarea, one per line
2. Choose extraction type:
   - **📄 Extract Article URLs from Sitemaps**: Extract from WordPress XML sitemaps (traditional method)
   - **📡 Extract RSS/Atom Feed URLs**: Extract article URLs directly from RSS/Atom feeds
3. For Sitemap Mode only:
   - Set the URL limit per site (default: 5)
   - Optionally enable URL validation to check for 404s
4. Click "Extract URLs"
5. View the extracted URLs and summary
6. Use the "Copy URLs" button to copy all URLs to clipboard

### API Endpoints

If you want to integrate with the application programmatically, the following API endpoints are available:

#### Extract URLs from WordPress sites

```
POST /api/extract
```

Request body:
```json
{
  "sites": ["https://example1.com", "https://example2.org"],
  "limit": 10,
  "checkValidity": true
}
```

Response:
```json
{
  "totalSites": 2,
  "processedSites": 2,
  "successfulSites": 2,
  "failedSites": 0,
  "totalUrls": 20,
  "validUrls": 18,
  "invalidUrls": 2,
  "allUrls": ["https://example1.com/post1", ...],
  "siteResults": {
    "https://example1.com": {
      "totalUrls": 10,
      "validUrls": 9,
      "invalidUrls": 1,
      "urls": ["https://example1.com/post1", ...]
    },
    "https://example2.org": {
      "totalUrls": 10,
      "validUrls": 9,
      "invalidUrls": 1,
      "urls": ["https://example2.org/post1", ...]
    }
  }
}
```

#### Extract Article URLs from RSS/Atom Feeds

```
POST /feed
```

Request body:
```json
{
  "sites": ["https://example1.com", "https://example2.org"]
}
```

Response:
```json
{
  "totalSites": 2,
  "processedSites": 2,
  "successfulSites": 2,
  "failedSites": 0,
  "totalUrls": 20,
  "allUrls": ["https://example1.com/post1", "https://example1.com/post2", "https://example2.org/article1", ...],
  "siteResults": {
    "https://example1.com": {
      "totalUrls": 10,
      "validUrls": 10,
      "invalidUrls": 0,
      "urls": ["https://example1.com/post1", "https://example1.com/post2", ...]
    },
    "https://example2.org": {
      "totalUrls": 10,
      "validUrls": 10,
      "invalidUrls": 0,
      "urls": ["https://example2.org/article1", "https://example2.org/article2", ...]
    }
  }
}
```

#### Extract Feed URLs (GET method)

```
GET /feed?site=https://example.com
```

or for multiple sites:

```
GET /feed?sites=https://example1.com,https://example2.org
```

Response format is the same as POST `/feed`.

#### Check URL Validity

```
POST /api/check-urls
```

Request body:
```json
{
  "urls": ["https://example.com/post1", "https://example.com/post2"]
}
```

Response:
```json
{
  "totalUrls": 2,
  "validUrls": 1,
  "invalidUrls": 1,
  "results": [
    {
      "url": "https://example.com/post1",
      "status": 200,
      "valid": true
    },
    {
      "url": "https://example.com/post2",
      "status": 404,
      "valid": false
    }
  ]
}
```

## Project Structure

- `server.js` - Main Express server file with API routes
- `public/` - Static files served by the Express server
  - `index.html` - Main HTML file
  - `styles.css` - CSS styling
  - `app.js` - Frontend JavaScript code

## License

This project is licensed under the MIT License.
# Wordpress-Sitemap-Extractor
