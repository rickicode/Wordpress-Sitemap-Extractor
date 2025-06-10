document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const siteUrlsTextarea = document.getElementById('siteUrls');
    const urlLimitInput = document.getElementById('urlLimit');
    const checkValidityCheckbox = document.getElementById('checkValidity');
    const extractButton = document.getElementById('extract');
    const copyButton = document.getElementById('copyUrls');
    const statusMessage = document.getElementById('statusMessage');
    const extractedUrlsTextarea = document.getElementById('extractedUrls');
    const urlCountDisplay = document.getElementById('urlCount');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const progressContainer = document.getElementById('progressContainer');
    const progressCount = document.getElementById('progressCount');
    const progressFill = document.getElementById('progressFill');
    const resultsOverview = document.getElementById('resultsOverview');
    const sitesStatusSection = document.getElementById('sitesStatusSection');
    const urlsSection = document.getElementById('urlsSection');
    const successCount = document.getElementById('successCount');
    const failedCount = document.getElementById('failedCount');
    const totalUrlsCount = document.getElementById('totalUrlsCount');
    const allSitesContainer = document.getElementById('allSitesContainer');
    const successfulSitesContainer = document.getElementById('successfulSitesContainer');
    const failedSitesContainer = document.getElementById('failedSitesContainer');

    // Event Listeners
    extractButton.addEventListener('click', startExtraction);
    copyButton.addEventListener('click', copyUrls);

    // Function to start URL extraction
    async function startExtraction() {
        const siteUrls = getSiteUrls();
        if (siteUrls.length === 0) {
            showStatus('Please enter at least one valid URL', 'error');
            return;
        }

        const urlLimit = parseInt(urlLimitInput.value) || 5;
        const checkValidity = checkValidityCheckbox.checked;
        
        resetUI();
        showLoading(true);
        showStatus('Starting smart extraction (feeds first, then sitemaps)...', 'normal');
        
        try {
            // Smart extraction: feeds first, then sitemaps
            const payload = {
                sites: siteUrls,
                limit: urlLimit,
                checkValidity: checkValidity
            };
            
            // Make API call to the backend
            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to extract URLs');
            }
            
            const result = await response.json();
            
            // Display overview cards
            displayOverview(result);
            
            // Display sites status
            displaySitesStatus(result);
            
            if (result.allUrls && result.allUrls.length > 0) {
                displayUrls(result.allUrls);
                
                // Create more detailed status message
                let statusMsg = `Successfully extracted ${result.allUrls.length} URLs`;
                if (result.failedSites > 0) {
                    statusMsg += ` from ${result.successfulSites} sites (${result.failedSites} sites failed)`;
                } else {
                    statusMsg += ` from ${result.successfulSites} sites`;
                }
                showStatus(statusMsg, 'success');
                copyButton.disabled = false;
            } else {
                if (result.failedSites === result.totalSites) {
                    showStatus('All sites failed to extract URLs. Please check the sites status below for details.', 'error');
                } else {
                    showStatus('No URLs found. Please check if these are WordPress sites with feeds or sitemaps.', 'error');
                }
            }
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            showLoading(false);
            hideProgress();
            loadingIndicator.classList.add('hidden'); // Ensure loading indicator is hidden
        }
    }
    
    // Function to get site URLs from textarea (one per line)
    function getSiteUrls() {
        return siteUrlsTextarea.value
            .split('\n')
            .map(url => url.trim())
            .filter(url => url); // Filter out empty lines
    }
    
    // Display overview cards
    function displayOverview(result) {
        successCount.textContent = result.successfulSites || 0;
        failedCount.textContent = result.failedSites || 0;
        totalUrlsCount.textContent = result.totalUrls || 0;
        
        // Reset the card title for URLs
        document.querySelector('.urls-card .card-title').textContent = 'Total URLs';
        
        resultsOverview.classList.remove('hidden');
    }
    
    // Display sites status with tabs
    function displaySitesStatus(result) {
        const allSites = [];
        const successfulSites = [];
        const failedSites = [];
        
        // Organize sites by status
        for (const [site, details] of Object.entries(result.siteResults)) {
            const siteData = {
                url: site,
                ...details
            };
            
            allSites.push(siteData);
            
            if (details.error) {
                failedSites.push(siteData);
            } else {
                successfulSites.push(siteData);
            }
        }
        
        // Populate all sites tab
        allSitesContainer.innerHTML = '';
        allSites.forEach(site => {
            allSitesContainer.appendChild(createSiteItem(site));
        });
        
        // Populate successful sites tab
        successfulSitesContainer.innerHTML = '';
        if (successfulSites.length > 0) {
            successfulSites.forEach(site => {
                successfulSitesContainer.appendChild(createSiteItem(site));
            });
        } else {
            successfulSitesContainer.innerHTML = '<div class="no-sites-message">🎉 No successful extractions yet</div>';
        }
        
        // Populate failed sites tab
        failedSitesContainer.innerHTML = '';
        if (failedSites.length > 0) {
            failedSites.forEach(site => {
                failedSitesContainer.appendChild(createSiteItem(site));
            });
        } else {
            failedSitesContainer.innerHTML = '<div class="no-sites-message">✅ No failed extractions</div>';
        }
        
        sitesStatusSection.classList.remove('hidden');
    }
    
    // Create a site item element
    function createSiteItem(site) {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        
        const isSuccess = !site.error;
        const statusBadge = isSuccess ?
            '<span class="site-status-badge badge-success">Success</span>' :
            '<span class="site-status-badge badge-failed">Failed</span>';
        
        let detailsHTML = '';
        let errorHTML = '';
        let sourceHTML = '';
        
        if (isSuccess) {
            // Show source information
            const sourceIcon = site.source === 'feed' ? '📡' : '🗺️';
            const sourceName = site.source === 'feed' ? 'RSS/Atom Feed' : 'XML Sitemap';
            sourceHTML = `
                <div class="detail-item source-info">
                    <span class="detail-icon">${sourceIcon}</span>
                    <span>Source: ${sourceName}</span>
                </div>
            `;
            
            detailsHTML = `
                <div class="site-details">
                    ${sourceHTML}
                    <div class="detail-item">
                        <span class="detail-icon">📄</span>
                        <span>Total URLs: ${site.totalUrls}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">✅</span>
                        <span>Valid: ${site.validUrls}</span>
                    </div>
                    ${site.invalidUrls > 0 ? `
                    <div class="detail-item">
                        <span class="detail-icon">❌</span>
                        <span>Invalid: ${site.invalidUrls}</span>
                    </div>` : ''}
                </div>
            `;
        } else {
            errorHTML = `
                <div class="site-error">
                    <strong>Error:</strong> ${site.error}
                </div>
                <div class="site-suggestions">
                    <strong>💡 Suggestions:</strong> ${getSuggestions(site.error)}
                </div>
            `;
        }
        
        siteItem.innerHTML = `
            <div class="site-item-header">
                <div class="site-url">
                    ${isSuccess ? '✅' : '❌'} ${site.url}
                </div>
                ${statusBadge}
            </div>
            ${detailsHTML}
            ${errorHTML}
        `;
        
        return siteItem;
    }
    
    // Get suggestions based on error type
    function getSuggestions(error) {
        const errorLower = error.toLowerCase();
        
        if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
            return 'The site may be slow to respond. Try again later or check if the site is accessible.';
        } else if (errorLower.includes('404') || errorLower.includes('not found')) {
            return 'No feeds or sitemaps were found. Verify this is a WordPress site with RSS/Atom feeds or XML sitemaps enabled.';
        } else if (errorLower.includes('network') || errorLower.includes('enotfound') || errorLower.includes('dns')) {
            return 'Cannot reach the website. Check the URL spelling and ensure the site is online.';
        } else if (errorLower.includes('ssl') || errorLower.includes('certificate')) {
            return 'SSL/Certificate issue. Try using http:// instead of https:// or contact site administrator.';
        } else if (errorLower.includes('parse') || errorLower.includes('xml')) {
            return 'Invalid XML format. The feed or sitemap may be corrupted or not properly formatted.';
        } else if (errorLower.includes('invalid url')) {
            return 'Please check the URL format. Ensure it includes the domain (e.g., example.com or https://example.com).';
        } else if (errorLower.includes('no feeds found') || errorLower.includes('no urls found')) {
            return 'No content sources were detected. Check if the site has RSS/Atom feeds or XML sitemaps enabled.';
        } else {
            return 'Please verify the URL is correct and the site has WordPress feeds or sitemaps enabled.';
        }
    }
    
    // Tab switching function
    window.showStatusTab = function(tabName) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.status-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.status-tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        document.getElementById(`${tabName}SitesTab`).classList.add('active');
        document.getElementById(`${tabName}SitesContent`).classList.add('active');
    }
    
    // Show progress bar
    function showProgress(current, total) {
        progressContainer.classList.remove('hidden');
        updateProgress(current, total);
    }
    
    // Hide progress bar
    function hideProgress() {
        progressContainer.classList.add('hidden');
    }
    
    // Update progress bar
    function updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        progressFill.style.width = `${percentage}%`;
        progressCount.textContent = `${current}/${total}`;
    }
    
    // UI Helper Functions
    function showStatus(message, type = 'normal') {
        statusMessage.textContent = message;
        statusMessage.className = '';
        
        if (type === 'error') {
            statusMessage.classList.add('error');
        } else if (type === 'success') {
            statusMessage.classList.add('success');
        }
    }
    
    function showLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
            extractButton.disabled = true;
        } else {
            loadingIndicator.classList.add('hidden');
            extractButton.disabled = false;
        }
    }
    
    function resetUI() {
        extractedUrlsTextarea.value = '';
        urlCountDisplay.textContent = '0 URLs found';
        copyButton.disabled = true;
        resultsOverview.classList.add('hidden');
        sitesStatusSection.classList.add('hidden');
        urlsSection.classList.add('hidden');
        
        // Clear containers
        allSitesContainer.innerHTML = '';
        successfulSitesContainer.innerHTML = '';
        failedSitesContainer.innerHTML = '';
        
        // Reset tab state
        document.querySelectorAll('.status-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.status-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById('allSitesTab').classList.add('active');
        document.getElementById('allSitesContent').classList.add('active');
    }
    
    function displayUrls(urls) {
        extractedUrlsTextarea.value = urls.join('\n');
        urlCountDisplay.textContent = `${urls.length} URLs found`;
        urlsSection.classList.remove('hidden');
    }
    
    function copyUrls() {
        extractedUrlsTextarea.select();
        document.execCommand('copy');
        
        // Provide feedback that URLs were copied
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
    }
});
