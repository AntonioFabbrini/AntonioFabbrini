import fs from 'fs';
import path from 'path';
import { ContentItem } from '../types';

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const SAFE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ContentInput {
  category: string;
  title: string;
  date?: string;
  excerpt?: string;
  featured?: boolean;
  body: string;
  slug?: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assertSafeSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} non valido`);
  }
}

function parseMarkdown(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const [, frontmatter, body] = match;
  const meta: Record<string, string> = {};
  frontmatter.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  });

  return { meta, body: body.trim() };
}

function writeContentFile(filePath: string, input: ContentInput): void {
  const oneLine = (value: string) => value.replace(/\r?\n/g, ' ').trim();

  const lines = ['---', `title: ${oneLine(input.title)}`];
  if (input.date) lines.push(`date: ${oneLine(input.date)}`);
  if (input.excerpt) lines.push(`excerpt: ${oneLine(input.excerpt)}`);
  if (input.featured) lines.push('featured: true');
  lines.push('---', '', input.body.trim(), '');

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

export function listCategories(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

export function listContent(category?: string): ContentItem[] {
  const categories = category ? [category] : listCategories();
  const items: ContentItem[] = [];

  for (const cat of categories) {
    if (!SAFE_SEGMENT.test(cat)) continue;
    const dir = path.join(CONTENT_DIR, cat);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const slug = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { meta, body } = parseMarkdown(raw);

      items.push({
        slug,
        category: cat,
        title: meta.title || slug,
        date: meta.date,
        excerpt: meta.excerpt,
        body,
        featured: meta.featured === 'true',
      });
    }
  }

  return items.sort((a, b) => (a.date || '').localeCompare(b.date || '') * -1);
}

export function getContentItem(category: string, slug: string): ContentItem | undefined {
  assertSafeSegment(category, 'categoria');
  assertSafeSegment(slug, 'slug');
  return listContent(category).find(item => item.slug === slug);
}

export function createContentItem(input: ContentInput): ContentItem {
  const category = slugify(input.category);
  const slug = slugify(input.slug || input.title);
  if (!category) throw new Error('La categoria è obbligatoria');
  if (!slug) throw new Error('Il titolo è obbligatorio');

  const filePath = path.join(CONTENT_DIR, category, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    throw new Error('Esiste già un contenuto con questo titolo in questa categoria');
  }

  writeContentFile(filePath, input);
  return getContentItem(category, slug)!;
}

export function updateContentItem(
  originalCategory: string,
  originalSlug: string,
  input: ContentInput
): ContentItem {
  assertSafeSegment(originalCategory, 'categoria');
  assertSafeSegment(originalSlug, 'slug');

  const oldPath = path.join(CONTENT_DIR, originalCategory, `${originalSlug}.md`);
  if (!fs.existsSync(oldPath)) throw new Error('Contenuto non trovato');

  const newCategory = slugify(input.category);
  const newSlug = slugify(input.slug || input.title);
  if (!newCategory) throw new Error('La categoria è obbligatoria');
  if (!newSlug) throw new Error('Il titolo è obbligatorio');

  const newPath = path.join(CONTENT_DIR, newCategory, `${newSlug}.md`);
  if (newPath !== oldPath && fs.existsSync(newPath)) {
    throw new Error('Esiste già un contenuto con questo titolo in questa categoria');
  }

  writeContentFile(newPath, input);
  if (newPath !== oldPath) fs.unlinkSync(oldPath);

  return getContentItem(newCategory, newSlug)!;
}

export function deleteContentItem(category: string, slug: string): void {
  assertSafeSegment(category, 'categoria');
  assertSafeSegment(slug, 'slug');

  const filePath = path.join(CONTENT_DIR, category, `${slug}.md`);
  if (!fs.existsSync(filePath)) throw new Error('Contenuto non trovato');
  fs.unlinkSync(filePath);
}
