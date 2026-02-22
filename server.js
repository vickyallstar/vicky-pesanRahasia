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

// Log environment
console.log('🔧 Environment Check:');
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('- Current directory:', __dirname);
console.log('- Public path:', path.join(__dirname, 'public'));

// ============= MIDDLEWARE DASAR =============
console.log('📦 Setting up CORS...');
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.options('*', cors());

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============= API ROUTES (PALING ATAS SEBELUM STATIC FILES) =============
console.log('📋 Registering API routes...');

// HEALTH CHECK
app.get('/v1/health', (req, res) => {
  console.log('🏥 Health check dipanggil');
  res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    port: PORT,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// CREATE MESSAGE
app.post('/v1/create', async (req, res) => {
  console.log('🔥🔥🔥🔥🔥 POST /v1/create DIPANGGIL! 🔥🔥🔥🔥🔥');
  console.log('Request body:', req.body);
  
  try {
    const { content } = req.body;

    // Validasi
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Pesan tidak boleh kosong' 
      });
    }

    if (content.length > 5000) {
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

    return res.status(201).json({
      success: true,
      data: {
        id: message._id,
        url: messageUrl,
        expiresAt: message.expiresAt
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server' 
    });
  }
});

// GET MESSAGE
app.get('/v1/message/:id', async (req, res) => {
  console.log(`🔍 GET /v1/message/${req.params.id} DIPANGGIL!`);
  
  try {
    const { id } = req.params;

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
        error: 'Pesan tidak ditemukan' 
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

    res.json({
      success: true,
      data: {
        content: message.content,
        createdAt: message.createdAt,
        expiresAt: message.expiresAt
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server' 
    });
  }
});

// ============= STATIC FILES (SETELAH API ROUTES) =============
console.log('📁 Setting up static files from:', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));

// ============= 404 HANDLER (PALING BAWAH) =============
app.use((req, res) => {
  console.log(`📄 404 - Serving index.html untuk: ${req.method} ${req.url}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============= DATABASE CONNECTION & START SERVER =============
console.log('📡 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Terkoneksi ke MongoDB');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀🚀🚀 SERVER BERJALAN DI PORT ${PORT} 🚀🚀🚀`);
      console.log(`🌍 http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

console.log('✅ Server.js loaded');
