// ===== DASHBOARD FUNCTIONS =====

async function loadDashboard() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    // Create dashboard HTML structure
    contentArea.innerHTML = `
        <div class="dashboard-container">
            <!-- Stats Section -->
            <div class="stats-cards" id="statsCards">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-cube"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-title">Total Services</div>
                        <div class="stat-value" id="totalServices">0</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-title">Total Accounts</div>
                        <div class="stat-value" id="totalAccounts">0</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-plug"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-title">Available Slots</div>
                        <div class="stat-value" id="availableSlots">0</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-title">Used Slots</div>
                        <div class="stat-value" id="usedSlots">0</div>
                    </div>
                </div>
            </div>
            
            <!-- Service Status Section -->
            <div class="section">
                <h3><i class="fas fa-chart-line"></i> Service Status</h3>
                <div id="serviceStatus" class="service-status-container">
                    Loading services...
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div class="section">
                <h3><i class="fas fa-bolt"></i> Quick Actions</h3>
                <div class="quick-actions">
                    <button class="btn-primary" onclick="switchTab('add')">
                        <i class="fas fa-plus-circle"></i> Add New Account
                    </button>
                    <button class="btn-secondary" onclick="switchTab('accounts')">
                        <i class="fas fa-user-shield"></i> Manage Accounts
                    </button>
                    <button class="btn-secondary" onclick="window.location.href='transactions.html'">
                        <i class="fas fa-history"></i> View Transactions
                    </button>
                    <button class="btn-secondary" onclick="refreshDashboard()">
                        <i class="fas fa-redo"></i> Refresh Data
                    </button>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="section">
                <h3><i class="fas fa-history"></i> Recent Activity</h3>
                <div id="recentActivity">
                    Loading activity...
                </div>
            </div>
        </div>
    `;
    
    // Load all dashboard data
    await Promise.all([
        loadDashboardStats(),
        loadServiceStatus(),
        loadRecentActivity()
    ]);
}

async function loadDashboardStats() {
    try {
        // Load services count
        const servicesResponse = await apiRequest('/api/services');
        if (servicesResponse?.success) {
            document.getElementById('totalServices').textContent = servicesResponse.count || 0;
        }
        
        // Load accounts data
        const accountsResponse = await apiRequest('/api/accounts');
        if (accountsResponse?.success) {
            const totalAccounts = accountsResponse.totalAccounts || 0;
            document.getElementById('totalAccounts').textContent = totalAccounts;
            
            // Calculate slots
            let totalSlots = 0;
            let usedSlots = 0;
            
            if (accountsResponse.accounts) {
                Object.values(accountsResponse.accounts).forEach(serviceAccounts => {
                    serviceAccounts.forEach(account => {
                        totalSlots += account.maxUsers || 5;
                        usedSlots += account.currentUsers || 0;
                    });
                });
            }
            
            document.getElementById('availableSlots').textContent = totalSlots - usedSlots;
            document.getElementById('usedSlots').textContent = usedSlots;
        }
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showNotification('Failed to load dashboard statistics', 'error');
    }
}

async function loadServiceStatus() {
    try {
        const response = await apiRequest('/api/availability');
        const container = document.getElementById('serviceStatus');
        
        if (response?.success && response.availability) {
            let html = '<div class="service-list">';
            
            Object.entries(response.availability).forEach(([serviceId, data]) => {
                const statusClass = data.available ? 'status-available' : 'status-full';
                const statusText = data.available ? 'Available' : 'Out of Stock';
                const progress = data.totalSlots > 0 ? 
                    Math.round((data.usedSlots / data.totalSlots) * 100) : 0;
                
                html += `
                    <div class="service-item">
                        <div class="service-info">
                            <div class="service-name">${data.name}</div>
                            <div class="service-meta">
                                <span class="service-price">KES ${data.price}</span>
                                <span class="service-slots">${data.availableAccounts}/${data.totalAccounts} accounts</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                        <div class="service-status">
                            <span class="status-badge ${statusClass}">${statusText}</span>
                            <div class="service-actions">
                                <button class="btn-small" onclick="switchTab('add')" data-service="${serviceId}">
                                    <i class="fas fa-plus"></i> Add
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
            
            // Add click handlers for service buttons
            document.querySelectorAll('.btn-small[data-service]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const serviceId = this.getAttribute('data-service');
                    switchTab('add');
                    // You could also pre-select the service in the add form
                    setTimeout(() => {
                        const serviceSelect = document.getElementById('serviceSelect');
                        if (serviceSelect) {
                            serviceSelect.value = serviceId;
                        }
                    }, 100);
                });
            });
            
        } else {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load service status</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading service status:', error);
        document.getElementById('serviceStatus').innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading service status</p>
            </div>
        `;
    }
}

async function loadRecentActivity() {
    try {
        // For now, simulate recent activity
        // In production, fetch from API
        const container = document.getElementById('recentActivity');
        
        const activities = [
            { time: '2 min ago', action: 'New account added', service: 'Netflix', user: 'admin' },
            { time: '5 min ago', action: 'Payment received', service: 'Spotify', amount: 'KES 400' },
            { time: '10 min ago', action: 'Account deleted', service: 'Prime Video', user: 'admin' },
            { time: '15 min ago', action: 'New customer registered', service: 'YouTube Premium', email: 'user@example.com' },
            { time: '30 min ago', action: 'Account slot filled', service: 'Netflix', account: 'netflix5@gmail.com' }
        ];
        
        let html = '<div class="activity-list">';
        activities.forEach(activity => {
            const icon = activity.action.includes('added') ? 'fas fa-plus-circle success' :
                        activity.action.includes('received') ? 'fas fa-money-bill-wave success' :
                        activity.action.includes('deleted') ? 'fas fa-trash danger' :
                        activity.action.includes('registered') ? 'fas fa-user-plus info' :
                        'fas fa-info-circle';
            
            html += `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">
                            <strong>${activity.action}</strong> - ${activity.service}
                            ${activity.amount ? ` (${activity.amount})` : ''}
                        </div>
                        <div class="activity-time">${activity.time}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function refreshDashboard() {
    showNotification('Refreshing dashboard data...', 'info');
    loadDashboard();
}

// Add CSS for dashboard components
const dashboardStyles = document.createElement('style');
dashboardStyles.textContent = `
    .dashboard-container {
        display: flex;
        flex-direction: column;
        gap: 30px;
    }
    
    .service-status-container {
        margin-top: 20px;
    }
    
    .service-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .service-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background: #f8fafc;
        border-radius: 10px;
        border: 1px solid var(--border);
        transition: transform 0.2s;
    }
    
    .service-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    
    .service-info {
        flex: 1;
    }
    
    .service-name {
        font-weight: 600;
        font-size: 16px;
        color: var(--dark);
        margin-bottom: 5px;
    }
    
    .service-meta {
        display: flex;
        gap: 15px;
        font-size: 14px;
        color: var(--gray);
        margin-bottom: 10px;
    }
    
    .service-price {
        font-weight: 600;
    }
    
    .progress-bar {
        height: 6px;
        background: var(--border);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 10px;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
        border-radius: 3px;
        transition: width 0.3s ease;
    }
    
    .service-actions {
        margin-top: 10px;
    }
    
    .btn-small {
        padding: 6px 12px;
        font-size: 12px;
        border-radius: 6px;
        background: var(--primary);
        color: white;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    
    .btn-small:hover {
        background: var(--primary-dark);
    }
    
    .quick-actions {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
    }
    
    .activity-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .activity-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px;
        background: #f8fafc;
        border-radius: 10px;
        border: 1px solid var(--border);
    }
    
    .activity-icon {
        font-size: 20px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: white;
    }
    
    .activity-icon .success {
        color: var(--success);
    }
    
    .activity-icon .danger {
        color: var(--danger);
    }
    
    .activity-icon .info {
        color: var(--primary);
    }
    
    .activity-content {
        flex: 1;
    }
    
    .activity-text {
        font-size: 14px;
        color: var(--dark);
        margin-bottom: 5px;
    }
    
    .activity-time {
        font-size: 12px;
        color: var(--gray);
    }
    
    .error-state {
        text-align: center;
        padding: 40px;
        color: var(--gray);
    }
    
    .error-state i {
        font-size: 3rem;
        margin-bottom: 15px;
        color: var(--danger);
    }
`;
document.head.appendChild(dashboardStyles);
