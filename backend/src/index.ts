import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
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

// Evita che i browser interpretino i file statici (es. immagini caricate)
// come un tipo diverso da quello dichiarato nel Content-Type.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ---------- Autenticazione per pannello admin e API di scrittura ----------
// Login via password -> sessione con cookie (non l'autenticazione HTTP nativa
// del browser: quella apre un popup che molti browser automatizzati saltano
// del tutto, mostrando solo il messaggio di errore grezzo).

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cambia-questa-password';
if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '\n⚠️  ADMIN_PASSWORD non impostata: il pannello admin usa una password di default INSICURA ("cambia-questa-password").\n' +
    '   Prima di esporre questo backend online, avvialo con: ADMIN_PASSWORD=una-password-robusta npm run dev\n'
  );
}

const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ore
const sessions = new Map<string, number>(); // token -> scadenza

function createSession(): string {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function getSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return match ? match.slice(SESSION_COOKIE.length + 1) : undefined;
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// Limita i tentativi di login falliti per indirizzo IP, per rendere inutile
// il brute-force sulla password.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const entry = authAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    authAttempts.delete(ip);
    return false;
  }
  return entry.count >= AUTH_MAX_ATTEMPTS;
}

function registerFailedAttempt(ip: string): void {
  const entry = authAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: Date.now() + AUTH_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// Protegge le API di scrittura: richiede una sessione valida (cookie),
// creata tramite /api/login.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isValidSession(getSessionToken(req))) return next();
  res.status(401).json({ message: 'Autenticazione richiesta' });
}

const LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Accedi — La Tana di Ariel</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f4ecdb;color:#2c2116;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
  form{background:#f8f1e2;border:1px solid rgba(44,33,22,0.16);border-radius:8px;padding:32px;width:100%;max-width:320px;box-sizing:border-box;}
  h1{font-size:1.15rem;color:#2c4330;margin:0 0 20px;}
  label{display:block;font-weight:700;font-size:0.85rem;margin-bottom:6px;color:#5b4d3c;}
  input{width:100%;padding:0.6em 0.7em;border:1px solid rgba(44,33,22,0.16);border-radius:6px;font-size:0.95rem;box-sizing:border-box;font-family:inherit;}
  button{margin-top:16px;width:100%;background:#2c4330;color:#f8f1e2;border:none;border-radius:999px;padding:0.75em;font-weight:700;font-size:0.9rem;cursor:pointer;}
  button:hover{background:#1c2b1f;}
  .msg{margin-top:12px;font-size:0.85rem;color:#8f2c1d;min-height:1.2em;}
</style>
</head>
<body>
  <form id="loginForm">
    <h1>Accedi al pannello contenuti</h1>
    <label for="password">Password</label>
    <input type="password" id="password" autocomplete="current-password" autofocus required>
    <button type="submit">Entra</button>
    <p class="msg" id="loginMsg"></p>
  </form>
<script>
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('loginMsg');
    msg.textContent = '';
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('password').value }),
    });
    if (res.ok) {
      window.location.reload();
      return;
    }
    const data = await res.json().catch(() => ({}));
    msg.textContent = data.message || 'Errore di accesso.';
  });
</script>
</body>
</html>`;

// Mostra il pannello admin se la sessione è valida, altrimenti il modulo di
// login (mai un messaggio grezzo).
app.get('/admin.html', (req: Request, res: Response) => {
  if (isValidSession(getSessionToken(req))) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  }
  res.status(401).type('html').send(LOGIN_PAGE_HTML);
});

app.post('/api/login', (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ message: 'Troppi tentativi falliti. Riprova più tardi.' });
  }

  const { password } = req.body || {};
  const provided = Buffer.from(typeof password === 'string' ? password : '');
  const expected = Buffer.from(ADMIN_PASSWORD);
  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!ok) {
    registerFailedAttempt(ip);
    return res.status(401).json({ message: 'Password errata' });
  }

  res.cookie(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req: Request, res: Response) => {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Upload immagini ----------
// I file finiscono in public/uploads e sono serviti come file statici
// (es. /uploads/xyz.jpg), pronti per essere usati come `image` di un contenuto.

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_IMAGE_SIZE_MB = 5;

// Il tipo dichiarato dal client (Content-Type) non è attendibile: viene usato
// solo come filtro rapido. L'estensione reale viene decisa qui, leggendo la
// "firma" (magic bytes) del file, indipendentemente da cosa dichiara il client.
function detectImageExtension(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (
    buffer.length >= 8 &&
    buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return '.png';
  }
  if (
    buffer.length >= 6 &&
    (buffer.slice(0, 6).toString('ascii') === 'GIF87a' || buffer.slice(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return '.gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_EXTENSION_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Formato immagine non supportato (usa JPG, PNG, WEBP o GIF)'));
  },
});

// Un valore per il campo `image` è accettato solo se punta a un file che
// abbiamo generato noi in /uploads, oppure se è un URL http(s) ben formato.
// Blocca payload come `x" onerror="..."` che romperebbero l'attributo src.
const SAFE_UPLOAD_IMAGE = /^\/uploads\/[a-z0-9]+-[a-f0-9]+\.(jpg|jpeg|png|webp|gif)$/i;
const SAFE_EXTERNAL_IMAGE = /^https?:\/\/[^\s"'<>]+$/i;

function isSafeImageValue(image: unknown): image is string | undefined {
  if (image === undefined) return true;
  return typeof image === 'string' && (SAFE_UPLOAD_IMAGE.test(image) || SAFE_EXTERNAL_IMAGE.test(image));
}

// Carica un'immagine e restituisce l'URL da usare come campo `image` di un contenuto
app.post('/api/upload', requireAuth, (req: Request, res: Response) => {
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

    const ext = detectImageExtension(req.file.buffer);
    if (!ext) {
      return res.status(400).json({ message: 'Il file non è un\'immagine valida (JPG, PNG, WEBP o GIF)' });
    }

    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
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
app.post('/api/content', requireAuth, (req: Request, res: Response) => {
  const { category, title, date, excerpt, featured, image, body, slug } = req.body || {};
  if (!category || !title || !body) {
    return res.status(400).json({ message: 'category, title e body sono obbligatori' });
  }
  if (!isSafeImageValue(image)) {
    return res.status(400).json({ message: 'Valore immagine non valido' });
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
app.put('/api/content/:category/:slug', requireAuth, (req: Request, res: Response) => {
  const { category, title, date, excerpt, featured, image, body, slug } = req.body || {};
  if (!category || !title || !body) {
    return res.status(400).json({ message: 'category, title e body sono obbligatori' });
  }
  if (!isSafeImageValue(image)) {
    return res.status(400).json({ message: 'Valore immagine non valido' });
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
app.delete('/api/content/:category/:slug', requireAuth, (req: Request, res: Response) => {
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
