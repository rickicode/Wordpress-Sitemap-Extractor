document.addEventListener('DOMContentLoaded', () => {
    const folderSelect = document.getElementById('folderViewerSelect');
    const urlListView = document.getElementById('urlListView');
    const urlListHeader = document.getElementById('urlListHeader');
    const urlListViewCount = document.getElementById('urlListViewCount');
    const copyButton = document.getElementById('copyViewedUrls');
    const toast = document.getElementById('toast');

    let authPassword = '';
    const STORAGE_AUTH_KEY = 'xmlExtractor_authPassword_v3';

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    async function getFolders() {
        try {
            const response = await fetch('/api/folders', {
                headers: { 'x-auth-password': authPassword }
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
                headers: { 'x-auth-password': authPassword }
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

    function init() {
        authPassword = localStorage.getItem(STORAGE_AUTH_KEY);
        if (!authPassword) {
            document.body.innerHTML = `
                <div class="container">
                    <div class="glass-card" style="padding: 40px; text-align: center;">
                        <h1>Authentication Required</h1>
                        <p style="color: var(--text-secondary); margin-top: 10px;">
                            Please <a href="/#auth" style="color: var(--primary-accent);">login</a> on the main page first.
                        </p>
                    </div>
                </div>`;
            return;
        }
        
        getFolders();
        folderSelect.addEventListener('change', (e) => getUrls(e.target.value));
        copyButton.addEventListener('click', copyUrls);
    }

    init();
});