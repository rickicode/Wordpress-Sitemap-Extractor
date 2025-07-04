# WordPress Sitemap URL Extractor

A Node.js web application that extracts article URLs from WordPress sitemaps and validates them to check if they're accessible (not returning 404).

## Features

- **Smart Extraction**: Automatically tries to find and extract from RSS/Atom feeds first, then falls back to XML sitemaps for comprehensive URL discovery.
- **📁 Save URLs to File**:
  - Save extracted URLs directly to a text file (`URL_LIST.txt`) on the server.
  - Select a target folder from a dropdown list.
  - Automatically creates a companion `INFO.txt` file with metadata (timestamp, URL count).
  - The folder list is sorted numerically (natural sort, e.g., RDP1, RDP2, RDP10).
  - Hidden folders (starting with a dot) are excluded from the list.
- **🗺️ Sitemap Collection Feature**:
  - Save extracted URLs as organized sitemaps in a database.
  - Custom ID support for easy sitemap management.
  - Auto-replace existing sitemaps with the same ID.
  - PostgreSQL database storage (Supabase compatible).
  - Access saved sitemaps via permalink `/sitemap/123`.
  - Browse and manage all saved sitemaps.
- **🔐 Authentication & Security**:
  - Password-protected sitemap management.
  - Secure access to saved data via `AUTH_PASSWORD`.
  - Management interface at `/manage` for data administration.
  - Delete, view, and copy functionality for saved sitemaps.
- Web interface for inputting multiple WordPress site URLs (one per line).
- Server-side processing for better performance and reliability.
- Option to validate URLs to check if they're accessible (not returning 404).
- **🤖 Captcha Detection Feature**:
  - Check if domains are protected by robot captcha using Playwright.
  - **Exclusive Mode**: When enabled, only captcha checking is performed (no sitemap extraction).
  - Detect common captcha types (reCAPTCHA, hCaptcha, Cloudflare Challenge).
  - Automatic screenshot capture for verification.
  - Results displayed in organized table format.
- Configurable URL limit per site.
- Copy to clipboard functionality for extracted URLs
- Detailed summary of extraction results
- Cross-origin request support through proper CORS configuration

## Prerequisites

- Node.js 14.x or higher
- npm (Node Package Manager)
- PostgreSQL database (Supabase recommended for cloud hosting)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Set up database configuration:
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your Supabase or PostgreSQL connection string
   - Set `AUTH_PASSWORD` for sitemap management protection
   - The application will automatically create the required tables on startup

```bash
cp .env.example .env
# Edit .env with your database credentials and authentication password
```

## Authentication

The sitemap collection and management features are protected by password authentication. Set the `AUTH_PASSWORD` environment variable in your `.env` file to enable these features.

### Protected Endpoints

All sitemap-related API endpoints require authentication via the `x-auth-password` header:
- `POST /api/sitemap/save`
- `GET /api/sitemap/:id`
- `GET /api/sitemaps`
- `DELETE /api/sitemap/:id`
- `/manage` (management interface)

## Usage

Start the web server:

```bash
npm start
```

### Docker Installation

You can also run the application using Docker:

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build and run manually
docker build -t wordpress-sitemap-extractor .
docker run -p 3000:3000 -e AUTH_PASSWORD=your_password_here wordpress-sitemap-extractor
```

Then access the application in your web browser:

```
http://localhost:3000
```

### Using the Web Interface

1. Enter multiple WordPress site URLs in the textarea, one per line.
2. Adjust settings as needed:
   - **URL limit per site**: Set the maximum number of URLs to extract from each site.
   - **Save Sitemap**: Enable to save the results as a sitemap collection in the database (requires custom ID).
   - **Validate URLs**: Check if the extracted URLs are accessible (not 404).
   - **Check for Robot Captcha**: Enable to check if domains are protected by captcha systems. **Note: When this option is enabled, only captcha checking will be performed (no sitemap extraction).**
   - **Save URLs to File**: Enable to save the results to a text file. A dropdown will appear to select the target folder.
3. Click "Extract URLs".
4. View the extracted URLs and a summary of the results.
5. Use the "Copy URLs" button to copy all extracted URLs to your clipboard.

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
  "checkValidity": true,
  "checkCaptcha": true
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
  "captchaResults": [
    {
      "domain": "https://example1.com",
      "captchaDetected": false,
      "captchaType": "unknown",
      "screenshot": "/screenshots/2025-01-07T06-45-00-000Z.png",
      "timestamp": "2025-01-07T06:45:00.000Z",
      "responseTime": 0,
      "error": null
    }
  ],
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

#### Save Sitemap Collection

```
POST /api/sitemap/save
```

Headers:
```
x-auth-password: your_management_password
```

Request body:
```json
{
  "sites": ["https://example1.com", "https://example2.org"],
  "customId": "my-sitemap-123",
  "limit": 10,
  "checkValidity": true
}
```

Response:
```json
{
  "success": true,
  "sitemapId": "my-sitemap-123",
  "sitemapUrl": "/sitemap/my-sitemap-123",
  "totalSites": 2,
  "successfulSites": 2,
  "failedSites": 0,
  "totalUrls": 20,
  "siteResults": {...},
  "saved": {
    "id": 1,
    "custom_id": "my-sitemap-123",
    "site_url": "https://example1.com, https://example2.org",
    "urls": ["https://example1.com/post1", ...],
    "source": "mixed",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Sitemap by ID

```
GET /api/sitemap/:id
```

Response:
```json
{
  "id": "my-sitemap-123",
  "siteUrl": "https://example1.com, https://example2.org",
  "urls": ["https://example1.com/post1", "https://example1.com/post2", ...],
  "source": "mixed",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "totalUrls": 20
}
```

#### View XML Sitemap

```
GET /sitemap/:id
```

Returns a properly formatted XML sitemap with all URLs for the specified ID.

#### List All Saved Sitemaps

```
GET /api/sitemaps
```

Response:
```json
{
  "sitemaps": [
    {
      "id": "my-sitemap-123",
      "siteUrl": "https://example1.com, https://example2.org",
      "source": "mixed",
      "urlCount": 20,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "sitemapUrl": "/sitemap/my-sitemap-123"
    }
  ]
}
```

#### Delete Sitemap by ID

```
DELETE /api/sitemap/:id
```

Headers:
```
x-auth-password: your_management_password
```

Response:
```json
{
  "success": true,
  "message": "Sitemap 'my-sitemap-123' deleted successfully",
  "deleted": {
    "id": 1,
    "custom_id": "my-sitemap-123",
    "site_url": "https://example1.com, https://example2.org",
    "urls": ["https://example1.com/post1", ...],
    "source": "mixed",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Management Interface

Access the web-based management interface at:
```
GET /manage
```

This interface provides:
- Password authentication
- View all saved sitemaps
- Delete sitemaps
- Preview URLs in each sitemap
- Copy sitemap URLs
- Statistics for each sitemap

## Database Schema

The application uses PostgreSQL with the following table structure:

```sql
CREATE TABLE sitemaps (
    id SERIAL PRIMARY KEY,
    custom_id VARCHAR(255) UNIQUE,
    site_url TEXT NOT NULL,
    urls TEXT[] NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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
