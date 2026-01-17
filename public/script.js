// Configuration
const API_URL = 'https://chege-api.onrender.com';
let ADMIN_API_KEY = '';
let currentTab = 'dashboard';
let servicesData = [];
let accountsData = [];

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const adminPanel = document.getElementById('adminPanel');
const apiKeyInput = document.getElementById('apiKey');
const apiStatus = document.getElementById('apiStatus');
const updateTime = document.getElementById('updateTime');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if API key is saved in localStorage
    const savedKey = localStorage.getItem('chege_admin_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        login();
    }
    
    // Update time
    updateClock();
    setInterval(updateClock, 1000);
});

// Login Function
async function login() {
    const key = apiKeyInput.value.trim();
    
    if (!key) {
        showToast('Please enter API key', 'error');
        return;
    }
    
    showToast('Connecting to API...', 'info');
    
    try {
        // Test API connection
        const response = await fetch(`${API_URL}/api/health`, {
            headers: {
                'x-admin-api-key': key
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            ADMIN_API_KEY = key;
            localStorage.setItem('chege_admin_api_key', key);
            
            // Switch to admin panel
            loginScreen.style.display = 'none';
            adminPanel.style.display = 'flex';
            
            showToast('Login successful!', 'success');
            apiStatus.innerHTML = '<i class="fas fa-circle"></i> API Connected';
            apiStatus.className = 'status online';
            
            // Load initial data
            await loadServices();
            await loadStats();
            await loadAccounts();
            populateServiceSelects();
        } else {
            showToast('Invalid API key or API error', 'error');
        }
    } catch (error) {
        showToast('Failed to connect to API', 'error');
        apiStatus.innerHTML = '<i class="fas fa-circle"></i> API Offline';
        apiStatus.className = 'status offline';
    }
}

// Logout Function
function logout() {
    ADMIN_API_KEY = '';
    localStorage.removeItem('chege_admin_api_key');
    adminPanel.style.display = 'none';
    loginScreen.style.display = 'flex';
    showToast('Logged out successfully', 'info');
}

// Tab Navigation
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked tab
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.textContent.includes(getTabName(tabName))) {
            tab.classList.add('active');
        }
    });
    
    currentTab = tabName;
    
    // Load data for the tab
    switch(tabName) {
        case 'dashboard':
            loadStats();
            break;
        case 'accounts':
            loadAccounts();
            break;
        case 'services':
            loadServices();
            break;
    }
}

function getTabName(tabId) {
    const names = {
        'dashboard': 'Dashboard',
        'accounts': 'Accounts',
        'addAccount': 'Add Account',
        'services': 'Services'
    };
    return names[tabId] || tabId;
}

// Load Services
async function loadServices() {
    try {
        const response = await fetch(`${API_URL}/api/services`, {
            headers: {
                'x-admin-api-key': ADMIN_API_KEY
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            servicesData = data.services;
            updateServicesDisplay();
        }
    } catch (error) {
        console.error('Failed to load services:', error);
    }
}

// Load Stats
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/api/accounts`, {
            headers: {
                'x-admin-api-key': ADMIN_API_KEY
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateStatsDisplay(data);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load Accounts
async function loadAccounts() {
    try {
        const response = await fetch(`${API_URL}/api/accounts`, {
            headers: {
                'x-admin-api-key': ADMIN_API_KEY
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            accountsData = data.accounts;
            updateAccountsDisplay();
        }
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

// Populate Service Selects
function populateServiceSelects() {
    const serviceSelect = document.getElementById('service');
    const filterService = document.getElementById('filterService');
    
    // Clear existing options except first
    while (serviceSelect.options.length > 1) serviceSelect.remove(1);
    while (filterService.options.length > 1) filterService.remove(1);
    
    // Add service options
    servicesData.forEach(service => {
        const option1 = document.createElement('option');
        option1.value = service.id;
        option1.textContent = `${service.name} (KES ${service.price})`;
        serviceSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = service.id;
        option2.textContent = service.name;
        filterService.appendChild(option2);
    });
}

// Update Stats Display
function updateStatsDisplay(data) {
    const statsGrid = document.getElementById('statsGrid');
    
    let html = `
        <div class="stat-card">
            <i class="fas fa-layer-group"></i>
            <div class="stat-value">${data.totalAccounts || 0}</div>
            <div class="stat-label">Total Accounts</div>
        </div>
        
        <div class="stat-card">
            <i class="fas fa-stream"></i>
            <div class="stat-value">${data.services || 0}</div>
            <div class="stat-label">Services</div>
        </div>
    `;
    
    // Add service-specific stats
    if (data.serviceStats) {
        Object.entries(data.serviceStats).forEach(([service, stats]) => {
            html += `
                <div class="stat-card">
                    <i class="fas fa-tv"></i>
                    <div class="stat-value">${stats.count}</div>
                    <div class="stat-label">${stats.name} Accounts</div>
                    <div style="font-size: 12px; color: #28a745; margin-top: 5px;">
                        ${stats.available} available
                    </div>
                </div>
            `;
        });
    }
    
    statsGrid.innerHTML = html;
}

// Update Accounts Display
function updateAccountsDisplay() {
    const accountsList = document.getElementById('accountsList');
    
    if (!accountsData || Object.keys(accountsData).length === 0) {
        accountsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash fa-3x"></i>
                <h3>No Accounts Found</h3>
                <p>Add your first account to get started</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    Object.entries(accountsData).forEach(([service, accounts]) => {
        if (accounts.length > 0) {
            html += `<h3 style="margin: 20px 0 10px; color: #4361ee;">${service.toUpperCase()}</h3>`;
            
            accounts.forEach(account => {
                const isAvailable = !account.fullyUsed && (account.currentUsers || 0) < (account.maxUsers || 5);
                
                html += `
                    <div class="account-card">
                        <div class="account-info">
                            <h3>${account.email || account.username || 'No email'}</h3>
                            <p><i class="fas fa-user"></i> ${account.username || 'No username'}</p>
                            <p><i class="fas fa-users"></i> Users: ${account.currentUsers || 0}/${account.maxUsers || 5}</p>
                            <p><i class="fas fa-calendar"></i> Added: ${new Date(account.addedAt).toLocaleDateString()}</p>
                            <span class="account-status ${isAvailable ? 'status-available' : 'status-full'}">
                                ${isAvailable ? 'Available' : 'Fully Used'}
                            </span>
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-sm btn-warning" onclick="editAccount('${account.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteAccount('${account.id}', '${service}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }
    });
    
    accountsList.innerHTML = html || `
        <div class="empty-state">
            <i class="fas fa-users-slash fa-3x"></i>
            <h3>No Accounts Found</h3>
            <p>Add your first account to get started</p>
        </div>
    `;
}

// Update Services Display
function updateServicesDisplay() {
    const servicesList = document.getElementById('servicesList');
    
    let html = '';
    
    servicesData.forEach(service => {
        const stats = accountsData[service.id] || [];
        const available = stats.filter(acc => !acc.fullyUsed && (acc.currentUsers || 0) < (acc.maxUsers || 5)).length;
        const total = stats.length;
        
        html += `
            <div class="service-card">
                <div class="service-header">
                    <div class="service-icon" style="background: #4361ee;">
                        <i class="fas fa-tv"></i>
                    </div>
                    <div>
                        <div class="service-name">${service.name}</div>
                        <div class="service-price">KES ${service.price}</div>
                    </div>
                </div>
                <div class="service-stats">
                    <div class="stat">
                        <div class="stat-value">${total}</div>
                        <div class="stat-label">Total</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${available}</div>
                        <div class="stat-label">Available</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${total - available}</div>
                        <div class="stat-label">Used</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="showTab('addAccount'); document.getElementById('service').value='${service.id}';" style="margin-top: 15px; width: 100%;">
                    <i class="fas fa-plus"></i> Add Account
                </button>
            </div>
        `;
    });
    
    servicesList.innerHTML = html;
}

// Add Account Form
document.getElementById('addAccountForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const service = document.getElementById('service').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    const notes = document.getElementById('notes').value;
    
    if (!service || !email || !password) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const accountData = {
        service,
        email,
        password,
        username: username || undefined,
        notes: notes || undefined
    };
    
    try {
        showToast('Adding account...', 'info');
        
        const response = await fetch(`${API_URL}/api/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-api-key': ADMIN_API_KEY
            },
            body: JSON.stringify(accountData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Account added to ${data.account.serviceName}`, 'success');
            resetForm();
            
            // Refresh data
            await loadStats();
            await loadAccounts();
            
            // Switch to accounts tab
            showTab('accounts');
        } else {
            showToast(data.error || 'Failed to add account', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
});

// Delete Account
async function deleteAccount(accountId, service) {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        return;
    }
    
    try {
        showToast('Deleting account...', 'info');
        
        const response = await fetch(`${API_URL}/api/accounts/${service}/${accountId}`, {
            method: 'DELETE',
            headers: {
                'x-admin-api-key': ADMIN_API_KEY
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Account deleted successfully', 'success');
            
            // Refresh data
            await loadStats();
            await loadAccounts();
            await loadServices();
        } else {
            showToast(data.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

// Edit Account (placeholder - you need to implement edit functionality)
function editAccount(accountId) {
    showToast('Edit feature coming soon!', 'info');
    // You'll need to implement edit functionality based on your API
}

// Search Accounts
function searchAccounts() {
    const searchTerm = document.getElementById('searchAccounts').value.toLowerCase();
    const accountCards = document.querySelectorAll('.account-card');
    
    accountCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Filter Accounts by Service
function filterAccounts() {
    const selectedService = document.getElementById('filterService').value;
    const serviceHeaders = document.querySelectorAll('#accountsList h3');
    const accountCards = document.querySelectorAll('.account-card');
    
    if (!selectedService) {
        // Show all
        serviceHeaders.forEach(header => header.style.display = 'block');
        accountCards.forEach(card => card.style.display = 'flex');
        return;
    }
    
    // Hide all first
    serviceHeaders.forEach(header => header.style.display = 'none');
    accountCards.forEach(card => card.style.display = 'none');
    
    // Show only selected service
    const serviceHeader = document.querySelector(`#accountsList h3:nth-child(${Array.from(serviceHeaders).findIndex(h => h.textContent.includes(selectedService.toUpperCase())) + 1})`);
    if (serviceHeader) {
        serviceHeader.style.display = 'block';
        
        // Show accounts under this service
        let nextElement = serviceHeader.nextElementSibling;
        while (nextElement && !nextElement.matches('h3')) {
            if (nextElement.matches('.account-card')) {
                nextElement.style.display = 'flex';
            }
            nextElement = nextElement.nextElementSibling;
        }
    }
}

// Refresh Data
async function refreshData() {
    showToast('Refreshing data...', 'info');
    await loadServices();
    await loadStats();
    await loadAccounts();
    showToast('Data refreshed!', 'success');
}

// Reset Form
function resetForm() {
    document.getElementById('addAccountForm').reset();
}

// Update Clock
function updateClock() {
    const now = new Date();
    updateTime.textContent = now.toLocaleTimeString();
}

// Toast Notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        showTab,
        loadServices,
        loadStats,
        loadAccounts
    };
}
