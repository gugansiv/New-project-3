import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import pg from 'pg';
import { QdrantClient } from '@qdrant/js-client-rest';
import { exec, execFile } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { pipeline } from '@xenova/transformers';
import { mcpManager } from './mcpClient.js';
import { search, searchNews } from 'duck-duck-scrape';

// Load .env file manually if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const index = trimmed.indexOf('=');
            if (index > 0) {
                const key = trimmed.substring(0, index).trim();
                const value = trimmed.substring(index + 1).trim();
                const cleanValue = value.replace(/^['"]|['"]$/g, '');
                process.env[key] = cleanValue;
            }
        }
    }
}

const fastify = Fastify({ logger: true });

// Enforce environment variables on startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set!');
    process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is not set!');
    process.exit(1);
}

// Load env variables
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || '/Volumes/PRIME DATA/Workspace/models/ggml-tiny.en.bin';


// Register plugins
await fastify.register(cors, {
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: false
});
await fastify.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Setup PostgreSQL pool
const pool = new pg.Pool({
    connectionString: DATABASE_URL
});

// Setup Qdrant client
const qdrant = new QdrantClient({ url: QDRANT_URL });
const COLLECTION_NAME = 'system_docs';

// Lazy-load embeddings pipeline
let embedder = null;
async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}

// Generate local embedding vector
async function generateEmbedding(text) {
    const pipe = await getEmbedder();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

// Initialize Database, Vector Collection, and MCP Servers
fastify.addHook('onReady', async () => {
    try {
        // Init PostgreSQL tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS chat_history (
                id SERIAL PRIMARY KEY,
                role VARCHAR(10) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS agents (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                role TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'idle',
                task TEXT,
                logs TEXT DEFAULT '',
                verification_report TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        fastify.log.info('PostgreSQL tables checked/created successfully.');

        // Init Qdrant Collection
        const collections = await qdrant.getCollections();
        const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
        if (!exists) {
            await qdrant.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: 384,
                    distance: 'Cosine'
                }
            });
            fastify.log.info(`Qdrant collection "${COLLECTION_NAME}" created.`);
        } else {
            fastify.log.info(`Qdrant collection "${COLLECTION_NAME}" already exists.`);
        }

        // Register default local filesystem MCP server if available
        // Example: npx -y @modelcontextprotocol/server-filesystem /Volumes/PRIME DATA/Workspace
        const workspaceDir = '/Volumes/PRIME DATA/Workspace';
        if (fs.existsSync(workspaceDir)) {
            await mcpManager.registerServer(
                'filesystem',
                'npx',
                ['-y', '@modelcontextprotocol/server-filesystem', workspaceDir]
            );
        }
    } catch (err) {
        fastify.log.error('Database/MCP initialization error:', err);
    }
});

// ─── Security Helpers & Hooks ──────────────────────────────────────────────────

// JWT Verification Helper
function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    
    const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');
        
    const a = Buffer.from(signature, 'base64url');
    const b = Buffer.from(expectedSignature, 'base64url');
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    
    try {
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }
        return decodedPayload;
    } catch (err) {
        return null;
    }
}

// In-Memory Rate Limiter Map
const ipCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ipCache.entries()) {
        if (now - entry.windowStart > 60000) {
            ipCache.delete(key);
        }
    }
}, 300000);

function rateLimit(ip, path, limit) {
    const key = `${ip}:${path || 'global'}`;
    const now = Date.now();
    if (!ipCache.has(key)) {
        ipCache.set(key, { count: 1, windowStart: now });
        return true;
    }
    const entry = ipCache.get(key);
    if (now - entry.windowStart > 60000) {
        entry.count = 1;
        entry.windowStart = now;
        return true;
    }
    entry.count++;
    return entry.count <= limit;
}

// Authentication Hook
async function authenticate(request, reply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Unauthorized. Token required.' });
        }
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        if (!decoded) {
            return reply.status(401).send({ error: 'Unauthorized. Invalid or expired token.' });
        }
        request.user = decoded; // Attach user info to request object
    } catch (err) {
        fastify.log.error('Authentication hook error:', err);
        return reply.status(401).send({ error: 'Unauthorized.' });
    }
}

// Rate Limiting Hook
async function rateLimitPreHandler(request, reply) {
    const ip = request.ip || '127.0.0.1';
    let limit = 60; // Default limit per minute
    
    // Check path to enforce specific limits
    const path = request.routerPath;
    if (path === '/api/chat') limit = 5;
    else if (path === '/api/transcribe') limit = 3;
    else if (path === '/api/index') limit = 5;
    else if (path === '/api/agents/assign') limit = 5;
    else if (path === '/api/agents/spawn') limit = 10;
    
    if (!rateLimit(ip, path, limit)) {
        return reply.status(429).send({ error: 'Too many requests. Please try again later.' });
    }
}

// Register global rate limiter preHandler hook
fastify.addHook('preHandler', rateLimitPreHandler);

// ─── API Routes ──────────────────────────────────────────────────────────────

// 1. System Health Status
fastify.get('/api/status', async (request, reply) => {
    let pgStatus = 'healthy';
    let qdrantStatus = 'healthy';
    let ollamaStatus = 'healthy';
    let whisperStatus = 'healthy';

    try {
        await pool.query('SELECT 1');
    } catch (err) {
        pgStatus = 'unreachable';
    }

    try {
        await qdrant.getCollections();
    } catch (err) {
        qdrantStatus = 'unreachable';
    }

    try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) ollamaStatus = 'unhealthy';
    } catch (err) {
        ollamaStatus = 'unreachable';
    }

    if (!fs.existsSync(WHISPER_MODEL_PATH)) {
        whisperStatus = 'missing-model';
    }

    return {
        postgres: pgStatus,
        qdrant: qdrantStatus,
        ollama: ollamaStatus,
        whisper: whisperStatus,
        time: new Date().toISOString()
    };
});

// 2. Speech-to-Text Transcription via Whisper.cpp
fastify.post('/api/transcribe', { preHandler: authenticate }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
        return reply.status(400).send({ error: 'No audio file uploaded.' });
    }

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `upload-${timestamp}.webm`);
    const wavPath = path.join(tempDir, `upload-${timestamp}.wav`);
    const txtPath = `${wavPath}.txt`;

    try {
        const buffer = await data.toBuffer();
        fs.writeFileSync(inputPath, buffer);

        // Convert to 16kHz mono WAV using ffmpeg securely (BC3)
        await new Promise((resolve, reject) => {
            execFile('ffmpeg', ['-i', inputPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath, '-y'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (!fs.existsSync(wavPath)) {
            throw new Error("ffmpeg conversion failed: output WAV file not found");
        }

        // Run whisper-cli securely (BC3)
        await new Promise((resolve, reject) => {
            execFile('whisper-cli', ['-m', WHISPER_MODEL_PATH, '-f', wavPath, '-otxt'], (err, stdout, stderr) => {
                if (err) {
                    fastify.log.error('whisper-cli execution error:', stderr);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        if (!fs.existsSync(txtPath)) {
            throw new Error("whisper-cli output file not found");
        }

        const text = fs.readFileSync(txtPath, 'utf8').trim();
        fastify.log.info(`[Whisper.cpp] Transcribed: "${text}"`);

        return { text };
    } catch (err) {
        fastify.log.error('Transcription pipeline error:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
});
// 3. Document Indexing (RAG ingestion)
fastify.post('/api/index', { preHandler: authenticate }, async (request, reply) => {
    const { title, content } = request.body || {};
    if (typeof title !== 'string' || typeof content !== 'string') {
        return reply.status(400).send({ error: 'Title and content must be strings.' });
    }
    const safeTitle = title.trim();
    const safeContent = content.trim();
    if (safeTitle === '' || safeContent === '') {
        return reply.status(400).send({ error: 'Title and content cannot be empty.' });
    }
    if (safeTitle.length > 200) {
        return reply.status(400).send({ error: 'Title cannot exceed 200 characters.' });
    }
    if (safeContent.length > 50000) {
        return reply.status(400).send({ error: 'Content cannot exceed 50000 characters.' });
    }

    try {
        const pgRes = await pool.query(
            'INSERT INTO documents (title, content) VALUES ($1, $2) RETURNING id',
            [safeTitle, safeContent]
        );
        const docId = pgRes.rows[0].id;

        const vector = await generateEmbedding(safeContent);

        await qdrant.upsert(COLLECTION_NAME, {
            points: [
                {
                    id: docId,
                    vector: vector,
                    payload: { title: safeTitle, content: safeContent, docId }
                }
            ]
        });

        return { success: true, docId, title: safeTitle };
    } catch (err) {
        fastify.log.error('Indexing error:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});
// Built-in tools for internet search and multi-agent orchestration
const builtInTools = [
    {
        type: 'function',
        function: {
            name: 'internet_search',
            description: 'Perform a web search using DuckDuckGo to retrieve snippet results for a query.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query to look up on the internet.'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_agent',
            description: 'Spawn a new sub-agent with a specific name and role.',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'The name of the agent (e.g. "Nova").'
                    },
                    role: {
                        type: 'string',
                        description: 'The role/specialty of the agent (e.g. "Cybersecurity Specialist").'
                    }
                },
                required: ['name', 'role']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'assign_task',
            description: 'Assign a specific project/task to a previously created agent.',
            parameters: {
                type: 'object',
                properties: {
                    agent_name: {
                        type: 'string',
                        description: 'The name of the agent to run the task.'
                    },
                    task: {
                        type: 'string',
                        description: 'The task instructions for the agent.'
                    }
                },
                required: ['agent_name', 'task']
            }
        }
    }
];

// Helper: Internet Search Fallback using duck-duck-scrape
async function performSearch(query) {
    try {
        fastify.log.info(`[Search] Searching for "${query}" using standard search...`);
        const res = await search(query, {}, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (res && res.results && res.results.length > 0) {
            return res.results.slice(0, 5).map(r => ({
                title: r.title,
                snippet: r.description,
                url: r.url
            }));
        }
    } catch (err) {
        fastify.log.warn(`[Search] Standard search failed: ${err.message}. Falling back to searchNews...`);
    }

    try {
        const res = await searchNews(query, {}, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (res && res.results && res.results.length > 0) {
            return res.results.slice(0, 5).map(r => ({
                title: r.title,
                snippet: r.excerpt,
                url: r.url
            }));
        }
    } catch (err) {
        fastify.log.error(`[Search] News search fallback failed: ${err.message}`);
    }

    return [];
}

// Helper: Create agent in PostgreSQL
async function createAgentDB(name, role) {
    await pool.query(
        `INSERT INTO agents (name, role, status, task, logs, verification_report) 
         VALUES ($1, $2, 'idle', NULL, '', '') 
         ON CONFLICT (name) DO UPDATE SET role = EXCLUDED.role, status = 'idle', task = NULL, logs = '', verification_report = ''`,
        [name, role]
    );
    return { success: true, message: `Agent "${name}" successfully created/reset with role "${role}".` };
}

// Helper: Assign task & trigger background workflow
async function assignTaskDB(agentName, task, model) {
    const checkRes = await pool.query('SELECT role FROM agents WHERE name = $1', [agentName]);
    if (checkRes.rows.length === 0) {
        throw new Error(`Agent "${agentName}" does not exist. Please create the agent first.`);
    }
    const role = checkRes.rows[0].role;

    await pool.query(
        `UPDATE agents SET status = 'working', task = $2, logs = 'Agent task started...', verification_report = '' WHERE name = $1`,
        [agentName, task]
    );

    // Fire background task asynchronously
    runBackgroundAgentTask(agentName, role, task, model).catch(err => {
        fastify.log.error(`[Orchestration] Background task failed for agent ${agentName}:`, err);
    });

    return { success: true, message: `Task assigned to agent "${agentName}". Work execution and verification started in background.` };
}

// Asynchronous Multi-Agent background flow
async function runBackgroundAgentTask(agentName, role, task, model) {
    try {
        fastify.log.info(`[Orchestration] Spawning agent ${agentName} for task: "${task}"`);
        
        const agentSystemPrompt = `You are ${agentName}, a specialized local AI sub-agent.
Your role: ${role}
Task assigned to you:
${task}

Perform this task thoroughly and output your complete, professional, high-quality work, report, or implementation detail.
Do not use conversational filler. Provide only the final direct work/report.`;

        const agentRes = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: agentSystemPrompt },
                    { role: 'user', content: 'Please perform your task and output the final response.' }
                ],
                stream: false
            })
        });

        if (!agentRes.ok) {
            throw new Error(`Ollama failed to generate agent output: ${agentRes.statusText}`);
        }

        const agentData = await agentRes.json();
        const agentOutput = agentData.message.content;

        // Save output logs & transition to verifying
        await pool.query(
            `UPDATE agents SET logs = $2, status = 'verifying' WHERE name = $1`,
            [agentName, agentOutput]
        );

        // Verification LLM Request
        fastify.log.info(`[Orchestration] Spawning Verifier agent for ${agentName}'s output`);
        
        const verifierSystemPrompt = `You are the Local Agent Work Verifier.
Review the output generated by ${agentName} (Role: ${role}) for the following task:
"${task}"

Output to review:
---
${agentOutput}
---

Verify and evaluate if this output successfully meets the requirements of the task.
Output a structured verification report detailing:
1. WORK SUMMARY
2. VERIFICATION ASSESSMENT (clearly state PASS or FAIL)
3. SPECIFIC OBSERVATIONS & RECOMMENDATIONS`;

        const verifierRes = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: verifierSystemPrompt },
                    { role: 'user', content: 'Please review and output your verification report.' }
                ],
                stream: false
            })
        });

        if (!verifierRes.ok) {
            throw new Error(`Ollama failed to generate verifier report: ${verifierRes.statusText}`);
        }

        const verifierData = await verifierRes.json();
        const verificationReport = verifierData.message.content;

        // Check if report has FAIL
        const isFailed = /FAIL/i.test(verificationReport);
        const finalStatus = isFailed ? 'failed' : 'completed';

        await pool.query(
            `UPDATE agents SET verification_report = $2, status = $3 WHERE name = $1`,
            [agentName, verificationReport, finalStatus]
        );
        fastify.log.info(`[Orchestration] Agent ${agentName} completed task with status: ${finalStatus}`);

    } catch (err) {
        fastify.log.error(`[Orchestration] Error in agent background loop: ${err.message}`);
        await pool.query(
            `UPDATE agents SET status = 'failed', logs = $2 WHERE name = $1`,
            [agentName, `Error: ${err.message}`]
        );
    }
}

// Persistent Chat History Endpoints
fastify.get('/api/history', { preHandler: authenticate }, async (request, reply) => {
    try {
        const dbHistoryRes = await pool.query('SELECT role, content FROM chat_history ORDER BY id ASC');
        return dbHistoryRes.rows;
    } catch (err) {
        fastify.log.error('Failed to get chat history:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});

fastify.post('/api/history/clear', { preHandler: authenticate }, async (request, reply) => {
    try {
        await pool.query('DELETE FROM chat_history');
        return { success: true };
    } catch (err) {
        fastify.log.error('Failed to clear chat history:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});

// Multi-Agent Workspace Status Endpoints
fastify.get('/api/agents', { preHandler: authenticate }, async (request, reply) => {
    try {
        const agentsRes = await pool.query('SELECT * FROM agents ORDER BY id ASC');
        return agentsRes.rows;
    } catch (err) {
        fastify.log.error('Failed to get agents list:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});

fastify.post('/api/agents/clear', { preHandler: authenticate }, async (request, reply) => {
    try {
        await pool.query('DELETE FROM agents');
        return { success: true };
    } catch (err) {
        fastify.log.error('Failed to clear agents:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});

fastify.post('/api/agents/spawn', { preHandler: authenticate }, async (request, reply) => {
    try {
        const { name, role } = request.body || {};
        if (typeof name !== 'string' || typeof role !== 'string') {
            return reply.status(400).send({ error: 'Name and role must be strings.' });
        }
        const safeName = name.trim();
        const safeRole = role.trim();
        if (safeName === '' || safeRole === '') {
            return reply.status(400).send({ error: 'Name and role are required.' });
        }
        if (safeName.length > 100 || safeRole.length > 100) {
            return reply.status(400).send({ error: 'Name and role cannot exceed 100 characters.' });
        }
        if (!/^[a-zA-Z0-9_\-\s]+$/.test(safeName)) {
            return reply.status(400).send({ error: 'Agent name contains invalid characters.' });
        }
        return await createAgentDB(safeName, safeRole);
    } catch (err) {
        fastify.log.error('Failed to spawn agent:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});

fastify.post('/api/agents/assign', { preHandler: authenticate }, async (request, reply) => {
    try {
        const { name, task, model = 'llama3.2:3b' } = request.body || {};
        if (typeof name !== 'string' || typeof task !== 'string' || typeof model !== 'string') {
            return reply.status(400).send({ error: 'Name, task, and model must be strings.' });
        }
        const safeName = name.trim();
        const safeTask = task.trim();
        const safeModel = model.trim();
        if (safeName === '' || safeTask === '') {
            return reply.status(400).send({ error: 'Name and task are required.' });
        }
        if (safeName.length > 100 || safeModel.length > 100) {
            return reply.status(400).send({ error: 'Name and model cannot exceed 100 characters.' });
        }
        if (safeTask.length > 10000) {
            return reply.status(400).send({ error: 'Task content cannot exceed 10000 characters.' });
        }
        if (!/^[a-zA-Z0-9_\-\s:\.]+$/.test(safeModel)) {
            return reply.status(400).send({ error: 'Invalid model name.' });
        }
        return await assignTaskDB(safeName, safeTask, safeModel);
    } catch (err) {
        fastify.log.error('Failed to assign task:', err);
        return reply.status(500).send({ error: 'Internal server error' });
    }
});

// 4. Chat with RAG Context, Persistent Memory & Agentic Tools
fastify.post('/api/chat', { preHandler: authenticate }, async (request, reply) => {
    const { message, model = 'llama3.2:3b' } = request.body || {};
    if (typeof message !== 'string' || typeof model !== 'string') {
        return reply.status(400).send({ error: 'Message and model must be strings.' });
    }
    const safeMessage = message.trim();
    const safeModel = model.trim();
    if (safeMessage === '') {
        return reply.status(400).send({ error: 'Message is required.' });
    }
    if (safeMessage.length > 10000) {
        return reply.status(400).send({ error: 'Message content cannot exceed 10000 characters.' });
    }
    if (!/^[a-zA-Z0-9_\-\s:\.]+$/.test(safeModel)) {
        return reply.status(400).send({ error: 'Invalid model name.' });
    }

    try {
        // 1. Search semantic matches in Qdrant
        const queryVector = await generateEmbedding(safeMessage);
        const searchResults = await qdrant.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: 3
        });

        // 2. Construct retrieved context
        let context = '';
        if (searchResults.length > 0) {
            context = searchResults.map(res => `[Source: ${res.payload.title}]\n${res.payload.content}`).join('\n\n');
        }

        const systemPrompt = `You are Antigravity, a local AI supervisor engine.
Use the following pieces of local context (if relevant) to answer the user's question.
If the context is empty or not helpful, answer using your general knowledge.
Keep your answers clear, concise, and technical.

You also have access to local tools. 
Use them if the user asks you to search the web, spawn agents, assign tasks, read/write files or check system details.

---
LOCAL CONTEXT:
${context || 'No local context matches this query.'}
---`;

        // Save the incoming user message to database history
        await pool.query(
            'INSERT INTO chat_history (role, content) VALUES ($1, $2)',
            ['user', safeMessage]
        );

        // Load complete history from database for Ollama prompt context
        const dbHistoryRes = await pool.query('SELECT role, content FROM chat_history ORDER BY id ASC');
        const dbHistory = dbHistoryRes.rows.map(r => ({ role: r.role, content: r.content }));

        const messages = [
            { role: 'system', content: systemPrompt },
            ...dbHistory
        ];

        // Fetch registered MCP tools and merge with built-in tools
        const mcpTools = mcpManager.getAllTools();
        const tools = [...builtInTools, ...mcpTools];

        // Call Ollama chat completions
        const ollamaRes = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: safeModel,
                messages: messages,
                tools: tools.length > 0 ? tools : undefined,
                stream: false // Non-stream first to process potential tool calls
            })
        });

        if (!ollamaRes.ok) {
            throw new Error(`Ollama returned status ${ollamaRes.status}`);
        }

        const chatData = await ollamaRes.json();
        const responseMessage = chatData.message;

        // Check if model decided to call tools
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            fastify.log.info('Ollama requested tool execution:', responseMessage.tool_calls);
            
            // Execute tool calls
            const toolResults = [];
            for (const call of responseMessage.tool_calls) {
                const toolName = call.function.name;
                const args = call.function.arguments;
                try {
                    let result;
                    if (toolName === 'internet_search') {
                        result = await performSearch(args.query);
                    } else if (toolName === 'create_agent') {
                        result = await createAgentDB(args.name, args.role);
                    } else if (toolName === 'assign_task') {
                        result = await assignTaskDB(args.agent_name, args.task, safeModel);
                    } else {
                        result = await mcpManager.executeTool(toolName, args);
                    }
                    
                    toolResults.push({
                        role: 'tool',
                        name: toolName,
                        content: JSON.stringify(result)
                    });
                } catch (err) {
                    toolResults.push({
                        role: 'tool',
                        name: toolName,
                        content: JSON.stringify({ error: err.message })
                    });
                }
            }

            // Send tool responses back to Ollama to get final streamed answer
            messages.push(responseMessage);
            messages.push(...toolResults);

            const streamRes = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: safeModel,
                    messages: messages,
                    stream: true
                })
            });

            if (!streamRes.ok) {
                throw new Error(`Ollama stream error: ${streamRes.status}`);
            }

            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            });

            const reader = streamRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let completeResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                reply.raw.write(chunk);

                // Accumulate response for saving to DB
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line.trim());
                            if (parsed.message && parsed.message.content) {
                                completeResponse += parsed.message.content;
                            }
                        } catch (err) {
                            // ignore partial JSON parse errors
                        }
                    }
                }
            }

            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer.trim());
                    if (parsed.message && parsed.message.content) {
                        completeResponse += parsed.message.content;
                    }
                } catch (err) {
                    // ignore
                }
            }

            // Save streamed assistant response to DB
            if (completeResponse.trim()) {
                await pool.query(
                    'INSERT INTO chat_history (role, content) VALUES ($1, $2)',
                    ['assistant', completeResponse.trim()]
                );
            }
            reply.raw.end();

        } else {
            // Save final static response to PostgreSQL
            const assistantContent = responseMessage.content || '';
            if (assistantContent.trim()) {
                await pool.query(
                    'INSERT INTO chat_history (role, content) VALUES ($1, $2)',
                    ['assistant', assistantContent.trim()]
                );
            }

            // Return response to frontend in SSE format
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            });
            reply.raw.write(JSON.stringify({
                message: responseMessage,
                done: true
            }));
            reply.raw.end();
        }

    } catch (err) {
        fastify.log.error('Chat error:', err);
        if (!reply.raw.headersSent) {
            return reply.status(500).send({ error: 'Internal server error' });
        } else {
            reply.raw.end();
        }
    }
});

// 5. Retrieve Cybersecurity News
const NEWS_DIR = '/Volumes/PRIME DATA/Workspace/Nova/cyber-security-news';
const NEWS_FILE = path.join(NEWS_DIR, 'news.json');

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        const title = (itemContent.match(/<title>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/title>/) || [])[2] || '';
        const link = (itemContent.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
        const pubDate = (itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        const description = (itemContent.match(/<description>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/description>/) || [])[2] || '';
        
        const cleanDesc = description.replace(/<[^>]*>/g, '').trim();

        items.push({
            title: title.trim(),
            link: link.trim(),
            pubDate: pubDate.trim(),
            description: cleanDesc.substring(0, 200) + (cleanDesc.length > 200 ? '...' : '')
        });
    }
    return items;
}

async function collectNews() {
    try {
        fastify.log.info('Fetching cybersecurity news from RSS feed...');
        const res = await fetch('https://feeds.feedburner.com/TheHackersNews');
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const xml = await res.text();
        const news = parseRSS(xml);
        
        if (news.length > 0) {
            if (!fs.existsSync(NEWS_DIR)) {
                fs.mkdirSync(NEWS_DIR, { recursive: true });
            }
            fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
            fastify.log.info(`Successfully collected and saved ${news.length} cybersecurity news stories to Nova.`);
        }
    } catch (err) {
        fastify.log.error('Failed to collect cybersecurity news:', err.message);
    }
}

// Start periodic news collection
setInterval(collectNews, 30000);
collectNews(); // run once on start

fastify.get('/api/news', { preHandler: authenticate }, async (request, reply) => {
    try {
        if (fs.existsSync(NEWS_FILE)) {
            const content = fs.readFileSync(NEWS_FILE, 'utf8');
            try {
                return JSON.parse(content);
            } catch (parseErr) {
                fastify.log.warn('News file contains invalid JSON, returning empty list.');
                return [];
            }
        }
        return [];
    } catch (err) {
        fastify.log.error('Failed to read news file:', err.message);
        return [];
    }
});

// Run server
try {
    await fastify.listen({ port: PORT, host: HOST });
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}
