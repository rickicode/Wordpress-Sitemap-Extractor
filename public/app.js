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
    const resultSummary = document.getElementById('resultSummary');
    const summaryContent = document.getElementById('summaryContent');
    const failedSitesSection = document.getElementById('failedSitesSection');
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
        showStatus('Starting URL extraction...', 'normal');
        
        try {
            // Prepare the request payload
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
            
            // Display failed sites prominently
            displayFailedSites(result);
            
            if (result.allUrls && result.allUrls.length > 0) {
                displayUrls(result.allUrls);
                displaySummary(result);
                
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
                    showStatus('All sites failed to extract URLs. Please check the failed sites section below for details.', 'error');
                } else {
                    showStatus('No URLs found. Please check if these are WordPress sites with sitemaps.', 'error');
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
    
    // Display failed sites prominently
    function displayFailedSites(result) {
        const failedSites = [];
        
        // Collect all failed sites with their errors
        for (const [site, details] of Object.entries(result.siteResults)) {
            if (details.error) {
                failedSites.push({
                    url: site,
                    error: details.error
                });
            }
        }
        
        if (failedSites.length > 0) {
            failedSitesContainer.innerHTML = '';
            
            failedSites.forEach(failedSite => {
                const failedItem = document.createElement('div');
                failedItem.className = 'failed-site-item';
                
                const suggestions = getSuggestions(failedSite.error);
                
                failedItem.innerHTML = `
                    <div class="failed-site-url">${failedSite.url}</div>
                    <div class="failed-site-error"><strong>Error:</strong> ${failedSite.error}</div>
                    <div class="failed-site-suggestions">
                        <strong>💡 Suggestions:</strong> ${suggestions}
                    </div>
                `;
                
                failedSitesContainer.appendChild(failedItem);
            });
            
            failedSitesSection.classList.remove('hidden');
        } else {
            failedSitesSection.classList.add('hidden');
        }
    }
    
    // Get suggestions based on error type
    function getSuggestions(error) {
        const errorLower = error.toLowerCase();
        
        if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
            return 'The site may be slow to respond. Try again later or check if the site is accessible.';
        } else if (errorLower.includes('404') || errorLower.includes('not found')) {
            return 'The sitemap was not found. Verify this is a WordPress site with XML sitemaps enabled.';
        } else if (errorLower.includes('network') || errorLower.includes('enotfound') || errorLower.includes('dns')) {
            return 'Cannot reach the website. Check the URL spelling and ensure the site is online.';
        } else if (errorLower.includes('ssl') || errorLower.includes('certificate')) {
            return 'SSL/Certificate issue. Try using http:// instead of https:// or contact site administrator.';
        } else if (errorLower.includes('parse') || errorLower.includes('xml')) {
            return 'Invalid XML format in sitemap. The sitemap may be corrupted or not properly formatted.';
        } else if (errorLower.includes('invalid url')) {
            return 'Please check the URL format. Ensure it includes the domain (e.g., example.com or https://example.com).';
        } else {
            return 'Please verify the URL is correct and the site has WordPress XML sitemaps enabled.';
        }
    }
    
    // Display summary of the results
    function displaySummary(result) {
        let summaryHTML = `
            <p><strong>Sites processed:</strong> ${result.processedSites} of ${result.totalSites}</p>
            <p><strong>Successful sites:</strong> ${result.successfulSites}</p>
            <p><strong>Failed sites:</strong> ${result.failedSites}</p>
            <p><strong>Total URLs found:</strong> ${result.totalUrls}</p>
        `;
        
        if (checkValidityCheckbox.checked) {
            summaryHTML += `
                <p><strong>Valid URLs:</strong> ${result.validUrls}</p>
                <p><strong>Invalid URLs:</strong> ${result.invalidUrls}</p>
            `;
        }
        
        // Add per-site breakdown with better styling
        summaryHTML += `<h4>Site Details:</h4>`;
        for (const [site, details] of Object.entries(result.siteResults)) {
            if (details.error) {
                summaryHTML += `
                    <div class="site-result-item site-result-error">
                        <div class="site-result-url">❌ ${site}</div>
                        <div class="site-result-details">Error: ${details.error}</div>
                    </div>
                `;
            } else {
                summaryHTML += `
                    <div class="site-result-item site-result-success">
                        <div class="site-result-url">✅ ${site}</div>
                        <div class="site-result-details">Found ${details.totalUrls} URLs`;
                if (checkValidityCheckbox.checked) {
                    summaryHTML += ` (${details.validUrls} valid, ${details.invalidUrls} invalid)`;
                }
                summaryHTML += `</div></div>`;
            }
        }
        
        summaryContent.innerHTML = summaryHTML;
        resultSummary.classList.remove('hidden');
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
        resultSummary.classList.add('hidden');
        failedSitesSection.classList.add('hidden');
        failedSitesContainer.innerHTML = '';
    }
    
    function displayUrls(urls) {
        extractedUrlsTextarea.value = urls.join('\n');
        urlCountDisplay.textContent = `${urls.length} URLs found`;
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
