// ===== ACCOUNT MANAGEMENT FUNCTIONS =====

async function loadAccounts() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="accounts-container">
            <div class="section">
                <div class="section-header">
                    <h3><i class="fas fa-user-shield"></i> Manage Accounts</h3>
                    <div class="section-actions">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="accountSearch" placeholder="Search accounts...">
                        </div>
                        <select id="serviceFilter">
                            <option value="all">All Services</option>
                        </select>
                        <select id="statusFilter">
                            <option value="all">All Status</option>
                            <option value="available">Available</option>
                            <option value="full">Full</option>
                        </select>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Email/Username</th>
                                <th>Users</th>
                                <th>Status</th>
                                <th>Added</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="accountsTableBody">
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 40px;">
                                    <div class="loader"></div>
                                    <p>Loading accounts...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="table-footer">
                    <div class="table-info" id="tableInfo">
                        Loading...
                    </div>
                    <div class="table-pagination">
                        <button class="btn-small" id="prevPage" disabled>Previous</button>
                        <span id="pageInfo">Page 1 of 1</span>
                        <button class="btn-small" id="nextPage" disabled>Next</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize filters and load data
    await initializeAccountFilters();
    await loadAccountData();
    setupAccountSearch();
    setupPagination();
}

let allAccounts = [];
let filteredAccounts = [];
let currentPage = 1;
const accountsPerPage = 10;

async function initializeAccountFilters() {
    try {
        // Load services for filter dropdown
        const response = await apiRequest('/api/services');
        const serviceFilter = document.getElementById('serviceFilter');
        
        if (response?.success && response.services) {
            response.services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                serviceFilter.appendChild(option);
            });
        }
        
        // Add filter change listeners
        serviceFilter.addEventListener('change', filterAccounts);
        document.getElementById('statusFilter').addEventListener('change', filterAccounts);
        
    } catch (error) {
        console.error('Error initializing filters:', error);
    }
}

async function loadAccountData() {
    try {
        const response = await apiRequest('/api/accounts');
        
        if (response?.success && response.accounts) {
            // Flatten accounts array
            allAccounts = [];
            Object.entries(response.accounts).forEach(([service, accounts]) => {
                accounts.forEach(account => {
                    allAccounts.push({
                        ...account,
                        serviceId: service,
                        serviceName: account.serviceName || service
                    });
                });
            });
            
            // Initial filter (show all)
            filteredAccounts = [...allAccounts];
            
            // Update table
            updateAccountsTable();
            updateTableInfo();
            
        } else {
            throw new Error('Failed to load accounts');
        }
        
    } catch (error) {
        console.error('Error loading accounts:', error);
        showNotification('Failed to load accounts', 'error');
        document.getElementById('accountsTableBody').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading accounts</p>
                </td>
            </tr>
        `;
    }
}

function filterAccounts() {
    const serviceFilter = document.getElementById('serviceFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredAccounts = allAccounts.filter(account => {
        // Filter by service
        if (serviceFilter !== 'all' && account.serviceId !== serviceFilter) {
            return false;
        }
        
        // Filter by status
        if (statusFilter !== 'all') {
            if (statusFilter === 'available' && account.fullyUsed) return false;
            if (statusFilter === 'full' && !account.fullyUsed) return false;
        }
        
        return true;
    });
    
    currentPage = 1;
    updateAccountsTable();
    updateTableInfo();
    updatePagination();
}

function setupAccountSearch() {
    const searchInput = document.getElementById('accountSearch');
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm) {
                filteredAccounts = allAccounts.filter(account => 
                    account.email.toLowerCase().includes(searchTerm) ||
                    (account.username && account.username.toLowerCase().includes(searchTerm)) ||
                    account.serviceName.toLowerCase().includes(searchTerm) ||
                    account.id.toLowerCase().includes(searchTerm)
                );
            } else {
                filterAccounts(); // Reset to filtered view
            }
            
            currentPage = 1;
            updateAccountsTable();
            updateTableInfo();
            updatePagination();
        }, 300);
    });
}

function updateAccountsTable() {
    const tbody = document.getElementById('accountsTableBody');
    
    if (filteredAccounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--gray);">
                    <i class="fas fa-inbox"></i>
                    <p>No accounts found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * accountsPerPage;
    const endIndex = startIndex + accountsPerPage;
    const pageAccounts = filteredAccounts.slice(startIndex, endIndex);
    
    let html = '';
    pageAccounts.forEach(account => {
        const statusClass = account.fullyUsed ? 'status-full' : 'status-available';
        const statusText = account.fullyUsed ? 'Full' : 'Available';
        const addedDate = new Date(account.addedAt).toLocaleDateString();
        const currentUsers = account.currentUsers || 0;
        const maxUsers = account.maxUsers || 5;
        
        html += `
            <tr>
                <td>
                    <div class="service-cell">
                        <strong>${account.serviceName}</strong>
                        <small class="account-id">${account.id}</small>
                    </div>
                </td>
                <td>
                    <div class="account-email">${account.email}</div>
                    ${account.username ? `<small class="account-username">${account.username}</small>` : ''}
                </td>
                <td>
                    <div class="user-count">${currentUsers}/${maxUsers}</div>
                    <div class="progress-bar" style="margin-top: 5px;">
                        <div class="progress-fill" style="width: ${(currentUsers / maxUsers) * 100}%"></div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>${addedDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-view" onclick="viewAccount('${account.serviceId}', '${account.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-edit" onclick="editAccount('${account.serviceId}', '${account.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="deleteAccount('${account.serviceId}', '${account.id}', '${account.email}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function updateTableInfo() {
    const total = filteredAccounts.length;
    const start = Math.min((currentPage - 1) * accountsPerPage + 1, total);
    const end = Math.min(currentPage * accountsPerPage, total);
    
    document.getElementById('tableInfo').textContent = 
        total === 0 ? 'No accounts' : 
        `Showing ${start}-${end} of ${total} accounts`;
}

function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateAccountsTable();
            updateTableInfo();
            updatePagination();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateAccountsTable();
            updateTableInfo();
            updatePagination();
        }
    });
}

function updatePagination() {
    const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    pageInfo.textContent = totalPages === 0 ? 'No pages' : `Page ${currentPage} of ${totalPages}`;
}

// Account Actions
function viewAccount(serviceId, accountId) {
    // Find account
    const account = allAccounts.find(acc => 
        acc.serviceId === serviceId && acc.id === accountId
    );
    
    if (account) {
        openModal('viewAccountModal');
        // You would populate modal with account details here
        showNotification(`Viewing account: ${account.email}`, 'info');
    }
}

function editAccount(serviceId, accountId) {
    // Find account
    const account = allAccounts.find(acc => 
        acc.serviceId === serviceId && acc.id === accountId
    );
    
    if (account) {
        showNotification(`Edit feature coming soon for: ${account.email}`, 'info');
        // You would open edit modal here
    }
}

function deleteAccount(serviceId, accountId, email) {
    const confirmDelete = confirm(`Are you sure you want to delete account: ${email}?\n\nThis action cannot be undone.`);
    
    if (confirmDelete) {
        // Show loading
        showNotification(`Deleting account: ${email}...`, 'info');
        
        // Simulate API call (you'll replace this with actual API)
        setTimeout(() => {
            // Remove from local array
            allAccounts = allAccounts.filter(acc => 
                !(acc.serviceId === serviceId && acc.id === accountId)
            );
            
            // Update filtered array
            filterAccounts();
            
            showNotification(`Account ${email} deleted successfully`, 'success');
        }, 1000);
    }
}

// Add CSS for accounts management
const accountsStyles = document.createElement('style');
accountsStyles.textContent = `
    .accounts-container {
        display: flex;
        flex-direction: column;
        gap: 30px;
    }
    
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 15px;
    }
    
    .section-actions {
        display: flex;
        gap: 15px;
        align-items: center;
    }
    
    .search-box {
        position: relative;
        display: flex;
        align-items: center;
    }
    
    .search-box i {
        position: absolute;
        left: 12px;
        color: var(--gray);
    }
    
    .search-box input {
        padding: 10px 15px 10px 40px;
        border: 2px solid var(--border);
        border-radius: 8px;
        width: 250px;
    }
    
    .search-box input:focus {
        outline: none;
        border-color: var(--primary);
    }
    
    .service-cell {
        display: flex;
        flex-direction: column;
    }
    
    .account-id {
        font-size: 11px;
        color: var(--gray);
        margin-top: 2px;
        font-family: monospace;
    }
    
    .account-email {
        font-weight: 500;
        margin-bottom: 2px;
    }
    
    .account-username {
        font-size: 12px;
        color: var(--gray);
    }
    
    .user-count {
        font-weight: 600;
        color: var(--dark);
    }
    
    .action-buttons {
        display: flex;
        gap: 5px;
    }
    
    .btn-action {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .btn-view {
        background: #3b82f6;
        color: white;
    }
    
    .btn-view:hover {
        background: #2563eb;
    }
    
    .btn-edit {
        background: #f59e0b;
        color: white;
    }
    
    .btn-edit:hover {
        background: #d97706;
    }
    
    .btn-delete {
        background: #ef4444;
        color: white;
    }
    
    .btn-delete:hover {
        background: #dc2626;
    }
    
    .table-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
    }
    
    .table-info {
        color: var(--gray);
        font-size: 14px;
    }
    
    .table-pagination {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .table-pagination button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
document.head.appendChild(accountsStyles);
