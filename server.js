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

// Log semua environment variables (jangan include sensitive)
console.log('🔧 Environment Check:');
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('- Current directory:', __dirname);
console.log('- Public path:', path.join(__dirname, 'public'));

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files dengan logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Test route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// Koneksi MongoDB
console.log('📡 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Terkoneksi ke MongoDB');
    
    // Start server AFTER MongoDB connected
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server berjalan di port ${PORT} (0.0.0.0)`);
      console.log(`🌍 URL: http://localhost:${PORT}`);
      console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });

  })
  .catch(err => {
    console.error('❌ Gagal konek ke MongoDB:', err.message);
    process.exit(1);
  });

// API Routes
app.post('/api/create', async (req, res) => {
  try {
    const { content } = req.body;
    console.log('📝 Creating message:', content);

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
      ? `https://${req.get('host')}`
      : `http://localhost:${PORT}`;
    
    const messageUrl = `${baseUrl}/view.html?id=${message._id}`;

    // Kirim response
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
      error: 'Terjadi kesalahan server' 
    });
  }
});

app.get('/api/message/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching message: ${id}`);

    if (!id || id.length !== 24) {
      return res.status(400).json({ success: false, error: 'ID pesan tidak valid' });
    }

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ success: false, error: 'Pesan tidak ditemukan atau sudah kadaluarsa' });
    }

    const now = new Date();
    if (now > message.expiresAt) {
      await Message.findByIdAndDelete(id);
      return res.status(410).json({ success: false, error: 'Pesan sudah kadaluarsa' });
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
    console.error('Error fetching message:', error);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan server' });
  }
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.url}`);
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Global error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});
