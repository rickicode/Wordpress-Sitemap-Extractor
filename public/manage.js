document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authSection = document.getElementById('authSection');
    const managementSection = document.getElementById('managementSection');
    const authPassword = document.getElementById('authPassword');
    const authButton = document.getElementById('authButton');
    const authStatus = document.getElementById('authStatus');
    const managementContainer = document.getElementById('managementContainer');
    const refreshManagement = document.getElementById('refreshManagement');
    
    let currentPassword = '';
    let sitemaps = [];
    
    // Event Listeners
    authButton.addEventListener('click', authenticate);
    authPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate();
    });
    refreshManagement.addEventListener('click', loadSitemaps);
    
    // Authentication function
    async function authenticate() {
        const password = authPassword.value.trim();
        
        if (!password) {
            showAuthStatus('Please enter a password', 'error');
            return;
        }
        
        authButton.disabled = true;
        showAuthStatus('Authenticating...', 'normal');
        
        try {
            const response = await fetch('/api/sitemaps', {
                headers: {
                    'x-auth-password': password
                }
            });
            
            if (response.ok) {
                currentPassword = password;
                authSection.style.display = 'none';
                managementSection.classList.add('authenticated');
                showAuthStatus('Authentication successful!', 'success');
                loadSitemaps();
            } else {
                const error = await response.json();
                showAuthStatus(error.message || 'Authentication failed', 'error');
            }
        } catch (error) {
            showAuthStatus('Network error: ' + error.message, 'error');
        } finally {
            authButton.disabled = false;
        }
    }
    
    // Load sitemaps function
    async function loadSitemaps() {
        if (!currentPassword) return;
        
        try {
            managementContainer.innerHTML = '<div class="loading-sitemaps">Loading sitemaps...</div>';
            
            const response = await fetch(`/api/sitemaps?t=${Date.now()}`, {
                headers: {
                    'x-auth-password': currentPassword,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load sitemaps');
            }
            
            const data = await response.json();
            sitemaps = data.sitemaps;
            displaySitemaps(sitemaps);
            
        } catch (error) {
            console.error('Error loading sitemaps:', error);
            managementContainer.innerHTML = '<div class="loading-sitemaps">Failed to load sitemaps: ' + error.message + '</div>';
        }
    }
    
    // Display sitemaps function
    function displaySitemaps(sitemapList) {
        if (sitemapList.length === 0) {
            managementContainer.innerHTML = '<div class="loading-sitemaps">No saved sitemaps found</div>';
            return;
        }
        
        managementContainer.innerHTML = '';
        
        sitemapList.forEach(sitemap => {
            const sitemapElement = createSitemapManagementItem(sitemap);
            managementContainer.appendChild(sitemapElement);
        });
    }
    
    // Create sitemap management item
    function createSitemapManagementItem(sitemap) {
        const sitemapItem = document.createElement('div');
        sitemapItem.className = 'sitemap-management-item';
        
        const createdDate = new Date(sitemap.createdAt).toLocaleDateString('id-ID');
        const updatedDate = new Date(sitemap.updatedAt).toLocaleDateString('id-ID');
        const fullSitemapUrl = `${window.location.origin}/sitemap/${sitemap.id}`;
        
        sitemapItem.innerHTML = `
            <div class="sitemap-header">
                <div class="sitemap-id-large">${sitemap.id}</div>
                <button class="danger-button" onclick="deleteSitemap('${sitemap.id}')">
                    🗑️ Delete
                </button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${sitemap.urlCount}</div>
                    <div class="stat-label">Total URLs</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${sitemap.pageViews || 0}</div>
                    <div class="stat-label">Page Views</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${sitemap.source}</div>
                    <div class="stat-label">Source</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${createdDate}</div>
                    <div class="stat-label">Created</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${updatedDate}</div>
                    <div class="stat-label">Updated</div>
                </div>
            </div>
            
            <div class="sitemap-details">
                <div class="detail-item">
                    <span class="detail-icon">🌐</span>
                    <span><strong>Sites:</strong> ${sitemap.siteUrl}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">🔗</span>
                    <span><strong>Sitemap URL:</strong> 
                        <a href="${sitemap.sitemapUrl}" target="_blank">${fullSitemapUrl}</a>
                    </span>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <button onclick="toggleUrlPreview('${sitemap.id}')" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 10px;">
                    👁️ Preview URLs
                </button>
                <button onclick="copySitemapUrlToClipboard('${fullSitemapUrl}')" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    📋 Copy URL
                </button>
            </div>
            
            <div id="url-preview-${sitemap.id}" class="url-preview" style="display: none;">
                <div style="font-weight: bold; margin-bottom: 10px;">URLs in this sitemap:</div>
                <div id="url-list-${sitemap.id}">Loading...</div>
            </div>
        `;
        
        return sitemapItem;
    }
    
    // Delete sitemap function
    window.deleteSitemap = async function(sitemapId) {
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
                alert(`Sitemap '${sitemapId}' deleted successfully!`);
                loadSitemaps(); // Refresh the list
            } else {
                const error = await response.json();
                alert('Error deleting sitemap: ' + error.message);
            }
        } catch (error) {
            alert('Network error: ' + error.message);
        }
    };
    
    // Toggle URL preview
    window.toggleUrlPreview = async function(sitemapId) {
        const previewElement = document.getElementById(`url-preview-${sitemapId}`);
        const urlListElement = document.getElementById(`url-list-${sitemapId}`);
        
        if (previewElement.style.display === 'none') {
            previewElement.style.display = 'block';
            
            // Load URLs if not already loaded
            if (urlListElement.innerHTML === 'Loading...') {
                try {
                    const response = await fetch(`/api/sitemap/${sitemapId}`, {
                        headers: {
                            'x-auth-password': currentPassword
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const urlsHtml = data.urls.map((url, index) => 
                            `<div class="url-item">${index + 1}. ${url}</div>`
                        ).join('');
                        urlListElement.innerHTML = urlsHtml;
                    } else {
                        urlListElement.innerHTML = 'Error loading URLs';
                    }
                } catch (error) {
                    urlListElement.innerHTML = 'Network error loading URLs';
                }
            }
        } else {
            previewElement.style.display = 'none';
        }
    };
    
    // Copy sitemap URL to clipboard
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
    
    // Show authentication status
    function showAuthStatus(message, type = 'normal') {
        authStatus.textContent = message;
        authStatus.className = '';
        
        if (type === 'error') {
            authStatus.style.color = '#fff';
            authStatus.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            authStatus.style.padding = '10px';
            authStatus.style.borderRadius = '6px';
            authStatus.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        } else if (type === 'success') {
            authStatus.style.color = '#d4edda';
            authStatus.style.backgroundColor = 'rgba(212, 237, 218, 0.2)';
            authStatus.style.padding = '10px';
            authStatus.style.borderRadius = '6px';
            authStatus.style.border = '1px solid rgba(212, 237, 218, 0.3)';
        } else {
            authStatus.style.color = '#fff';
            authStatus.style.backgroundColor = 'transparent';
            authStatus.style.padding = '0';
            authStatus.style.border = 'none';
        }
    }
});