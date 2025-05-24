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
            
            if (result.allUrls && result.allUrls.length > 0) {
                displayUrls(result.allUrls);
                displaySummary(result);
                showStatus(`Successfully extracted ${result.allUrls.length} URLs from ${siteUrls.length} sites!`, 'success');
                copyButton.disabled = false;
            } else {
                showStatus('No URLs found. Please check if these are WordPress sites with sitemaps.', 'error');
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
        
        // Add per-site breakdown
        summaryHTML += `<h4>Site Details:</h4><ul>`;
        for (const [site, details] of Object.entries(result.siteResults)) {
            if (details.error) {
                summaryHTML += `<li>${site}: Error - ${details.error}</li>`;
            } else {
                summaryHTML += `<li>${site}: Found ${details.totalUrls} URLs`;
                if (checkValidityCheckbox.checked) {
                    summaryHTML += ` (${details.validUrls} valid, ${details.invalidUrls} invalid)`;
                }
                summaryHTML += `</li>`;
            }
        }
        summaryHTML += `</ul>`;
        
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
