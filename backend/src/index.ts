import express, { Request, Response } from 'express';
import cors from 'cors';
import galleryData from './data/gallery.json';
import { GalleryItem } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint per la lista completa o filtrata per categoria
app.get('/api/gallery', (req: Request, res: Response) => {
  const category = req.query.category as string;
  if (category && category !== 'Tutti') {
    const filtered = (galleryData as GalleryItem[]).filter(
      item => item.category.toLowerCase() === category.toLowerCase()
    );
    return res.json(filtered);
  }
  res.json(galleryData);
});

// Endpoint per dettaglio singolo elemento
app.get('/api/gallery/:id', (req: Request, res: Response) => {
  const item = (galleryData as GalleryItem[]).find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Elemento non trovato' });
  }
  res.json(item);
});

app.listen(PORT, () => {
  console.log(`Server API attivo su http://localhost:${PORT}`);
});
