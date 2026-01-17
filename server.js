require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database file
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

// ===== ACCOUNT MANAGEMENT =====
function loadAccounts() {
    try {
        if (fs.existsSync(ACCOUNTS_FILE)) {
            return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
        }
        return {};
    } catch (error) {
        console.error('Error loading accounts:', error);
        return {};
    }
}

function saveAccounts(accounts) {
    try {
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving accounts:', error);
        return false;
    }
}

// Initialize empty accounts file if not exists
if (!fs.existsSync(ACCOUNTS_FILE)) {
    saveAccounts({});
}

// ===== AUTHENTICATION MIDDLEWARE =====
function authenticateAdmin(req, res, next) {
    const adminPassword = req.headers['admin-password'] || req.query.password;
    
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Invalid admin password.'
        });
    }
    next();
}

// ===== ROUTES =====

// Serve admin pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/transactions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'transactions.html'));
});

// ===== API ENDPOINTS =====

// 1. Health check
app.get('/api/health', (req, res) => {
    const accounts = loadAccounts();
    let totalAccounts = 0;
    
    Object.values(accounts).forEach(serviceAccounts => {
        totalAccounts += serviceAccounts.length;
    });
    
    res.json({
        success: true,
        message: 'Admin API is running',
        services: Object.keys(accounts).length,
        totalAccounts: totalAccounts,
        timestamp: new Date().toISOString()
    });
});

// 2. Get all accounts (Admin only)
app.get('/api/admin/accounts', authenticateAdmin, (req, res) => {
    try {
        const accounts = loadAccounts();
        let totalAccounts = 0;
        let serviceStats = {};
        
        Object.entries(accounts).forEach(([service, serviceAccounts]) => {
            serviceStats[service] = {
                count: serviceAccounts.length,
                available: serviceAccounts.filter(acc => !acc.fullyUsed).length
            };
            totalAccounts += serviceAccounts.length;
        });
        
        res.json({
            success: true,
            totalAccounts: totalAccounts,
            services: Object.keys(accounts).length,
            serviceStats: serviceStats,
            accounts: accounts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load accounts'
        });
    }
});

// 3. Add new account (Admin only)
app.post('/api/admin/accounts', authenticateAdmin, (req, res) => {
    try {
        const { service, email, password, username, notes } = req.body;
        
        if (!service || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Service, email and password are required'
            });
        }
        
        const accounts = loadAccounts();
        
        // Generate unique ID
        const accountId = `${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newAccount = {
            id: accountId,
            email: email,
            password: password,
            username: username || email.split('@')[0],
            service: service,
            serviceName: service, // You can map this to proper names
            currentUsers: 0,
            maxUsers: 5,
            fullyUsed: false,
            notes: notes || '',
            addedAt: new Date().toISOString(),
            usedBy: []
        };
        
        if (!accounts[service]) {
            accounts[service] = [];
        }
        
        accounts[service].push(newAccount);
        saveAccounts(accounts);
        
        res.json({
            success: true,
            message: `Account added to ${service}`,
            account: newAccount
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to add account'
        });
    }
});

// 4. Delete account (Admin only)
app.delete('/api/admin/accounts/:service/:accountId', authenticateAdmin, (req, res) => {
    try {
        const { service, accountId } = req.params;
        const accounts = loadAccounts();
        
        if (!accounts[service]) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }
        
        const accountIndex = accounts[service].findIndex(acc => acc.id === accountId);
        
        if (accountIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }
        
        const removedAccount = accounts[service].splice(accountIndex, 1)[0];
        saveAccounts(accounts);
        
        res.json({
            success: true,
            message: 'Account removed successfully',
            removedAccount: removedAccount
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to remove account'
        });
    }
});

// 5. Get account availability
app.get('/api/availability', (req, res) => {
    try {
        const accounts = loadAccounts();
        const availability = {};
        
        // Define service names and prices
        const SERVICES = {
            netflix: { name: 'Netflix', price: 150 },
            spotify: { name: 'Spotify Premium', price: 400 },
            primevideo: { name: 'Prime Video', price: 100 },
            showmax_1m: { name: 'Showmax Pro', price: 100 },
            youtubepremium: { name: 'YouTube Premium', price: 100 },
            applemusic: { name: 'Apple Music', price: 250 },
            canva: { name: 'Canva Pro', price: 300 },
            urbanvpn: { name: 'Urban VPN', price: 100 }
        };
        
        Object.keys(SERVICES).forEach(service => {
            const serviceAccounts = accounts[service] || [];
            const availableAccounts = serviceAccounts.filter(acc => !acc.fullyUsed);
            const totalSlots = serviceAccounts.reduce((sum, acc) => sum + (acc.maxUsers || 5), 0);
            const usedSlots = serviceAccounts.reduce((sum, acc) => sum + (acc.currentUsers || 0), 0);
            
            availability[service] = {
                name: SERVICES[service].name,
                price: SERVICES[service].price,
                available: availableAccounts.length > 0,
                availableAccounts: availableAccounts.length,
                totalAccounts: serviceAccounts.length,
                usedSlots: usedSlots,
                totalSlots: totalSlots,
                availableSlots: totalSlots - usedSlots
            };
        });
        
        res.json({
            success: true,
            availability: availability
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get availability'
        });
    }
});

// 6. Get all services
app.get('/api/services', (req, res) => {
    const SERVICES = [
        { id: 'netflix', name: 'Netflix', price: 150 },
        { id: 'spotify', name: 'Spotify Premium', price: 400 },
        { id: 'primevideo', name: 'Prime Video', price: 100 },
        { id: 'showmax_1m', name: 'Showmax Pro (1 Month)', price: 100 },
        { id: 'showmax_3m', name: 'Showmax Pro (3 Months)', price: 250 },
        { id: 'showmax_6m', name: 'Showmax Pro (6 Months)', price: 500 },
        { id: 'showmax_1y', name: 'Showmax Pro (1 Year)', price: 900 },
        { id: 'youtubepremium', name: 'YouTube Premium', price: 100 },
        { id: 'applemusic', name: 'Apple Music', price: 250 },
        { id: 'canva', name: 'Canva Pro', price: 300 },
        { id: 'grammarly', name: 'Grammarly Premium', price: 250 },
        { id: 'urbanvpn', name: 'Urban VPN', price: 100 },
        { id: 'nordvpn', name: 'NordVPN', price: 350 },
        { id: 'xbox', name: 'Xbox Game Pass', price: 400 },
        { id: 'playstation', name: 'PlayStation Plus', price: 400 },
        { id: 'deezer', name: 'Deezer Premium', price: 200 },
        { id: 'tidal', name: 'Tidal HiFi', price: 250 },
        { id: 'soundcloud', name: 'SoundCloud Go+', price: 150 },
        { id: 'audible', name: 'Audible Premium Plus', price: 400 },
        { id: 'skillshare', name: 'Skillshare Premium', price: 350 },
        { id: 'masterclass', name: 'MasterClass', price: 600 },
        { id: 'duolingo', name: 'Duolingo Super', price: 150 },
        { id: 'notion', name: 'Notion Plus', price: 200 },
        { id: 'microsoft365', name: 'Microsoft 365', price: 500 },
        { id: 'googleone', name: 'Google One', price: 250 },
        { id: 'adobecc', name: 'Adobe Creative Cloud', price: 700 },
        { id: 'expressvpn', name: 'ExpressVPN', price: 400 },
        { id: 'surfshark', name: 'Surfshark VPN', price: 200 },
        { id: 'cyberghost', name: 'CyberGhost VPN', price: 250 },
        { id: 'ipvanish', name: 'IPVanish', price: 200 },
        { id: 'protonvpn', name: 'ProtonVPN Plus', price: 300 },
        { id: 'windscribe', name: 'Windscribe Pro', price: 150 },
        { id: 'eaplay', name: 'EA Play', price: 250 },
        { id: 'ubisoft', name: 'Ubisoft+', price: 300 },
        { id: 'geforcenow', name: 'Nvidia GeForce Now', price: 350 },
        { id: 'peacock_tv', name: 'Peacock TV', price: 50 }
    ];
    
    res.json({
        success: true,
        count: SERVICES.length,
        services: SERVICES
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Chege Tech Admin Panel running on port ${PORT}`);
    console.log(`📡 Admin Login: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`💰 Transactions: http://localhost:${PORT}/transactions`);
    console.log(`🔑 Admin Password: ${process.env.ADMIN_PASSWORD ? 'Set' : 'Not set'}`);
});
