document.addEventListener('DOMContentLoaded', () => {
    // Authentication Elements
    const authOverlay = document.getElementById('authOverlay');
    const mainApp = document.getElementById('mainApp');
    const globalAuthPassword = document.getElementById('globalAuthPassword');
    const globalAuthButton = document.getElementById('globalAuthButton');
    const globalAuthStatus = document.getElementById('globalAuthStatus');
    
    // Navigation Elements
    const homeNav = document.getElementById('homeNav');
    const manageNav = document.getElementById('manageNav');
    const logoutButton = document.getElementById('logoutButton');
    const homeSection = document.getElementById('homeSection');
    const managerSection = document.getElementById('managerSection');
    
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
    
    // Auto-save Elements
    const autoSaveId = document.getElementById('autoSaveId');
    const autoSaveSection = document.getElementById('autoSaveSection');
    const autoSavedId = document.getElementById('autoSavedId');
    const autoSavedUrl = document.getElementById('autoSavedUrl');
    const copyAutoSavedUrlButton = document.getElementById('copyAutoSavedUrl');
    const openAutoSavedUrlButton = document.getElementById('openAutoSavedUrl');
    const savedSitemapsContainer = document.getElementById('savedSitemapsContainer');
    const refreshSitemapsButton = document.getElementById('refreshSitemaps');

    // Global variables
    let currentPassword = '';
    let isAuthenticated = false;

    // LocalStorage keys
    const STORAGE_KEYS = {
        SITE_URLS: 'xmlExtractor_siteUrls',
        URL_LIMIT: 'xmlExtractor_urlLimit',
        CHECK_VALIDITY: 'xmlExtractor_checkValidity',
        AUTH_PASSWORD: 'xmlExtractor_authPassword',
        AUTH_SESSION: 'xmlExtractor_authSession'
    };

    // Check authentication on page load
    checkAuthenticationStatus();

    // Authentication Event Listeners
    globalAuthButton.addEventListener('click', authenticate);
    globalAuthPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate();
    });
    
    // Navigation Event Listeners
    homeNav.addEventListener('click', () => showSection('home'));
    manageNav.addEventListener('click', () => showSection('manager'));
    logoutButton.addEventListener('click', logout);
    
    // Event Listeners
    extractButton.addEventListener('click', startExtraction);
    copyButton.addEventListener('click', copyUrls);
    document.getElementById('clearData').addEventListener('click', clearSavedData);
    
    // Auto-save Event Listeners
    copyAutoSavedUrlButton.addEventListener('click', copyAutoSavedUrl);
    openAutoSavedUrlButton.addEventListener('click', openAutoSavedUrl);
    refreshSitemapsButton.addEventListener('click', loadSavedSitemaps);
    
    // Auto-save data when user types or changes settings
    siteUrlsTextarea.addEventListener('input', debounce(saveData, 500));
    urlLimitInput.addEventListener('change', saveData);
    checkValidityCheckbox.addEventListener('change', saveData);

    // Authentication Functions
    function checkAuthenticationStatus() {
        const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
        const savedPassword = localStorage.getItem(STORAGE_KEYS.AUTH_PASSWORD);
        
        if (savedAuth && savedPassword) {
            currentPassword = savedPassword;
            isAuthenticated = true;
            showMainApp();
            loadSavedData();
            loadSavedSitemaps();
        } else {
            showAuthOverlay();
        }
    }

    async function authenticate() {
        const password = globalAuthPassword.value.trim();
        
        if (!password) {
            showAuthStatus('Please enter a password', 'error');
            return;
        }
        
        globalAuthButton.disabled = true;
        showAuthStatus('Authenticating...', 'normal');
        
        try {
            // Test authentication with a simple API call
            const response = await fetch('/api/sitemaps', {
                headers: {
                    'x-auth-password': password
                }
            });
            
            if (response.ok) {
                currentPassword = password;
                isAuthenticated = true;
                
                // Save authentication to localStorage
                localStorage.setItem(STORAGE_KEYS.AUTH_PASSWORD, password);
                localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'authenticated');
                
                showAuthStatus('Authentication successful!', 'success');
                setTimeout(() => {
                    showMainApp();
                    loadSavedData();
                    loadSavedSitemaps();
                }, 1000);
            } else {
                const error = await response.json();
                showAuthStatus(error.message || 'Authentication failed', 'error');
            }
        } catch (error) {
            showAuthStatus('Network error: ' + error.message, 'error');
        } finally {
            globalAuthButton.disabled = false;
        }
    }

    function logout() {
        if (confirm('Are you sure you want to logout?')) {
            currentPassword = '';
            isAuthenticated = false;
            
            // Clear authentication from localStorage
            localStorage.removeItem(STORAGE_KEYS.AUTH_PASSWORD);
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            
            showAuthOverlay();
            globalAuthPassword.value = '';
            showAuthStatus('', 'normal');
        }
    }

    function showAuthOverlay() {
        authOverlay.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }

    function showMainApp() {
        authOverlay.classList.add('hidden');
        mainApp.classList.remove('hidden');
        showSection('home'); // Show home section by default
    }

    function showAuthStatus(message, type = 'normal') {
        globalAuthStatus.textContent = message;
        globalAuthStatus.className = 'auth-status';
        
        if (type === 'error') {
            globalAuthStatus.classList.add('error');
        } else if (type === 'success') {
            globalAuthStatus.classList.add('success');
        }
    }

    // Navigation Functions
    function showSection(sectionName) {
        // Update navigation buttons
        document.querySelectorAll('.nav-button:not(.logout)').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        if (sectionName === 'home') {
            homeNav.classList.add('active');
            homeSection.classList.add('active');
        } else if (sectionName === 'manager') {
            manageNav.classList.add('active');
            managerSection.classList.add('active');
            loadSavedSitemaps(); // Refresh sitemaps when switching to manager
        }
    }

    // Function to start URL extraction
    async function startExtraction() {
        const siteUrls = getSiteUrls();
        if (siteUrls.length === 0) {
            showStatus('Please enter at least one valid URL', 'error');
            return;
        }

        const urlLimit = parseInt(urlLimitInput.value) || 5;
        const checkValidity = checkValidityCheckbox.checked;
        
        // Save data when extract button is pressed
        saveData();
        
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
                
                // Auto-save to sitemap
                await autoSaveSitemap(result.allUrls, result);
                
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
        autoSaveSection.classList.add('hidden');
        
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

    // LocalStorage functions
    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEYS.SITE_URLS, siteUrlsTextarea.value);
            localStorage.setItem(STORAGE_KEYS.URL_LIMIT, urlLimitInput.value);
            localStorage.setItem(STORAGE_KEYS.CHECK_VALIDITY, checkValidityCheckbox.checked.toString());
        } catch (error) {
            console.warn('Failed to save data to localStorage:', error);
        }
    }

    function loadSavedData() {
        try {
            // Load site URLs
            const savedUrls = localStorage.getItem(STORAGE_KEYS.SITE_URLS);
            if (savedUrls) {
                siteUrlsTextarea.value = savedUrls;
            }

            // Load URL limit
            const savedLimit = localStorage.getItem(STORAGE_KEYS.URL_LIMIT);
            if (savedLimit) {
                urlLimitInput.value = savedLimit;
            }

            // Load check validity setting
            const savedCheckValidity = localStorage.getItem(STORAGE_KEYS.CHECK_VALIDITY);
            if (savedCheckValidity !== null) {
                checkValidityCheckbox.checked = savedCheckValidity === 'true';
            }
        } catch (error) {
            console.warn('Failed to load data from localStorage:', error);
        }
    }

    // Clear saved data function
    function clearSavedData() {
        if (confirm('Are you sure you want to clear all saved data? This will remove all saved URLs and settings.')) {
            try {
                localStorage.removeItem(STORAGE_KEYS.SITE_URLS);
                localStorage.removeItem(STORAGE_KEYS.URL_LIMIT);
                localStorage.removeItem(STORAGE_KEYS.CHECK_VALIDITY);
                
                // Reset form to defaults
                siteUrlsTextarea.value = '';
                urlLimitInput.value = '5';
                checkValidityCheckbox.checked = false;
                
                showStatus('Saved data cleared successfully', 'success');
            } catch (error) {
                console.warn('Failed to clear data from localStorage:', error);
                showStatus('Failed to clear saved data', 'error');
            }
        }
    }

    // Debounce function to limit how often saveData is called
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Auto-save sitemap function
    async function autoSaveSitemap(urlsArray, extractionResult) {
        if (!isAuthenticated || !currentPassword) {
            console.log('No authentication, skipping auto-save');
            return;
        }

        try {
            // Get auto-save ID or generate one starting from 100
            let sitemapId = autoSaveId.value.trim();
            
            if (!sitemapId) {
                // Generate auto ID starting from 100
                sitemapId = await getNextAvailableId();
            }

            // Validate ID format (numbers only)
            if (!/^[0-9]+$/.test(sitemapId)) {
                console.log('Invalid auto-save ID format, skipping auto-save');
                return;
            }

            const payload = {
                urls: urlsArray,
                customId: sitemapId,
                siteUrl: getSiteUrls().join(', ') || 'Auto-saved URLs'
            };

            const response = await fetch('/api/sitemap/save-direct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-password': currentPassword
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                
                // Display auto-save success
                const fullSitemapUrl = `${window.location.origin}/sitemap/${result.sitemapId}`;
                autoSavedUrl.value = fullSitemapUrl;
                autoSavedId.textContent = result.sitemapId;
                
                autoSaveSection.classList.remove('hidden');
                
                // Update auto-save ID for next time if it was auto-generated
                if (!autoSaveId.value.trim()) {
                    autoSaveId.value = parseInt(result.sitemapId) + 1;
                }
                
                // Refresh saved sitemaps list
                loadSavedSitemaps();
                
                console.log(`Auto-saved sitemap with ID: ${result.sitemapId}`);
            } else {
                console.log('Auto-save failed:', await response.text());
            }
            
        } catch (error) {
            console.log('Auto-save error:', error.message);
        }
    }

    // Get next available ID starting from 100
    async function getNextAvailableId() {
        try {
            const response = await fetch('/api/sitemaps', {
                headers: {
                    'x-auth-password': currentPassword
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const existingIds = data.sitemaps.map(s => parseInt(s.id)).filter(id => !isNaN(id) && id >= 100);
                
                if (existingIds.length === 0) {
                    return '100';
                }
                
                existingIds.sort((a, b) => a - b);
                let nextId = 100;
                
                for (const id of existingIds) {
                    if (id === nextId) {
                        nextId++;
                    } else {
                        break;
                    }
                }
                
                return nextId.toString();
            }
        } catch (error) {
            console.log('Error getting next ID:', error);
        }
        
        return '100'; // Default fallback
    }

    // Auto-saved URL functions
    function copyAutoSavedUrl() {
        autoSavedUrl.select();
        document.execCommand('copy');
        
        const originalText = copyAutoSavedUrlButton.textContent;
        copyAutoSavedUrlButton.textContent = '✅';
        
        setTimeout(() => {
            copyAutoSavedUrlButton.textContent = originalText;
        }, 2000);
    }

    function openAutoSavedUrl() {
        const url = autoSavedUrl.value;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    function copySitemapUrl() {
        sitemapUrl.select();
        document.execCommand('copy');
        
        const originalText = copySitemapUrlButton.innerHTML;
        copySitemapUrlButton.innerHTML = '<span class="button-icon">✅</span>Copied!';
        
        setTimeout(() => {
            copySitemapUrlButton.innerHTML = originalText;
        }, 2000);
    }

    function openSitemapUrl() {
        const url = sitemapUrl.value;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    async function loadSavedSitemaps() {
        if (!isAuthenticated || !currentPassword) {
            savedSitemapsContainer.innerHTML = '<div class="loading-sitemaps">Authentication required</div>';
            return;
        }
        
        try {
            savedSitemapsContainer.innerHTML = '<div class="loading-sitemaps">Loading saved sitemaps...</div>';
            
            const response = await fetch('/api/sitemaps', {
                headers: {
                    'x-auth-password': currentPassword
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication expired. Please logout and login again.');
                }
                throw new Error('Failed to load sitemaps');
            }
            
            const data = await response.json();
            displaySavedSitemaps(data.sitemaps);
            
        } catch (error) {
            console.error('Error loading saved sitemaps:', error);
            savedSitemapsContainer.innerHTML = '<div class="loading-sitemaps">Failed to load saved sitemaps: ' + error.message + '</div>';
        }
    }

    function displaySavedSitemaps(sitemaps) {
        if (sitemaps.length === 0) {
            savedSitemapsContainer.innerHTML = '<div class="loading-sitemaps">No saved sitemaps found</div>';
            return;
        }

        savedSitemapsContainer.innerHTML = '';
        
        sitemaps.forEach(sitemap => {
            const sitemapElement = createSitemapItem(sitemap);
            savedSitemapsContainer.appendChild(sitemapElement);
        });
    }

    function createSitemapItem(sitemap) {
        const sitemapItem = document.createElement('div');
        sitemapItem.className = 'sitemap-item';
        
        const createdDate = new Date(sitemap.createdAt).toLocaleDateString('id-ID');
        const updatedDate = new Date(sitemap.updatedAt).toLocaleDateString('id-ID');
        const fullSitemapUrl = `${window.location.origin}${sitemap.sitemapUrl}`;
        
        sitemapItem.innerHTML = `
            <div class="sitemap-item-header">
                <div class="sitemap-id">${sitemap.id}</div>
                <div class="sitemap-date">Updated: ${updatedDate}</div>
            </div>
            <div class="sitemap-details">
                <div class="detail-item">
                    <span class="detail-icon">🌐</span>
                    <span>Sites: ${sitemap.siteUrl}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">🔗</span>
                    <span>URLs: ${sitemap.urlCount}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">📅</span>
                    <span>Created: ${createdDate}</span>
                </div>
            </div>
            <div class="sitemap-actions-row">
                <a href="${sitemap.sitemapUrl}" target="_blank" class="view-sitemap-button">
                    🔍 View Sitemap
                </a>
                <button class="copy-sitemap-url" onclick="copySitemapUrlToClipboard('${fullSitemapUrl}')">
                    📋 Copy URL
                </button>
                <button class="danger-button" onclick="deleteSitemapFromMain('${sitemap.id}')">
                    🗑️ Delete
                </button>
            </div>
        `;
        
        return sitemapItem;
    }

    // Delete sitemap function
    window.deleteSitemapFromMain = async function(sitemapId) {
        if (!confirm(`Are you sure you want to delete sitemap '${sitemapId}'? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/sitemap/${sitemapId}`, {
                method: 'DELETE',
                headers: {
                    'x-auth-password': currentPassword
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                showStatus(`Sitemap '${sitemapId}' deleted successfully!`, 'success');
                loadSavedSitemaps(); // Refresh the list
            } else {
                const error = await response.json();
                showStatus('Error deleting sitemap: ' + error.message, 'error');
            }
        } catch (error) {
            showStatus('Network error: ' + error.message, 'error');
        }
    };

    // Global function for copying sitemap URLs
    window.copySitemapUrlToClipboard = function(url) {
        navigator.clipboard.writeText(url).then(() => {
            // Find the button that was clicked and provide feedback
            event.target.textContent = 'Copied!';
            setTimeout(() => {
                event.target.textContent = '📋 Copy URL';
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            event.target.textContent = 'Copied!';
            setTimeout(() => {
                event.target.textContent = '📋 Copy URL';
            }, 2000);
        });
    };
});
