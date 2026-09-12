import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import {
  listContent,
  getContentItem,
  listCategories,
  createContentItem,
  updateContentItem,
  deleteContentItem,
} from './lib/content';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Upload immagini: i file finiscono in public/uploads e sono serviti come
// file statici (es. /uploads/xyz.jpg), pronti per essere usati come `image`
// di un contenuto.
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_IMAGE_SIZE_MB = 5;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = IMAGE_EXTENSION_BY_MIME[file.mimetype] || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_EXTENSION_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Formato immagine non supportato (usa JPG, PNG, WEBP o GIF)'));
  },
});

// Pagina di stato: comoda solo per verificare a mano che il server sia attivo
app.get('/', (_req: Request, res: Response) => {
  const categories = listCategories();
  res.type('html').send(`<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>La Tana di Ariel — API</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f4ecdb;color:#2c2116;max-width:640px;margin:60px auto;padding:0 24px;line-height:1.6;}
  h1{color:#2c4330;}
  code{background:#ecdfc4;padding:0.15em 0.4em;border-radius:4px;}
  a{color:#8f2c1d;}
  li{margin-bottom:0.6em;}
</style>
</head>
<body>
  <h1>La Tana di Ariel — API</h1>
  <p>Il server è attivo. Questa non è una pagina del sito: è solo l'elenco degli endpoint disponibili.</p>
  <p>👉 Per aggiungere o modificare contenuti senza toccare i file, vai su <a href="/admin.html"><strong>/admin.html</strong></a>.</p>
  <ul>
    <li><a href="/api/categories">GET /api/categories</a> — elenco categorie (${categories.join(', ') || 'nessuna'})</li>
    <li><a href="/api/content">GET /api/content</a> — tutti i contenuti</li>
    <li><a href="/api/content?category=ariel">GET /api/content?category=ariel</a> — contenuti di una categoria</li>
    <li><code>GET /api/content/:category/:slug</code> — dettaglio di un singolo contenuto</li>
    <li><code>POST /api/upload</code> — carica un'immagine (campo form-data "image", max ${MAX_IMAGE_SIZE_MB}MB, JPG/PNG/WEBP/GIF)</li>
    <li><code>POST /api/content</code> — crea un contenuto</li>
    <li><code>PUT /api/content/:category/:slug</code> — modifica un contenuto</li>
    <li><code>DELETE /api/content/:category/:slug</code> — elimina un contenuto</li>
  </ul>
  <p>Il sito vero e proprio è servito separatamente dal frontend (Vite), non da qui.</p>
</body>
</html>`);
});

// Carica un'immagine e restituisce l'URL da usare come campo `image` di un contenuto
app.post('/api/upload', (req: Request, res: Response) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `L'immagine supera la dimensione massima di ${MAX_IMAGE_SIZE_MB}MB` });
    }
    if (err) {
      const message = err instanceof Error ? err.message : 'Caricamento immagine non riuscito';
      return res.status(400).json({ message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Nessuna immagine ricevuta' });
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

// Elenco delle categorie disponibili (ariel, olivia, tana, bottega, ...)
app.get('/api/categories', (_req: Request, res: Response) => {
  res.json(listCategories());
});

// Elenco dei contenuti, opzionalmente filtrati per categoria
app.get('/api/content', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  res.json(listContent(category));
});

// Crea un nuovo contenuto
app.post('/api/content', (req: Request, res: Response) => {
  const { category, title, date, excerpt, featured, image, body, slug } = req.body || {};
  if (!category || !title || !body) {
    return res.status(400).json({ message: 'category, title e body sono obbligatori' });
  }
  try {
    const item = createContentItem({ category, title, date, excerpt, featured: !!featured, image, body, slug });
    res.status(201).json(item);
  } catch (err) {
    res.status(409).json({ message: (err as Error).message });
  }
});

// Dettaglio di un singolo contenuto
app.get('/api/content/:category/:slug', (req: Request, res: Response) => {
  try {
    const item = getContentItem(req.params.category, req.params.slug);
    if (!item) return res.status(404).json({ message: 'Contenuto non trovato' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

// Modifica un contenuto esistente (può cambiarne categoria e titolo/slug)
app.put('/api/content/:category/:slug', (req: Request, res: Response) => {
  const { category, title, date, excerpt, featured, image, body, slug } = req.body || {};
  if (!category || !title || !body) {
    return res.status(400).json({ message: 'category, title e body sono obbligatori' });
  }
  try {
    const item = updateContentItem(req.params.category, req.params.slug, {
      category,
      title,
      date,
      excerpt,
      featured: !!featured,
      image,
      body,
      slug,
    });
    res.json(item);
  } catch (err) {
    res.status(409).json({ message: (err as Error).message });
  }
});

// Elimina un contenuto
app.delete('/api/content/:category/:slug', (req: Request, res: Response) => {
  try {
    deleteContentItem(req.params.category, req.params.slug);
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ message: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server API attivo su http://localhost:${PORT}`);
});
