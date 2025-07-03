document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const getElem = (id) => document.getElementById(id);

    // Authentication
    const authOverlay = getElem('authOverlay');
    const mainApp = getElem('mainApp');
    const globalAuthPassword = getElem('globalAuthPassword');
    const globalAuthButton = getElem('globalAuthButton');
    const globalAuthStatus = getElem('globalAuthStatus');
    
    // Navigation
    const homeNav = getElem('homeNav');
    const manageNav = getElem('manageNav');
    const logoutButton = getElem('logoutButton');
    const homeSection = getElem('homeSection');
    const managerSection = getElem('managerSection');
    
    // Main Controls
    const siteUrlsTextarea = getElem('siteUrls');
    const urlLimitInput = getElem('urlLimit');
    const checkValidityCheckbox = getElem('checkValidity');
    const checkAdsenseCheckbox = getElem('checkAdsense');
    const extractButton = getElem('extract');
    const clearDataButton = getElem('clearData');
    
    // Auto-save & File Save
    const autoSaveIndicator = getElem('autoSaveIndicator');
    const enableAutoSaveCheckbox = getElem('enableAutoSave');
    const autoSaveIdInput = getElem('autoSaveId');
    const saveUrlToFileCheckbox = getElem('saveUrlToFile');
    const folderSelectContainer = getElem('folderSelectContainer');
    const folderInput = getElem('folderInput');
    const folderTags = getElem('folderTags');
    const folderSuggestions = getElem('folderSuggestions');
    const clearFolders = getElem('clearFolders');
    
    // Status & Results
    const statusMessage = getElem('statusMessage');
    const loadingIndicator = getElem('loadingIndicator');
    const resultsOverview = getElem('resultsOverview');
    const successCount = getElem('successCount');
    const failedCount = getElem('failedCount');
    const totalUrlsCount = getElem('totalUrlsCount');
    const fileSaveStatusCard = getElem('fileSaveStatusCard');
    const fileSaveStatusText = getElem('fileSaveStatusText');
    const urlsSection = getElem('urlsSection');
    const extractedUrlsTextarea = getElem('extractedUrls');
    const urlCountDisplay = getElem('urlCount');
    const copyUrlsButton = getElem('copyUrls');
    const autoSaveSection = getElem('autoSaveSection');
    const autoSavedId = getElem('autoSavedId');
    const autoSavedUrl = getElem('autoSavedUrl');
    const copyAutoSavedUrlButton = getElem('copyAutoSavedUrl');
    const openAutoSavedUrlButton = getElem('openAutoSavedUrl');
    
    // Manager
    const savedSitemapsContainer = getElem('savedSitemapsContainer');
    const refreshSitemapsButton = getElem('refreshSitemaps');
    const toast = getElem('toast');

    // --- Global State ---
    let currentPassword = '';
    const STORAGE_KEYS = {
        SITE_URLS: 'xmlExtractor_siteUrls_v3', URL_LIMIT: 'xmlExtractor_urlLimit_v3',
        CHECK_VALIDITY: 'xmlExtractor_checkValidity_v3', AUTO_SAVE_ID: 'xmlExtractor_autoSaveId_v3',
        ENABLE_AUTO_SAVE: 'xmlExtractor_enableAutoSave_v3', AUTH_PASSWORD: 'xmlExtractor_authPassword_v3',
        AUTH_SESSION: 'xmlExtractor_authSession_v3', SAVE_URL_TO_FILE: 'xmlExtractor_saveUrlToFile_v3',
        SELECTED_FOLDERS: 'xmlExtractor_selectedFolders_v1'
    };

    // --- Tag Input State ---
    let availableFolders = [];
    let selectedFolders = [];
    let suggestionIndex = -1;

    // --- Initialization ---
    checkAuthenticationStatus();
    setupEventListeners();

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        globalAuthButton.addEventListener('click', authenticate);
        globalAuthPassword.addEventListener('keypress', e => e.key === 'Enter' && authenticate());
        
        homeNav.addEventListener('click', () => showSection('home'));
        manageNav.addEventListener('click', () => showSection('manager'));
        logoutButton.addEventListener('click', logout);
        
        extractButton.addEventListener('click', startExtraction);
        copyUrlsButton.addEventListener('click', copyUrls);
        clearDataButton.addEventListener('click', clearSavedData);
        
        refreshSitemapsButton.addEventListener('click', loadSavedSitemaps);
        copyAutoSavedUrlButton.addEventListener('click', copyAutoSavedUrl);
        openAutoSavedUrlButton.addEventListener('click', openAutoSavedUrl);
        
        const inputsToSave = [siteUrlsTextarea, urlLimitInput, checkValidityCheckbox, enableAutoSaveCheckbox, saveUrlToFileCheckbox];
        inputsToSave.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, debounce(saveData, 500));
        });

        saveUrlToFileCheckbox.addEventListener('change', onSaveUrlToFileToggle);

        // Folder Tag Input Listeners
        folderInput.addEventListener('input', onFolderInputChange);
        folderInput.addEventListener('keydown', onFolderInputKeyDown);
        folderInput.addEventListener('focus', () => onFolderInputChange());
        clearFolders.addEventListener('click', () => {
            selectedFolders = [];
            renderTags();
            saveData();
        });
        document.addEventListener('click', (e) => {
            if (!folderSelectContainer.contains(e.target)) {
                folderSuggestions.style.display = 'none';
            }
        });
    }

    // --- Authentication ---
    function checkAuthenticationStatus() {
        if (localStorage.getItem(STORAGE_KEYS.AUTH_SESSION) && localStorage.getItem(STORAGE_KEYS.AUTH_PASSWORD)) {
            currentPassword = localStorage.getItem(STORAGE_KEYS.AUTH_PASSWORD);
            showMainApp();
            loadSavedData();
            loadSavedSitemaps();
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
                loadSavedSitemaps();
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
        showSection('home');
    }

    function showAuthStatus(message, type = 'normal') {
        globalAuthStatus.textContent = message;
        globalAuthStatus.className = `auth-status ${type}`;
    }

    // --- Navigation ---
    function showSection(sectionName) {
        document.querySelectorAll('.nav-button:not(.logout)').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
        
        const sectionMap = { home: homeNav, manager: manageNav };
        const element = sectionMap[sectionName];
        if(element) {
            element.classList.add('active');
            getElem(`${sectionName}Section`).classList.add('active');
        }
        if (sectionName === 'manager') loadSavedSitemaps();
    }

    // --- Core Logic ---
    async function startExtraction() {
        const siteUrls = siteUrlsTextarea.value.split('\n').map(url => url.trim()).filter(Boolean);
        if (siteUrls.length === 0) return showStatus('Please enter at least one valid URL.', 'error');
        
        if (saveUrlToFileCheckbox.checked && selectedFolders.length === 0) {
            return showStatus('Please select or create at least one folder.', 'error');
        }

        resetUI();
        showLoading(true);

        try {
            const payload = {
                sites: siteUrls,
                limit: parseInt(urlLimitInput.value) || 10,
                checkValidity: checkValidityCheckbox.checked,
                checkAdsense: checkAdsenseCheckbox && checkAdsenseCheckbox.checked
            };
            
            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error((await response.json()).message || 'Failed to extract URLs');
            
            const result = await response.json();
            displayResults(result, siteUrls);

        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        }
    }

    // --- UI Update Functions ---
    async function displayResults(result, siteUrls) {
        displayOverview(result);

        // Show Adsense results if present
        showAdsenseResults(result.adsenseResults);

        if (result.allUrls && result.allUrls.length > 0) {
            displayUrls(result.allUrls);
            
            let autoSaveMessage = null;
            if (enableAutoSaveCheckbox.checked) {
                autoSaveMessage = await autoSaveSitemap(result, siteUrls);
            }
            
            if (saveUrlToFileCheckbox.checked && selectedFolders.length > 0) {
                const saveFileMessage = await saveUrlsToFile(result.allUrls, selectedFolders);
                if (saveFileMessage) {
                    fileSaveStatusText.textContent = `Saved to ${selectedFolders.join(', ')}`;
                    fileSaveStatusCard.classList.remove('hidden');
                }
            }
            
            if (autoSaveMessage) {
                showStatus(autoSaveMessage, 'success');
            } else {
                showStatus(`Extraction complete. Found ${result.allUrls.length} URLs.`, 'success');
            }
        } else {
            showStatus('No URLs found. Check if sites have feeds or sitemaps.', 'error');
        }
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
        // Header
        let html = `
        <div class="urls-header">
            <div class="urls-title">
                <h2>Adsense Kode Results</h2>
                <span id="adsenseDomainCount" class="count-badge">${adsenseResults.length} Domains</span>
            </div>
            <div class="urls-actions"></div>
        </div>
        `;
        // Content area: modern, consistent adsense table using new style
        html += `
        <div class="adsense-table-container">
        <table class="adsense-table">
            <thead>
                <tr>
                    <th class="adsense-th" style="text-transform:uppercase;">DOMAIN</th>
                    <th class="adsense-th" style="text-transform:uppercase;">ADSENSE CODE</th>
                </tr>
            </thead>
            <tbody>
        `;
        adsenseResults.forEach((item, idx) => {
            let domain = '';
            try {
                domain = new URL(item.domain).hostname.toLowerCase();
            } catch {
                domain = item.domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
            }
            let codeText = (item.adsenseCodes && item.adsenseCodes.length > 0)
                ? `<span class="adsense-badge">${item.adsenseCodes.join(', ').toLowerCase()}</span>`
                : `<span class="adsense-badge error">tidak ditemukan</span>`;
            html += `
                <tr class="adsense-row">
                    <td class="adsense-td">${domain}</td>
                    <td class="adsense-td">${codeText}</td>
                </tr>
            `;
        });
        html += `
            </tbody>
        </table>
        </div>
        `;
        container.innerHTML = html;
    }

    function resetUI() {
        showStatus('', 'normal');
        resultsOverview.classList.add('hidden');
        urlsSection.classList.add('hidden');
        autoSaveSection.classList.add('hidden');
        fileSaveStatusCard.classList.add('hidden');
        extractedUrlsTextarea.value = '';
        urlCountDisplay.textContent = '0 URLs';
        copyUrlsButton.disabled = true;
    }

    function showLoading(isLoading) {
        extractButton.disabled = isLoading;
        if (isLoading) {
            statusMessage.classList.add('hidden');
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
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

    function displayOverview(result) {
        successCount.textContent = result.successfulSites || 0;
        failedCount.textContent = result.failedSites || 0;
        totalUrlsCount.textContent = result.totalUrls || 0;
        resultsOverview.classList.remove('hidden');
    }

    function displayUrls(urls) {
        extractedUrlsTextarea.value = urls.join('\n');
        urlCountDisplay.textContent = `${urls.length} URLs`;
        urlsSection.classList.remove('hidden');
        copyUrlsButton.disabled = false;
    }

    function copyUrls() {
        if (!extractedUrlsTextarea.value) return;
        navigator.clipboard.writeText(extractedUrlsTextarea.value);
        showToast('All URLs copied to clipboard!');
    }

    // --- Data Persistence ---
    function saveData() {
        autoSaveIndicator.textContent = 'Saving...';
        
        localStorage.setItem(STORAGE_KEYS.SITE_URLS, siteUrlsTextarea.value);
        localStorage.setItem(STORAGE_KEYS.URL_LIMIT, urlLimitInput.value);
        localStorage.setItem(STORAGE_KEYS.CHECK_VALIDITY, checkValidityCheckbox.checked);
        localStorage.setItem(STORAGE_KEYS.ENABLE_AUTO_SAVE, enableAutoSaveCheckbox.checked);
        localStorage.setItem(STORAGE_KEYS.SAVE_URL_TO_FILE, saveUrlToFileCheckbox.checked);
        localStorage.setItem(STORAGE_KEYS.SELECTED_FOLDERS, JSON.stringify(selectedFolders));
        
        setTimeout(() => { autoSaveIndicator.textContent = '💾 Settings saved'; }, 500);
    }

    function loadSavedData() {
        siteUrlsTextarea.value = localStorage.getItem(STORAGE_KEYS.SITE_URLS) || '';
        urlLimitInput.value = localStorage.getItem(STORAGE_KEYS.URL_LIMIT) || '10';
        checkValidityCheckbox.checked = localStorage.getItem(STORAGE_KEYS.CHECK_VALIDITY) === 'true';
        autoSaveIdInput.value = '';
        enableAutoSaveCheckbox.checked = localStorage.getItem(STORAGE_KEYS.ENABLE_AUTO_SAVE) !== 'false';
        saveUrlToFileCheckbox.checked = localStorage.getItem(STORAGE_KEYS.SAVE_URL_TO_FILE) === 'true';
        
        const savedFolders = JSON.parse(localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDERS) || '[]');
        selectedFolders = savedFolders;
        renderTags();

        onSaveUrlToFileToggle();
        autoSaveIndicator.textContent = '💾 Settings loaded';
    }

    function clearSavedData() {
        if (!confirm('Are you sure you want to clear all saved settings and input?')) return;
        Object.values(STORAGE_KEYS).forEach(key => {
            if (!key.includes('AUTH')) localStorage.removeItem(key);
        });
        selectedFolders = [];
        renderTags();
        loadSavedData();
        showStatus('Saved data cleared.', 'success');
    }

    // --- Sitemap & File Saving ---
    async function autoSaveSitemap(extractionResult, siteUrls) {
        const customId = enableAutoSaveCheckbox.checked ? '' : autoSaveIdInput.value.trim();
        try {
            const payload = { sites: siteUrls, customId, urls: extractionResult.allUrls };
            const response = await fetch('/api/sitemap/save-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-password': currentPassword },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message);
            const result = await response.json();
            
            autoSavedId.textContent = result.sitemapId;
            const fullUrl = `${window.location.origin}/sitemap/${result.sitemapId}.xml`;
            autoSavedUrl.value = fullUrl;
            autoSaveSection.classList.remove('hidden');
            if (managerSection.classList.contains('active')) loadSavedSitemaps();
            
            return `Auto-saved to sitemap ID: ${result.sitemapId}`;
        } catch (error) {
            showStatus(`Auto-save failed: ${error.message}`, 'error');
            return null;
        }
    }

    function copyAutoSavedUrl() {
        navigator.clipboard.writeText(autoSavedUrl.value);
        showToast('Sitemap URL copied!');
    }

    function openAutoSavedUrl() {
        window.open(autoSavedUrl.value, '_blank');
    }

    async function loadSavedSitemaps() {
        savedSitemapsContainer.innerHTML = '<div class="loading-sitemaps">Loading...</div>';
        try {
            const response = await fetch('/api/sitemaps', { headers: { 'x-auth-password': currentPassword } });
            if (!response.ok) throw new Error('Failed to load sitemaps');
            const { sitemaps } = await response.json();
            displaySavedSitemaps(sitemaps);
        } catch (error) {
            savedSitemapsContainer.innerHTML = `<div class="error">${error.message}</div>`;
        }
    }

    function displaySavedSitemaps(sitemaps) {
        if (!sitemaps || sitemaps.length === 0) {
            savedSitemapsContainer.innerHTML = '<div class="no-sitemaps">No sitemaps saved yet.</div>';
            return;
        }
        savedSitemapsContainer.innerHTML = '';
        sitemaps.forEach(sitemap => {
            const card = document.createElement('div');
            card.className = 'sitemap-card';
            card.innerHTML = `
                <div class="sitemap-details">
                    <div class="sitemap-id">${sitemap.id}</div>
                    <div class="sitemap-meta">
                        <span>🔗 ${sitemap.urlCount} URLs</span>
                        <span>📅 Created: ${new Date(sitemap.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="sitemap-actions">
                    <button class="mini-button" title="Copy Link" data-url="/sitemap/${sitemap.id}">📋</button>
                    <button class="mini-button" title="Open Sitemap" data-url="/sitemap/${sitemap.id}">🔗</button>
                    <button class="mini-button delete-button" title="Delete" data-id="${sitemap.id}">🗑️</button>
                </div>`;
            savedSitemapsContainer.appendChild(card);
        });

        savedSitemapsContainer.querySelectorAll('.sitemap-actions .mini-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget;
                if (target.classList.contains('delete-button')) {
                    deleteSitemap(target.dataset.id);
                } else {
                    const url = `${window.location.origin}${target.dataset.url}.xml`;
                    if (target.title === 'Copy Link') {
                        navigator.clipboard.writeText(url);
                        showToast('Sitemap URL copied!');
                    } else {
                        window.open(url, '_blank');
                    }
                }
            });
        });
    }

    async function deleteSitemap(sitemapId) {
        if (!confirm(`Are you sure you want to delete sitemap "${sitemapId}"?`)) return;
        try {
            const response = await fetch(`/api/sitemap/${sitemapId}`, {
                method: 'DELETE',
                headers: { 'x-auth-password': currentPassword }
            });
            if (!response.ok) throw new Error((await response.json()).message);
            showStatus(`Sitemap "${sitemapId}" deleted.`, 'success');
            loadSavedSitemaps();
        } catch (error) {
            showStatus(`Error deleting sitemap: ${error.message}`, 'error');
        }
    }

    // --- Folder Tag Input Logic ---
    function renderTags() {
        folderTags.innerHTML = '';
        selectedFolders.forEach(folder => {
            const tag = document.createElement('div');
            tag.className = 'tag-item';
            tag.textContent = folder;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-tag';
            removeBtn.textContent = 'x';
            removeBtn.onclick = () => removeTag(folder);
            tag.appendChild(removeBtn);
            folderTags.appendChild(tag);
        });
    }

    function addTag(folderName) {
        const query = folderName.trim().toLowerCase();
        if (!query) return;

        const exactMatch = availableFolders.find(f => f.toLowerCase() === query);
        if (exactMatch && !selectedFolders.includes(exactMatch)) {
            selectedFolders.push(exactMatch);
            renderTags();
            saveData();
            folderInput.value = '';
            folderSuggestions.style.display = 'none';
            return;
        }

        const partialMatches = availableFolders.filter(f => f.toLowerCase().includes(query) && !selectedFolders.includes(f));
        if (partialMatches.length === 1) {
            selectedFolders.push(partialMatches[0]);
            renderTags();
            saveData();
        } else if (partialMatches.length > 1) {
            showSuggestions(partialMatches);
            return; 
        }
        
        folderInput.value = '';
        folderSuggestions.style.display = 'none';
    }

    function removeTag(folder) {
        selectedFolders = selectedFolders.filter(f => f !== folder);
        renderTags();
        saveData();
    }

    function onFolderInputChange() {
        const query = folderInput.value.toLowerCase();
        
        const filtered = availableFolders.filter(f => 
            !selectedFolders.includes(f) && f.toLowerCase().includes(query)
        );
        
        if (filtered.length > 0) {
            showSuggestions(filtered);
        } else {
            folderSuggestions.style.display = 'none';
        }
    }

    function showSuggestions(suggestions) {
        folderSuggestions.innerHTML = '';
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            item.onclick = () => addTag(suggestion);
            folderSuggestions.appendChild(item);
        });
        folderSuggestions.style.display = 'block';
        suggestionIndex = -1;
    }

    function onFolderInputKeyDown(e) {
        const items = folderSuggestions.querySelectorAll('.suggestion-item');
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                if (suggestionIndex > -1 && items[suggestionIndex]) {
                    addTag(items[suggestionIndex].textContent);
                } else {
                    addTag(folderInput.value);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (items.length > 0) {
                    suggestionIndex = (suggestionIndex + 1) % items.length;
                    updateSuggestionHighlight(items);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (items.length > 0) {
                    suggestionIndex = (suggestionIndex - 1 + items.length) % items.length;
                    updateSuggestionHighlight(items);
                }
                break;
            case 'Backspace':
                if (folderInput.value === '' && selectedFolders.length > 0) {
                    removeTag(selectedFolders[selectedFolders.length - 1]);
                }
                break;
            case 'Escape':
                folderSuggestions.style.display = 'none';
                break;
        }
    }

    function updateSuggestionHighlight(items) {
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === suggestionIndex);
        });
    }

    async function onSaveUrlToFileToggle() {
        const isChecked = saveUrlToFileCheckbox.checked;
        folderSelectContainer.classList.toggle('hidden', !isChecked);
        if (isChecked && availableFolders.length === 0) {
            await loadAvailableFolders();
        }
    }

    async function loadAvailableFolders() {
        try {
            const response = await fetch('/api/folders');
            if (!response.ok) throw new Error('Could not load folders.');
            const { folders } = await response.json();
            availableFolders = folders;
        } catch (error) {
            showStatus(error.message, 'error');
        }
    }

    async function saveUrlsToFile(urls, folders) {
        try {
            const response = await fetch('/api/save-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-password': currentPassword },
                body: JSON.stringify({ urls, folders })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');
            return result.message;
        } catch (error) {
            showToast(`Error saving file: ${error.message}`, 'error');
            return null;
        }
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
