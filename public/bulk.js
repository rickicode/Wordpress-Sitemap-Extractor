document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const getElem = (id) => document.getElementById(id);

    // Authentication
    const authOverlay = getElem('authOverlay');
    const mainApp = getElem('mainApp');
    const globalAuthPassword = getElem('globalAuthPassword');
    const globalAuthButton = getElem('globalAuthButton');
    const globalAuthStatus = getElem('globalAuthStatus');
    const logoutButton = getElem('logoutButton');
    
    // Main Controls
    const bulkInput = getElem('bulkInput');
    const urlLimitInput = getElem('urlLimit');
    const checkValidityCheckbox = getElem('checkValidity');
    const checkAdsenseCheckbox = getElem('checkAdsense');
    const bulkExtractButton = getElem('bulkExtract');
    const clearDataButton = getElem('clearData');
    
    // Status & Progress
    const autoSaveIndicator = getElem('autoSaveIndicator');
    const statusMessage = getElem('statusMessage');
    const loadingIndicator = getElem('loadingIndicator');
    const progressSection = getElem('progressSection');
    const overallProgressFill = getElem('overallProgressFill');
    const overallProgressText = getElem('overallProgressText');
    const progressDetails = getElem('progressDetails');
    
    // Results
    const resultsOverview = getElem('resultsOverview');
    const successCount = getElem('successCount');
    const failedCount = getElem('failedCount');
    const totalUrlsCount = getElem('totalUrlsCount');
    const rangesCount = getElem('rangesCount');
    const bulkResultsSection = getElem('bulkResultsSection');
    const bulkResultCount = getElem('bulkResultCount');
    const bulkResultsContent = getElem('bulkResultsContent');
    const urlsSection = getElem('urlsSection');
    const extractedUrlsTextarea = getElem('extractedUrls');
    const urlCountDisplay = getElem('urlCount');
    const copyUrlsButton = getElem('copyUrls');
    const toast = getElem('toast');

    // --- Global State ---
    let currentPassword = '';
    const STORAGE_KEYS = {
        BULK_INPUT: 'bulkExtractor_bulkInput_v1',
        URL_LIMIT: 'bulkExtractor_urlLimit_v1',
        CHECK_VALIDITY: 'bulkExtractor_checkValidity_v1',
        CHECK_ADSENSE: 'bulkExtractor_checkAdsense_v1',
        AUTH_PASSWORD: 'xmlExtractor_authPassword_v3',
        AUTH_SESSION: 'xmlExtractor_authSession_v3'
    };

    // --- Initialization ---
    checkAuthenticationStatus();
    setupEventListeners();

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        globalAuthButton.addEventListener('click', authenticate);
        globalAuthPassword.addEventListener('keypress', e => e.key === 'Enter' && authenticate());
        
        logoutButton.addEventListener('click', logout);
        
        bulkExtractButton.addEventListener('click', startBulkExtraction);
        copyUrlsButton.addEventListener('click', copyUrls);
        clearDataButton.addEventListener('click', clearSavedData);
        
        const inputsToSave = [bulkInput, urlLimitInput, checkValidityCheckbox, checkAdsenseCheckbox];
        inputsToSave.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, debounce(saveData, 500));
        });
    }

    // --- Authentication ---
    function checkAuthenticationStatus() {
        if (localStorage.getItem(STORAGE_KEYS.AUTH_SESSION) && localStorage.getItem(STORAGE_KEYS.AUTH_PASSWORD)) {
            currentPassword = localStorage.getItem(STORAGE_KEYS.AUTH_PASSWORD);
            showMainApp();
            loadSavedData();
        } else {
            showAuthOverlay();
        }
    }

    async function authenticate() {
        const password = globalAuthPassword.value.trim();
        if (!password) return showAuthStatus('Please enter a password', 'error');

        globalAuthButton.disabled = true;
        showAuthStatus('Verifying...', 'normal');

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Authentication failed');
            }

            currentPassword = password;
            localStorage.setItem(STORAGE_KEYS.AUTH_PASSWORD, password);
            localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'authenticated');

            showAuthStatus('Success!', 'success');
            setTimeout(() => {
                showMainApp();
                loadSavedData();
            }, 1000);

        } catch (error) {
            showAuthStatus(error.message, 'error');
        } finally {
            globalAuthButton.disabled = false;
        }
    }

    function logout() {
        if (!confirm('Are you sure you want to logout?')) return;
        currentPassword = '';
        localStorage.removeItem(STORAGE_KEYS.AUTH_PASSWORD);
        localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
        showAuthOverlay();
        globalAuthPassword.value = '';
        showAuthStatus('', 'normal');
    }

    function showAuthOverlay() {
        authOverlay.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }

    function showMainApp() {
        authOverlay.classList.add('hidden');
        mainApp.classList.remove('hidden');
    }

    function showAuthStatus(message, type = 'normal') {
        globalAuthStatus.textContent = message;
        globalAuthStatus.className = `auth-status ${type}`;
    }

    // --- Input Parsing ---
    function parseBulkInput(input) {
        const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
        const parsed = [];
        const errors = [];

        for (const line of lines) {
            if (!line.includes('|')) {
                errors.push(`Invalid format: ${line} (should be domain|range or domain|adsensekode|range)`);
                continue;
            }

            const parts = line.split('|').map(s => s.trim());
            let subdomain, expectedAdsenseCode = null, rangeStr;

            if (parts.length === 2) {
                // Format lama: domain|range
                [subdomain, rangeStr] = parts;
            } else if (parts.length === 3) {
                // Format baru: domain|adsensekode|range
                [subdomain, expectedAdsenseCode, rangeStr] = parts;
            } else {
                errors.push(`Invalid format: ${line} (should be domain|range or domain|adsensekode|range)`);
                continue;
            }
            
            if (!subdomain || !rangeStr) {
                errors.push(`Invalid format: ${line}`);
                continue;
            }

            // Validasi AdSense code jika ada
            if (expectedAdsenseCode && (expectedAdsenseCode.length < 10 || expectedAdsenseCode.length > 32 || !/^\d+$/.test(expectedAdsenseCode))) {
                errors.push(`Invalid AdSense code: ${expectedAdsenseCode} (should be 10-32 digits)`);
                continue;
            }

            if (!rangeStr.includes('-')) {
                errors.push(`Invalid range format: ${rangeStr} (should be start-end)`);
                continue;
            }

            const [startStr, endStr] = rangeStr.split('-').map(s => s.trim());
            const start = parseInt(startStr);
            const end = parseInt(endStr);

            if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > 999) {
                errors.push(`Invalid range: ${rangeStr} (should be valid numbers)`);
                continue;
            }

            parsed.push({
                subdomain: subdomain.startsWith('http') ? subdomain : `https://${subdomain}`,
                expectedAdsenseCode,
                range: rangeStr,
                start,
                end,
                numbers: Array.from({length: end - start + 1}, (_, i) => start + i)
            });
        }

        return { parsed, errors };
    }

    function groupByRange(parsedInputs) {
        const groups = {};
        
        for (const input of parsedInputs) {
            const rangeKey = input.range;
            if (!groups[rangeKey]) {
                groups[rangeKey] = {
                    range: input.range,
                    start: input.start,
                    end: input.end,
                    numbers: input.numbers,
                    subdomains: [],
                    subdomainData: []
                };
            }
            groups[rangeKey].subdomains.push(input.subdomain);
            groups[rangeKey].subdomainData.push({
                subdomain: input.subdomain,
                expectedAdsenseCode: input.expectedAdsenseCode
            });
        }

        return Object.values(groups);
    }

    // --- Core Logic ---
    async function startBulkExtraction() {
        const input = bulkInput.value.trim();
        if (!input) return showStatus('Please enter bulk input data.', 'error');
        
        // Parse input
        const { parsed, errors } = parseBulkInput(input);
        
        if (errors.length > 0) {
            showStatus(`Input errors:\n${errors.join('\n')}`, 'error');
            return;
        }

        if (parsed.length === 0) {
            showStatus('No valid input found.', 'error');
            return;
        }

        // Group by range
        const rangeGroups = groupByRange(parsed);
        
        resetUI();
        showLoading(true);
        showProgress(true);
        bulkExtractButton.disabled = true;
        bulkExtractButton.textContent = 'Processing...';
        
        showStatus('Starting bulk processing...', 'info');

        try {
            // Detect if any domain has expectedAdsenseCode for auto-check
            const hasAdsenseValidation = rangeGroups.some(group => 
                group.subdomainData && group.subdomainData.some(item => item.expectedAdsenseCode)
            );
            
            const payload = {
                rangeGroups,
                limit: parseInt(urlLimitInput.value) || 10,
                checkValidity: checkValidityCheckbox.checked,
                checkAdsense: hasAdsenseValidation || checkAdsenseCheckbox.checked // Auto-check if has validation OR manual check
            };
            
            const response = await fetch('/api/bulk-extract', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-auth-password': currentPassword 
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.message || 'Failed to process bulk extraction');
            }
            
            const result = await response.json();
            displayBulkResults(result);

        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            showLoading(false);
            showProgress(false);
            bulkExtractButton.disabled = false;
            bulkExtractButton.textContent = 'Start Bulk Processing';
        }
    }

    // --- UI Update Functions ---
    function displayBulkResults(result) {
        displayOverview(result);
        displayBulkResultsTable(result.rangeResults);
        
        // Show Adsense results if present
        showAdsenseResults(result.adsenseResults);
        
        // Show URL Results per domain
        showUrlResults(result.siteResults);
        
        // Display URLs grouped by range
        displayGroupedUrls(result.rangeResults);

        showLoading(false);
        showProgress(false);
        bulkExtractButton.disabled = false;
        bulkExtractButton.textContent = 'Start Bulk Processing';
        
        const totalUrls = result.totalUrls || 0;
        const rangesProcessed = Object.keys(result.rangeResults || {}).length;
        
        showStatus(`Bulk processing complete. Processed ${rangesProcessed} ranges with ${totalUrls} total URLs.`, 'success');
    }

    function displayOverview(result) {
        successCount.textContent = result.successfulSites || 0;
        failedCount.textContent = result.failedSites || 0;
        totalUrlsCount.textContent = result.totalUrls || 0;
        rangesCount.textContent = Object.keys(result.rangeResults || {}).length;
        resultsOverview.classList.remove('hidden');
    }

    function displayBulkResultsTable(rangeResults) {
        if (!rangeResults || Object.keys(rangeResults).length === 0) {
            bulkResultsSection.classList.add('hidden');
            return;
        }

        bulkResultsSection.classList.remove('hidden');
        bulkResultCount.textContent = `${Object.keys(rangeResults).length} Ranges`;

        let html = '<div class="bulk-results-table-container">';
        html += '<table class="bulk-results-table">';
        html += '<thead><tr>';
        html += '<th class="bulk-results-th">RANGE</th>';
        html += '<th class="bulk-results-th">SUBDOMAINS</th>';
        html += '<th class="bulk-results-th">COMBINED URLs</th>';
        html += '<th class="bulk-results-th">SITEMAPS</th>';
        html += '<th class="bulk-results-th">FOLDERS</th>';
        html += '</tr></thead><tbody>';

        Object.entries(rangeResults).forEach(([range, data]) => {
            const subdomainList = data.subdomains.map(url => {
                try {
                    return new URL(url).hostname;
                } catch {
                    return url.replace(/^https?:\/\//, '').split('/')[0];
                }
            }).join(', ');

            const sitemapLinks = data.numbers.map(num => 
                `<a href="/sitemap/${num}.xml" target="_blank">${num}</a>`
            ).join(', ');

            const folderList = data.numbers.map(num => `RDP${num}`).join(', ');

            html += `
                <tr class="bulk-results-row">
                    <td class="bulk-results-td"><strong>${range}</strong></td>
                    <td class="bulk-results-td">${subdomainList}</td>
                    <td class="bulk-results-td"><span class="url-count-badge total">${data.urls.length}</span></td>
                    <td class="bulk-results-td">${sitemapLinks}</td>
                    <td class="bulk-results-td">${folderList}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        bulkResultsContent.innerHTML = html;
    }

    function displayGroupedUrls(rangeResults) {
        if (!rangeResults || Object.keys(rangeResults).length === 0) {
            urlsSection.classList.add('hidden');
            return;
        }

        let allUrlsText = '';
        let totalUrls = 0;

        Object.entries(rangeResults).forEach(([range, data]) => {
            allUrlsText += `RANGE ${range}\n`;
            allUrlsText += data.urls.join('\n');
            allUrlsText += '\n\n';
            totalUrls += data.urls.length;
        });

        extractedUrlsTextarea.value = allUrlsText.trim();
        urlCountDisplay.textContent = `${totalUrls} URLs`;
        urlsSection.classList.remove('hidden');
        copyUrlsButton.disabled = false;
    }

    // Show Adsense results in a new card/section
    function showAdsenseResults(adsenseResults) {
        let container = document.getElementById('adsenseResultsSection');
        if (!container) {
            container = document.createElement('div');
            container.id = 'adsenseResultsSection';
            container.className = 'urls-section glass-card';
            container.style.marginTop = '24px';
            const parent = document.querySelector('.content-section.active .input-section');
            if (parent) parent.parentNode.insertBefore(container, parent.nextSibling);
        }
        container.innerHTML = '';
        if (!adsenseResults || !Array.isArray(adsenseResults) || adsenseResults.length === 0) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        
        let html = `
        <div class="urls-header">
            <div class="urls-title">
                <h2>Adsense Kode Validation Results</h2>
                <span id="adsenseDomainCount" class="count-badge">${adsenseResults.length} Domains</span>
            </div>
        </div>
        `;
        
        html += `
        <div class="adsense-table-container">
        <table class="adsense-table">
            <thead>
                <tr>
                    <th class="adsense-th">DOMAIN</th>
                    <th class="adsense-th">EXPECTED CODE</th>
                    <th class="adsense-th">FOUND CODE(S)</th>
                    <th class="adsense-th">STATUS</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        adsenseResults.forEach(item => {
            let domain = '';
            try {
                domain = new URL(item.domain).hostname.toLowerCase();
            } catch {
                domain = item.domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
            }
            
            // Expected code
            const expectedCode = item.expectedCode || '-';
            
            // Found codes
            let foundCodeText = '';
            if (item.foundCodes && item.foundCodes.length > 0) {
                foundCodeText = `<span class="adsense-badge">${item.foundCodes.join(', ')}</span>`;
            } else if (item.adsenseCodes && item.adsenseCodes.length > 0) {
                foundCodeText = `<span class="adsense-badge">${item.adsenseCodes.join(', ')}</span>`;
            } else {
                foundCodeText = `<span class="adsense-badge error">tidak ditemukan</span>`;
            }
            
            // Status and row styling
            let statusText = '';
            let rowClass = 'adsense-row';
            
            if (item.expectedCode) {
                // Ada expected code, lakukan validasi
                if (item.isMatch === true) {
                    statusText = `<span class="adsense-status match">✅ MATCH</span>`;
                    rowClass += ' match-row';
                } else {
                    statusText = `<span class="adsense-status mismatch">❌ MISMATCH</span>`;
                    rowClass += ' mismatch-row';
                }
            } else {
                // Tidak ada expected code (format lama)
                statusText = `<span class="adsense-status no-validation">⚪ NO VALIDATION</span>`;
                rowClass += ' no-validation-row';
            }
                
            html += `
                <tr class="${rowClass}">
                    <td class="adsense-td">${domain}</td>
                    <td class="adsense-td">${expectedCode}</td>
                    <td class="adsense-td">${foundCodeText}</td>
                    <td class="adsense-td">${statusText}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // Show URL results per domain in a new card/section
    function showUrlResults(siteResults) {
        let container = document.getElementById('urlResultsSection');
        if (!container) {
            container = document.createElement('div');
            container.id = 'urlResultsSection';
            container.className = 'urls-section glass-card';
            container.style.marginTop = '24px';
            const parent = document.querySelector('.content-section.active .input-section');
            if (parent) parent.parentNode.insertBefore(container, parent.nextSibling);
        }
        container.innerHTML = '';
        if (!siteResults || Object.keys(siteResults).length === 0) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        
        let html = `
        <div class="urls-header">
            <div class="urls-title">
                <h2>URL Extraction Results</h2>
                <span id="urlDomainCount" class="count-badge">${Object.keys(siteResults).length} Domains</span>
            </div>
        </div>
        `;
        
        html += `
        <div class="url-results-table-container">
        <table class="url-results-table">
            <thead>
                <tr>
                    <th class="url-results-th">DOMAIN</th>
                    <th class="url-results-th">TOTAL URLs</th>
                    <th class="url-results-th">VALID URLs</th>
                    <th class="url-results-th">INVALID URLs</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        Object.entries(siteResults).forEach(([domain, data]) => {
            let domainName = '';
            try {
                domainName = new URL(domain).hostname.toLowerCase();
            } catch {
                domainName = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
            }
            
            const totalUrls = data.totalUrls || 0;
            const validUrls = data.validUrls || 0;
            const invalidUrls = data.invalidUrls || 0;
            
            html += `
                <tr class="url-results-row">
                    <td class="url-results-td">${domainName}</td>
                    <td class="url-results-td"><span class="url-count-badge total">${totalUrls}</span></td>
                    <td class="url-results-td"><span class="url-count-badge valid">${validUrls}</span></td>
                    <td class="url-results-td"><span class="url-count-badge invalid">${invalidUrls}</span></td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    function resetUI() {
        showStatus('', 'normal');
        resultsOverview.classList.add('hidden');
        bulkResultsSection.classList.add('hidden');
        urlsSection.classList.add('hidden');
        extractedUrlsTextarea.value = '';
        urlCountDisplay.textContent = '0 URLs';
        copyUrlsButton.disabled = true;
        
        // Hide additional result sections
        const adsenseSection = document.getElementById('adsenseResultsSection');
        if (adsenseSection) adsenseSection.classList.add('hidden');
        
        const urlResultsSection = document.getElementById('urlResultsSection');
        if (urlResultsSection) urlResultsSection.classList.add('hidden');
    }

    function showLoading(isLoading) {
        if (isLoading) {
            statusMessage.classList.add('hidden');
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }

    function showProgress(show) {
        progressSection.classList.toggle('hidden', !show);
        if (!show) {
            overallProgressFill.style.width = '0%';
            overallProgressText.textContent = '0%';
            progressDetails.innerHTML = '';
        }
    }

    function updateProgress(current, total, currentTask = '') {
        const percentage = Math.round((current / total) * 100);
        overallProgressFill.style.width = `${percentage}%`;
        overallProgressText.textContent = `${percentage}%`;
        
        if (currentTask) {
            progressDetails.innerHTML = `<div class="progress-item">🔄 ${currentTask}</div>`;
        }
    }

    function showStatus(message, type = 'normal') {
        showLoading(false);
        if (!message || message.trim() === '') {
            statusMessage.classList.add('hidden');
        } else {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.classList.remove('hidden');
        }
    }

    function copyUrls() {
        if (!extractedUrlsTextarea.value) return;
        navigator.clipboard.writeText(extractedUrlsTextarea.value);
        showToast('All URLs copied to clipboard!');
    }

    // --- Data Persistence ---
    function saveData() {
        autoSaveIndicator.textContent = 'Saving...';
        
        localStorage.setItem(STORAGE_KEYS.BULK_INPUT, bulkInput.value);
        localStorage.setItem(STORAGE_KEYS.URL_LIMIT, urlLimitInput.value);
        localStorage.setItem(STORAGE_KEYS.CHECK_VALIDITY, checkValidityCheckbox.checked);
        localStorage.setItem(STORAGE_KEYS.CHECK_ADSENSE, checkAdsenseCheckbox.checked);
        
        setTimeout(() => { autoSaveIndicator.textContent = '💾 Settings saved'; }, 500);
    }

    function loadSavedData() {
        bulkInput.value = localStorage.getItem(STORAGE_KEYS.BULK_INPUT) || '';
        urlLimitInput.value = localStorage.getItem(STORAGE_KEYS.URL_LIMIT) || '10';
        checkValidityCheckbox.checked = localStorage.getItem(STORAGE_KEYS.CHECK_VALIDITY) === 'true';
        checkAdsenseCheckbox.checked = localStorage.getItem(STORAGE_KEYS.CHECK_ADSENSE) !== 'false';
        
        autoSaveIndicator.textContent = '💾 Settings loaded';
    }

    function clearSavedData() {
        if (!confirm('Are you sure you want to clear all saved settings and input?')) return;
        Object.values(STORAGE_KEYS).forEach(key => {
            if (!key.includes('AUTH')) localStorage.removeItem(key);
        });
        loadSavedData();
        showStatus('Saved data cleared.', 'success');
    }

    // --- Utilities ---
    let toastTimeout;
    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = 'toast show';
        if (type === 'error') {
            toast.classList.add('error');
        }
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
