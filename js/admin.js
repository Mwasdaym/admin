document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    // Check if already logged in
    if (localStorage.getItem('adminAuthenticated') === 'true') {
        window.location.href = 'dashboard.html';
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = document.getElementById('adminPassword').value;
            const apiUrl = document.getElementById('apiUrl').value;
            
            // Basic validation
            if (!password || !apiUrl) {
                showError('Please fill in all fields');
                return;
            }
            
            // Clean API URL
            const cleanApiUrl = apiUrl.replace(/\/$/, '');
            
            // Show loading
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<div class="loader" style="width: 20px; height: 20px;"></div>';
            submitBtn.disabled = true;
            
            try {
                // Test API connection
                const response = await fetch(`${cleanApiUrl}/api/health`, {
                    timeout: 10000
                });
                
                if (!response.ok) {
                    throw new Error(`API returned ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error('API health check failed');
                }
                
                // For now, using simple password check
                // In production, this should validate against API
                if (password === 'admin123') {
                    // Store credentials
                    localStorage.setItem('adminAuthenticated', 'true');
                    localStorage.setItem('adminPassword', password);
                    localStorage.setItem('apiUrl', cleanApiUrl);
                    
                    // Show success message
                    showError('✅ Login successful! Redirecting...', 'success');
                    
                    // Redirect after delay
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                    
                } else {
                    throw new Error('Invalid password');
                }
                
            } catch (error) {
                showError(`Login failed: ${error.message}`);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    function showError(message, type = 'error') {
        errorMessage.querySelector('span').textContent = message;
        
        if (type === 'success') {
            errorMessage.style.background = 'rgba(16, 185, 129, 0.1)';
            errorMessage.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            errorMessage.style.color = '#065f46';
        } else {
            errorMessage.style.background = 'rgba(239, 68, 68, 0.1)';
            errorMessage.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            errorMessage.style.color = '#dc2626';
        }
        
        errorMessage.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    // Add fetch timeout
    const originalFetch = window.fetch;
    window.fetch = function(resource, options = {}) {
        const timeout = options.timeout || 8000;
        
        const controller = new AbortController();
        const { signal } = controller;
        
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        return originalFetch(resource, { ...options, signal })
            .finally(() => clearTimeout(timeoutId));
    };
    
    // Focus on password field
    document.getElementById('adminPassword')?.focus();
});
