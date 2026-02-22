import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import Message from './models/Message.js';

// Load env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Log semua environment variables
console.log('🔧 Environment Check:');
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('- Current directory:', __dirname);
console.log('- Public path:', path.join(__dirname, 'public'));

// ============= MIDDLEWARE =============
// CORS harus PALING ATAS
console.log('📦 Setting up CORS...');
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle OPTIONS method untuk semua route
app.options('*', cors());

// Middleware lainnya
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ============= TEST ROUTE =============
app.get('/v1/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    port: PORT,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ============= DATABASE CONNECTION =============
console.log('📡 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ Terkoneksi ke MongoDB');
    
    // ============= API ROUTES =============
    console.log('📋 Registering API routes...');
    
    // CREATE MESSAGE
    console.log('  ✅ POST /v1/create');
    app.post('/v1/create', async (req, res) => {
  console.log('🔥🔥🔥 POST /v1/create EXECUTED! 🔥🔥🔥');
  console.log('Request body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);
  
  try {
    const { content } = req.body;
    console.log('Content received:', content);

    // Validasi
    if (!content || content.trim() === '') {
      console.log('Error: Empty content');
      return res.status(400).json({ 
        success: false, 
        error: 'Pesan tidak boleh kosong' 
      });
    }

    if (content.length > 5000) {
      console.log('Error: Content too long');
      return res.status(400).json({ 
        success: false, 
        error: 'Pesan maksimal 5000 karakter' 
      });
    }

    // Simpan ke DB
    const message = await Message.create({ 
      content: content.trim() 
    });
    
    console.log('✅ Message created:', message._id);

    // Buat URL
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `${req.protocol}://${req.get('host')}`
      : `http://localhost:${PORT}`;
    
    const messageUrl = `${baseUrl}/view.html?id=${message._id}`;

    // Kirim response JSON
    console.log('✅ Sending success response');
    return res.status(201).json({
      success: true,
      data: {
        id: message._id,
        url: messageUrl,
        expiresAt: message.expiresAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating message:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server: ' + error.message 
    });
  }
});

    // GET MESSAGE
    console.log('  ✅ GET /v1/message/:id');
    app.get('/v1/message/:id', async (req, res) => {
      console.log(`🔍 GET /api/message/${req.params.id} EXECUTED!`);
      
      try {
        const { id } = req.params;
        console.log(`🔍 Fetching message: ${id}`);

        if (!id || id.length !== 24) {
          return res.status(400).json({ 
            success: false, 
            error: 'ID pesan tidak valid' 
          });
        }

        const message = await Message.findById(id);

        if (!message) {
          return res.status(404).json({ 
            success: false, 
            error: 'Pesan tidak ditemukan atau sudah kadaluarsa' 
          });
        }

        const now = new Date();
        if (now > message.expiresAt) {
          await Message.findByIdAndDelete(id);
          return res.status(410).json({ 
            success: false, 
            error: 'Pesan sudah kadaluarsa' 
          });
        }

        console.log('✅ Message ditemukan');
        res.json({
          success: true,
          data: {
            content: message.content,
            createdAt: message.createdAt,
            expiresAt: message.expiresAt
          }
        });

      } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Terjadi kesalahan server' 
        });
      }
    });

    // ============= LIST ALL ROUTES =============
    console.log('\n📋 DAFTAR SEMUA ROUTE YANG TERDAFTAR:');
    app._router.stack.forEach(r => {
      if (r.route && r.route.path) {
        console.log(`  ${Object.keys(r.route.methods).join(', ').toUpperCase()} ${r.route.path}`);
      }
    });
    console.log('');

    // ============= START SERVER =============
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀🚀🚀 SERVER BERJALAN DI PORT ${PORT} (0.0.0.0) 🚀🚀🚀`);
      console.log(`🌍 URL: http://localhost:${PORT}`);
      console.log(`📁 Public folder: ${path.join(__dirname, 'public')}`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });

  })
  .catch(err => {
    console.error('❌ Gagal konek ke MongoDB:', err.message);
    process.exit(1);
  });

// ============= 404 HANDLER =============
// API 404
app.use('/api/*', (req, res) => {
  console.log(`❌ 404 API: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false, 
    error: 'API endpoint tidak ditemukan' 
  });
});

// Non-API 404 - serve index.html
app.use((req, res) => {
  console.log(`📄 Serving index.html untuk: ${req.url}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============= ERROR HANDLER GLOBAL =============
app.use((err, req, res, next) => {
  console.error('💥 Global error:', err.stack);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON' 
    });
  }
  
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

console.log('✅ Server.js loaded');
