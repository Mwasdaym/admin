require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const MAIN_API_URL = process.env.API_URL || 'https://chege-api.onrender.com';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || 'admin123';

// Security middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'chege-admin-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
    next();
};

// Serve static files
app.use(express.static('public'));

// ==================== ADMIN ROUTES ====================

// Login route
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        req.session.loginTime = new Date();
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// Logout route
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Check auth status
app.get('/api/admin/status', (req, res) => {
    res.json({ 
        authenticated: !!req.session.isAuthenticated,
        loginTime: req.session.loginTime 
    });
});

// ==================== API PROXY ROUTES ====================

// Proxy middleware to forward requests to main API
const proxyToMainAPI = async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const url = `${MAIN_API_URL}${req.originalUrl.replace('/api/proxy', '')}`;
        const method = req.method;
        
        const config = {
            method: method,
            url: url,
            headers: {
                'x-admin-api-key': ADMIN_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        };

        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            config.data = req.body;
        }

        const response = await axios(config);
        
        // Log successful API calls (for audit)
        console.log(`[${new Date().toISOString()}] API Proxy: ${method} ${url} - ${response.status}`);
        
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('API Proxy Error:', error.message);
        
        if (error.response) {
            // Main API returned an error
            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            // No response from main API
            res.status(503).json({ 
                success: false, 
                error: 'Main API is unreachable. Please try again later.' 
            });
        } else {
            // Other errors
            res.status(500).json({ 
                success: false, 
                error: 'Internal server error' 
            });
        }
    }
};

// Proxy routes (all go through authentication)
app.get('/api/proxy/*', requireAuth, proxyToMainAPI);
app.post('/api/proxy/*', requireAuth, proxyToMainAPI);
app.put('/api/proxy/*', requireAuth, proxyToMainAPI);
app.delete('/api/proxy/*', requireAuth, proxyToMainAPI);
app.patch('/api/proxy/*', requireAuth, proxyToMainAPI);

// ==================== ADMIN PANEL API ====================

// Get dashboard stats (aggregated from main API)
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
    try {
        // Get stats from main API
        const statsResponse = await axios.get(`${MAIN_API_URL}/api/accounts`, {
            headers: { 'x-admin-api-key': ADMIN_API_KEY }
        });

        const servicesResponse = await axios.get(`${MAIN_API_URL}/api/services`, {
            headers: { 'x-admin-api-key': ADMIN_API_KEY }
        });

        const availabilityResponse = await axios.get(`${MAIN_API_URL}/api/availability`, {
            headers: { 'x-admin-api-key': ADMIN_API_KEY }
        });

        // Aggregate data for dashboard
        const dashboardData = {
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                totalAccounts: statsResponse.data.totalAccounts || 0,
                totalServices: servicesResponse.data.count || 0,
                serviceStats: statsResponse.data.serviceStats || {},
                availability: availabilityResponse.data.availability || {}
            },
            recentActivity: [], // You can add activity tracking here
            systemInfo: {
                adminPanelVersion: '1.0.0',
                mainAPI: MAIN_API_URL,
                uptime: process.uptime()
            }
        };

        res.json(dashboardData);
    } catch (error) {
        console.error('Dashboard error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to load dashboard data' 
        });
    }
});

// Get all accounts with filtering
app.get('/api/admin/accounts/all', requireAuth, async (req, res) => {
    try {
        const response = await axios.get(`${MAIN_API_URL}/api/accounts`, {
            headers: { 'x-admin-api-key': ADMIN_API_KEY }
        });
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load accounts' });
    }
});

// Add new account (with validation)
app.post('/api/admin/accounts/add', requireAuth, async (req, res) => {
    try {
        const { service, email, password, username, notes } = req.body;
        
        // Validate input
        if (!service || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Service, email and password are required' 
            });
        }

        // Forward to main API
        const response = await axios.post(`${MAIN_API_URL}/api/accounts`, 
            { service, email, password, username, notes },
            { headers: { 'x-admin-api-key': ADMIN_API_KEY } }
        );

        // Log the addition
        console.log(`[${new Date().toISOString()}] New account added: ${service} - ${email}`);
        
        res.json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ success: false, error: 'Failed to add account' });
        }
    }
});

// Delete account
app.delete('/api/admin/accounts/:service/:id', requireAuth, async (req, res) => {
    try {
        const { service, id } = req.params;
        
        const response = await axios.delete(
            `${MAIN_API_URL}/api/accounts/${service}/${id}`,
            { headers: { 'x-admin-api-key': ADMIN_API_KEY } }
        );

        console.log(`[${new Date().toISOString()}] Account deleted: ${service} - ${id}`);
        
        res.json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ success: false, error: 'Failed to delete account' });
        }
    }
});

// Get all services
app.get('/api/admin/services', requireAuth, async (req, res) => {
    try {
        const response = await axios.get(`${MAIN_API_URL}/api/services`, {
            headers: { 'x-admin-api-key': ADMIN_API_KEY }
        });
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load services' });
    }
});

// Health check endpoint
app.get('/api/admin/health', (req, res) => {
    res.json({
        success: true,
        service: 'Chege Tech Admin Panel',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        authenticated: !!req.session.isAuthenticated
    });
});

// ==================== SERVE ADMIN PANEL ====================

// Serve admin panel (must be authenticated)
app.get('/admin*', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login page (no auth required)
app.get('/login', (req, res) => {
    if (req.session.isAuthenticated) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Redirect root to login
app.get('/', (req, res) => {
    if (req.session.isAuthenticated) {
        res.redirect('/admin');
    } else {
        res.redirect('/login');
    }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// 404 handler for all other routes
app.use('*', requireAuth, (req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ 
        success: false, 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Chege Tech Admin Panel started`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📡 Main API: ${MAIN_API_URL}`);
    console.log(`🔐 Admin authentication: ${ADMIN_PASSWORD ? 'Enabled' : 'Using default'}`);
    console.log(`🛡️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Ready to serve admin panel`);
});
