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
    const domainInput = getElem('domainInput');
    const domainRangeInput = getElem('domainRange');
    const numberRangeInput = getElem('numberRange');
    const startNumberInput = getElem('startNumber');
    const generateFormatButton = getElem('generateFormat');
    const clearDataButton = getElem('clearData');
    
    // Status & Results
    const autoSaveIndicator = getElem('autoSaveIndicator');
    const statusMessage = getElem('statusMessage');
    const resultsOverview = getElem('resultsOverview');
    const totalDomainsCount = getElem('totalDomainsCount');
    const totalGroupsCount = getElem('totalGroupsCount');
    const rangeSpanText = getElem('rangeSpanText');
    const outputLinesCount = getElem('outputLinesCount');
    const formatSection = getElem('formatSection');
    const generatedFormatTextarea = getElem('generatedFormat');
    const formatCount = getElem('formatCount');
    const copyFormatButton = getElem('copyFormat');
    const toast = getElem('toast');

    // --- Global State ---
    let currentPassword = '';
    const STORAGE_KEYS = {
        DOMAIN_INPUT: 'formatGenerator_domainInput_v1',
        DOMAIN_RANGE: 'formatGenerator_domainRange_v1',
        NUMBER_RANGE: 'formatGenerator_numberRange_v1',
        START_NUMBER: 'formatGenerator_startNumber_v1',
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
        
        generateFormatButton.addEventListener('click', generateFormat);
        copyFormatButton.addEventListener('click', copyFormat);
        clearDataButton.addEventListener('click', clearSavedData);
        
        const inputsToSave = [domainInput, domainRangeInput, numberRangeInput, startNumberInput];
        inputsToSave.forEach(input => {
            const eventType = 'input';
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

    // --- Core Logic ---
    function generateFormat() {
        const domains = domainInput.value.trim();
        if (!domains) {
            showStatus('Please enter domain list.', 'error');
            return;
        }

        const domainRange = parseInt(domainRangeInput.value) || 2;
        const numberRange = parseInt(numberRangeInput.value) || 3;
        const startNumber = parseInt(startNumberInput.value) || 6;

        // Validate inputs
        if (domainRange < 1 || domainRange > 100) {
            showStatus('Domain Range must be between 1 and 100.', 'error');
            return;
        }
        if (numberRange < 1 || numberRange > 100) {
            showStatus('Range Size must be between 1 and 100.', 'error');
            return;
        }
        if (startNumber < 1 || startNumber > 9999) {
            showStatus('Start Number must be between 1 and 9999.', 'error');
            return;
        }

        // Parse domains and auto-detect format
        const domainList = domains.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (domainList.length === 0) {
            showStatus('No valid domains found.', 'error');
            return;
        }

        // Parse each domain line for format: domain or domain,adsensecode
        const parsedDomains = [];
        const errors = [];

        for (const line of domainList) {
            if (line.includes(',')) {
                // Format: domain,adsensecode
                const parts = line.split(',').map(s => s.trim());
                if (parts.length !== 2) {
                    errors.push(`Invalid format: ${line} (should be domain,adsensecode)`);
                    continue;
                }
                const [domain, adsenseCode] = parts;
                if (!domain || !adsenseCode) {
                    errors.push(`Invalid format: ${line} (domain and adsense code required)`);
                    continue;
                }
                if (!/^[0-9]{10,32}$/.test(adsenseCode)) {
                    errors.push(`Invalid AdSense code: ${adsenseCode} (should be 10-32 digits)`);
                    continue;
                }
                parsedDomains.push({ domain, adsenseCode });
            } else {
                // Format: domain only
                parsedDomains.push({ domain: line, adsenseCode: null });
            }
        }

        if (errors.length > 0) {
            showStatus(`Input errors:\n${errors.join('\n')}`, 'error');
            return;
        }

        // Generate format
        const result = [];
        let currentNumber = startNumber;
        
        for (let i = 0; i < parsedDomains.length; i += domainRange) {
            const endNumber = currentNumber + numberRange - 1;
            const rangeText = `${currentNumber}-${endNumber}`;
            
            // Apply the same range to all domains in this group
            for (let j = i; j < Math.min(i + domainRange, parsedDomains.length); j++) {
                const { domain, adsenseCode } = parsedDomains[j];
                if (adsenseCode) {
                    // Format: domain|adsensecode|range
                    result.push(`${domain}|${adsenseCode}|${rangeText}`);
                } else {
                    // Format: domain|range
                    result.push(`${domain}|${rangeText}`);
                }
            }
            
            currentNumber = endNumber + 1;
        }

        // Display results
        displayResults(result, parsedDomains.length, domainRange, numberRange, startNumber);
        const adsenseCount = parsedDomains.filter(d => d.adsenseCode).length;
        const formatType = adsenseCount > 0 ? `mixed format (${adsenseCount} with AdSense)` : 'standard format';
        showStatus(`Successfully generated ${formatType} for ${parsedDomains.length} domains.`, 'success');
    }

    function displayResults(result, totalDomains, domainRange, numberRange, startNumber) {
        const totalGroups = Math.ceil(totalDomains / domainRange);
        const endNumber = startNumber + (totalGroups * numberRange) - 1;
        
        // Update overview
        totalDomainsCount.textContent = totalDomains;
        totalGroupsCount.textContent = totalGroups;
        rangeSpanText.textContent = `${startNumber}-${endNumber}`;
        outputLinesCount.textContent = result.length;
        resultsOverview.classList.remove('hidden');
        
        // Update format section
        generatedFormatTextarea.value = result.join('\n');
        formatCount.textContent = `${result.length} Lines`;
        formatSection.classList.remove('hidden');
        copyFormatButton.disabled = false;
    }

    function resetUI() {
        showStatus('', 'normal');
        resultsOverview.classList.add('hidden');
        formatSection.classList.add('hidden');
        generatedFormatTextarea.value = '';
        formatCount.textContent = '0 Lines';
        copyFormatButton.disabled = true;
    }

    function showStatus(message, type = 'normal') {
        if (!message || message.trim() === '') {
            statusMessage.classList.add('hidden');
        } else {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.classList.remove('hidden');
        }
    }

    function copyFormat() {
        if (!generatedFormatTextarea.value) return;
        navigator.clipboard.writeText(generatedFormatTextarea.value);
        showToast('Format copied to clipboard!');
    }

    // --- Data Persistence ---
    function saveData() {
        autoSaveIndicator.textContent = 'Saving...';
        
        localStorage.setItem(STORAGE_KEYS.DOMAIN_INPUT, domainInput.value);
        localStorage.setItem(STORAGE_KEYS.DOMAIN_RANGE, domainRangeInput.value);
        localStorage.setItem(STORAGE_KEYS.NUMBER_RANGE, numberRangeInput.value);
        localStorage.setItem(STORAGE_KEYS.START_NUMBER, startNumberInput.value);
        
        setTimeout(() => { autoSaveIndicator.textContent = '💾 Settings saved'; }, 500);
    }

    function loadSavedData() {
        domainInput.value = localStorage.getItem(STORAGE_KEYS.DOMAIN_INPUT) || '';
        domainRangeInput.value = localStorage.getItem(STORAGE_KEYS.DOMAIN_RANGE) || '2';
        numberRangeInput.value = localStorage.getItem(STORAGE_KEYS.NUMBER_RANGE) || '3';
        startNumberInput.value = localStorage.getItem(STORAGE_KEYS.START_NUMBER) || '6';
        
        autoSaveIndicator.textContent = '💾 Settings loaded';
    }

    function clearSavedData() {
        if (!confirm('Are you sure you want to clear all saved settings and input?')) return;
        Object.values(STORAGE_KEYS).forEach(key => {
            if (!key.includes('AUTH')) localStorage.removeItem(key);
        });
        
        // Reset to defaults
        domainInput.value = '';
        domainRangeInput.value = '2';
        numberRangeInput.value = '3';
        startNumberInput.value = '6';
        
        resetUI();
        showStatus('All data cleared.', 'success');
        autoSaveIndicator.textContent = '';
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
