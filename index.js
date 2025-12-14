import 'dotenv/config';
import { Client, RichPresence } from 'discord.js-selfbot-v13';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Discord Client
const client = new Client({
    checkUpdate: false
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Config paths
const CONFIG_PATH = path.join(__dirname, 'database');
const CONFIG_FILE = path.join(CONFIG_PATH, 'rpcConfig.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(CONFIG_PATH, { recursive: true });
}

// Default config
const defaultConfig = {
    enabled: false,
    applicationId: null,
    type: 'PLAYING',
    name: 'Custom Status',
    details: null,
    state: null,
    largeImageKey: null,
    largeImageText: null,
    smallImageKey: null,
    smallImageText: null,
    button1Text: null,
    button1Url: null,
    button2Text: null,
    button2Url: null,
    startTimestamp: false,
    partySize: null,
    partyMax: null
};

// Valid activity types
const VALID_TYPES = ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING'];

// Load config
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            return { ...defaultConfig, ...config };
        }
    } catch (error) {
        console.error('[CONFIG] Error loading RPC config:', error);
    }
    return { ...defaultConfig };
}

// Save config
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log('[CONFIG] Configuration saved successfully');
    } catch (error) {
        console.error('[CONFIG] Error saving RPC config:', error);
        throw error;
    }
}

// Set Rich Presence using RichPresence class
async function setRichPresence(config) {
    try {
        if (!client.user) {
            throw new Error('Client is not ready');
        }

        if (!config.enabled) {
            await client.user.setPresence({
                activities: [],
                status: 'online'
            });
            console.log('[RPC] Rich Presence cleared');
            return { success: true, message: 'RPC cleared' };
        }

        if (!config.applicationId || !config.name) {
            throw new Error('Application ID and name are required');
        }

        // Create RichPresence instance
        const rpc = new RichPresence(client)
            .setApplicationId(config.applicationId)
            .setType(config.type || 'PLAYING')
            .setName(config.name);

        // Add URL for STREAMING type
        if (config.type === 'STREAMING') {
            rpc.setURL('https://twitch.tv/discord');
        }

        // Add details and state
        if (config.details) rpc.setDetails(config.details);
        if (config.state) rpc.setState(config.state);

        // Add large image (asset key or URL)
        if (config.largeImageKey) {
            rpc.setAssetsLargeImage(config.largeImageKey);
            if (config.largeImageText) {
                rpc.setAssetsLargeText(config.largeImageText);
            }
        }

        // Add small image (asset key or URL)
        if (config.smallImageKey) {
            rpc.setAssetsSmallImage(config.smallImageKey);
            if (config.smallImageText) {
                rpc.setAssetsSmallText(config.smallImageText);
            }
        }

        // Add buttons (max 2)
        if (config.button1Text && config.button1Url) {
            rpc.addButton(config.button1Text, config.button1Url);
        }
        if (config.button2Text && config.button2Url) {
            rpc.addButton(config.button2Text, config.button2Url);
        }

        // Add party info
        if (config.partySize && config.partyMax) {
            rpc.setParty({
                max: parseInt(config.partyMax),
                current: parseInt(config.partySize),
                id: client.user.id
            });
        }

        // Add timestamp
        if (config.startTimestamp) {
            rpc.setStartTimestamp(Date.now());
        }

        // Set the activity
        await client.user.setActivity(rpc);

        console.log(`[RPC] Rich Presence set: ${config.type} ${config.name}`);
        console.log('[RPC] Details:', {
            applicationId: config.applicationId,
            name: config.name,
            type: config.type,
            hasImages: !!(config.largeImageKey || config.smallImageKey),
            hasButtons: !!(config.button1Text || config.button2Text)
        });
        
        return { success: true, message: 'RPC applied successfully' };

    } catch (error) {
        console.error('[RPC] Error setting presence:', error);
        throw error;
    }
}

// Clear Rich Presence
async function clearRichPresence() {
    try {
        if (!client.user) {
            throw new Error('Client is not ready');
        }

        await client.user.setPresence({
            activities: [],
            status: 'online'
        });

        console.log('[RPC] Rich Presence cleared');
        return { success: true, message: 'RPC cleared' };
    } catch (error) {
        console.error('[RPC] Error clearing presence:', error);
        throw error;
    }
}

// Fetch application assets
async function fetchApplicationAssets(applicationId) {
    try {
        const bot = await client.users.fetch(applicationId);
        if (bot.application) {
            const assets = await bot.application.fetchAssets();
            return assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                type: asset.type
            }));
        }
        return [];
    } catch (error) {
        console.error('[ASSETS] Error fetching assets:', error);
        return [];
    }
}

// Discord Client Events
client.on('ready', async () => {
    console.log('╔═══════════════════════════════════════╗');
    console.log(`║  ✅ Logged in as: ${client.user.tag.padEnd(20)} ║`);
    console.log(`║  🆔 User ID: ${client.user.id.padEnd(24)} ║`);
    console.log('╚═══════════════════════════════════════╝');
    
    // Initialize RPC from saved config
    const config = loadConfig();
    if (config.enabled && config.applicationId) {
        try {
            await setRichPresence(config);
            console.log('[RPC] Initialized from saved configuration');
        } catch (error) {
            console.error('[RPC] Failed to initialize:', error.message);
        }
    }
});

client.on('error', (error) => {
    console.error('[CLIENT] Error:', error);
});

client.on('warn', (warn) => {
    console.warn('[CLIENT] Warning:', warn);
});

// Express Routes

// Dashboard home
app.get('/', (req, res) => {
    try {
        const config = loadConfig();
        const botReady = client.user ? true : false;
        const username = client.user?.tag || 'Not Connected';
        const userId = client.user?.id || 'N/A';
        const avatar = client.user?.displayAvatarURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        res.render('index', { 
            config, 
            botReady, 
            username,
            userId,
            avatar,
            validTypes: VALID_TYPES
        });
    } catch (error) {
        console.error('[ROUTE] Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Get current config
app.get('/api/config', (req, res) => {
    try {
        const config = loadConfig();
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update config
app.post('/api/config', async (req, res) => {
    try {
        const newConfig = { ...loadConfig(), ...req.body };
        
        // Validate type
        if (newConfig.type && !VALID_TYPES.includes(newConfig.type)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` 
            });
        }

        // Clean up empty strings to null
        Object.keys(newConfig).forEach(key => {
            if (newConfig[key] === '') {
                newConfig[key] = null;
            }
        });

        saveConfig(newConfig);
        
        if (newConfig.enabled && client.user) {
            await setRichPresence(newConfig);
            res.json({ success: true, message: 'Config saved and RPC updated!' });
        } else {
            res.json({ success: true, message: 'Config saved!' });
        }
    } catch (error) {
        console.error('[API] Error updating config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Start RPC
app.post('/api/start', async (req, res) => {
    try {
        if (!client.user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot is not connected to Discord!' 
            });
        }

        const config = loadConfig();
        
        if (!config.applicationId || !config.name) {
            return res.status(400).json({
                success: false,
                message: 'Please configure Application ID and activity name first!'
            });
        }

        config.enabled = true;
        saveConfig(config);
        
        await setRichPresence(config);
        res.json({ success: true, message: 'RPC started successfully!' });
    } catch (error) {
        console.error('[API] Error starting RPC:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Stop RPC
app.post('/api/stop', async (req, res) => {
    try {
        if (!client.user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot is not connected to Discord!' 
            });
        }

        const config = loadConfig();
        config.enabled = false;
        saveConfig(config);
        
        await clearRichPresence();
        res.json({ success: true, message: 'RPC stopped successfully!' });
    } catch (error) {
        console.error('[API] Error stopping RPC:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get bot status
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        connected: client.user ? true : false,
        user: client.user ? {
            tag: client.user.tag,
            id: client.user.id,
            avatar: client.user.displayAvatarURL({ dynamic: true, size: 256 })
        } : null,
        config: loadConfig()
    });
});

// Fetch assets for an application
app.get('/api/assets/:applicationId', async (req, res) => {
    try {
        if (!client.user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot is not connected to Discord!' 
            });
        }

        const { applicationId } = req.params;
        const assets = await fetchApplicationAssets(applicationId);
        
        res.json({ 
            success: true, 
            assets,
            message: `Found ${assets.length} assets` 
        });
    } catch (error) {
        console.error('[API] Error fetching assets:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Quick set RPC
app.post('/api/quick-set', async (req, res) => {
    try {
        if (!client.user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot is not connected to Discord!' 
            });
        }

        const { applicationId, type, name, largeImageKey, smallImageKey, details, state } = req.body;

        if (!applicationId || !type || !name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Application ID, type, and name are required' 
            });
        }

        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` 
            });
        }

        const config = loadConfig();
        config.applicationId = applicationId;
        config.type = type;
        config.name = name;
        config.largeImageKey = largeImageKey || null;
        config.smallImageKey = smallImageKey || null;
        config.details = details || null;
        config.state = state || null;
        config.enabled = true;

        saveConfig(config);
        await setRichPresence(config);

        res.json({ 
            success: true, 
            message: `RPC set: ${type} ${name}`,
            config 
        });
    } catch (error) {
        console.error('[API] Error in quick-set:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reset config to defaults
app.post('/api/reset', async (req, res) => {
    try {
        const config = { ...defaultConfig };
        saveConfig(config);
        
        if (client.user) {
            await clearRichPresence();
        }
        
        res.json({ success: true, message: 'Configuration reset to defaults!' });
    } catch (error) {
        console.error('[API] Error resetting config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[EXPRESS] Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('404 - Not Found');
});

// Start Express Server
app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════╗');
    console.log(`║  🌐 Dashboard: http://localhost:${PORT.toString().padEnd(5)} ║`);
    console.log('╚═══════════════════════════════════════╝');
});

// Login to Discord
console.log('[CLIENT] Logging into Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('╔═══════════════════════════════════════╗');
    console.error('║  ❌ Failed to login to Discord       ║');
    console.error('╚═══════════════════════════════════════╝');
    console.error('Error:', err.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n[SHUTDOWN] Shutting down gracefully...');
    try {
        await client.destroy();
        console.log('[SHUTDOWN] Discord client disconnected');
    } catch (error) {
        console.error('[SHUTDOWN] Error during shutdown:', error);
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('[PROCESS] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[PROCESS] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for potential command module usage
export { client, loadConfig, saveConfig, setRichPresence, clearRichPresence, fetchApplicationAssets };
