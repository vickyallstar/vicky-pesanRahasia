import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import Message from './models/Message.js';

// Load environment variables
dotenv.config();

// Setup __dirname untuk ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Nonaktifkan untuk kemudahan development
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Terkoneksi ke MongoDB'))
  .catch(err => {
    console.error('❌ Gagal konek ke MongoDB:', err.message);
    process.exit(1);
  });

// API Routes
// POST /api/create - Buat pesan baru
app.post('/api/create', async (req, res) => {
  try {
    const { content } = req.body;

    // Validasi input
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

    // Simpan ke database
    const message = await Message.create({ content: content.trim() });

    // Buat URL unik
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? req.protocol + '://' + req.get('host')
      : `http://localhost:${PORT}`;
    
    const messageUrl = `${baseUrl}/view.html?id=${message._id}`;

    res.status(201).json({
      success: true,
      data: {
        id: message._id,
        url: messageUrl,
        expiresAt: message.expiresAt
      }
    });

  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server' 
    });
  }
});

// GET /api/message/:id - Ambil pesan berdasarkan ID
app.get('/api/message/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validasi ID
    if (!id || id.length !== 24) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID pesan tidak valid' 
      });
    }

    // Cari pesan di database
    const message = await Message.findById(id);

    // Cek apakah pesan ditemukan
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pesan tidak ditemukan atau sudah kadaluarsa' 
      });
    }

    // Cek apakah pesan sudah expired (manual check, meskipun TTL sudah otomatis)
    const now = new Date();
    if (now > message.expiresAt) {
      // Hapus pesan yang expired (optional, TTL akan menghapus otomatis)
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
    console.error('Error fetching message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server' 
    });
  }
});

// Route untuk root - redirect ke index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint tidak ditemukan' 
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Terjadi kesalahan internal server' 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di port ${PORT} (0.0.0.0)`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Terkoneksi ke MongoDB`);
});
