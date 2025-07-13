document.addEventListener('DOMContentLoaded', () => {
    const getElem = (id) => document.getElementById(id);

    // --- DOM Elements ---
    const authOverlay = getElem('authOverlay');
    const mainApp = getElem('mainApp');
    const globalAuthPassword = getElem('globalAuthPassword');
    const globalAuthButton = getElem('globalAuthButton');
    const globalAuthStatus = getElem('globalAuthStatus');
    const logoutButton = getElem('logoutButton');
    
    const folderSelect = getElem('folderViewerSelect');
    const urlListView = getElem('urlListView');
    const urlListHeader = getElem('urlListHeader');
    const urlListViewCount = getElem('urlListViewCount');
    const copyButton = getElem('copyViewedUrls');
    const toast = getElem('toast');

    // --- Global State ---
    let currentPassword = '';
    const STORAGE_AUTH_KEY = 'xmlExtractor_authPassword_v3';
    const STORAGE_SESSION_KEY = 'xmlExtractor_authSession_v3';

    // --- Initialization ---
    checkAuthenticationStatus();
    setupEventListeners();

    // --- Event Listeners ---
    function setupEventListeners() {
        globalAuthButton.addEventListener('click', authenticate);
        globalAuthPassword.addEventListener('keypress', e => e.key === 'Enter' && authenticate());
        logoutButton.addEventListener('click', logout);
        folderSelect.addEventListener('change', (e) => getUrls(e.target.value));
        copyButton.addEventListener('click', copyUrls);
    }

    // --- Authentication Logic ---
    function checkAuthenticationStatus() {
        const savedPassword = localStorage.getItem(STORAGE_AUTH_KEY);
        if (savedPassword) {
            currentPassword = savedPassword;
            showMainApp();
            getFolders();
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

            if (!response.ok || !result.success) throw new Error(result.message || 'Authentication failed');

            currentPassword = password;
            localStorage.setItem(STORAGE_AUTH_KEY, password);
            localStorage.setItem(STORAGE_SESSION_KEY, 'authenticated');

            showAuthStatus('Success!', 'success');
            setTimeout(() => {
                showMainApp();
                getFolders();
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
        localStorage.removeItem(STORAGE_AUTH_KEY);
        localStorage.removeItem(STORAGE_SESSION_KEY);
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

    // --- Core Viewer Logic ---
    async function getFolders() {
        try {
            const response = await fetch('/api/folders', {
                headers: { 'x-auth-password': currentPassword }
            });
            if (!response.ok) throw new Error('Failed to fetch folders. Check authentication.');
            const { folders } = await response.json();
            
            folderSelect.innerHTML = '<option value="">-- Select a Folder --</option>';
            folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                folderSelect.appendChild(option);
            });
        } catch (error) {
            alert(error.message);
        }
    }

    async function getUrls(folder) {
        if (!folder) {
            urlListView.value = '';
            urlListHeader.textContent = 'Select a folder to see the URLs';
            urlListViewCount.textContent = '0 URLs';
            copyButton.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/urls/${folder}`, {
                headers: { 'x-auth-password': currentPassword }
            });
            if (!response.ok) throw new Error(`Failed to fetch URLs for ${folder}.`);
            
            const { urls, count } = await response.json();
            urlListView.value = urls.join('\n');
            urlListHeader.textContent = `Viewing URLs in: ${folder}`;
            urlListViewCount.textContent = `${count} URLs`;
            copyButton.disabled = count === 0;
        } catch (error) {
            alert(error.message);
            urlListView.value = `Error: ${error.message}`;
            copyButton.disabled = true;
        }
    }

    function copyUrls() {
        if (!urlListView.value) return;
        navigator.clipboard.writeText(urlListView.value);
        showToast('URLs copied to clipboard!');
    }

    // --- Utilities ---
    let toastTimeout;
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});