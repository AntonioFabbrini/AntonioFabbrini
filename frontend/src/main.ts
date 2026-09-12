const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const subscribeForm = document.getElementById('subscribeForm') as HTMLFormElement | null;

if (subscribeForm) {
  subscribeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fine = document.getElementById('subscribeFine');
    const thanks = document.getElementById('subscribeThanks');
    const row = subscribeForm.querySelector<HTMLElement>('.subscribe-row');
    if (row) row.style.display = 'none';
    if (fine) fine.style.display = 'none';
    if (thanks) thanks.style.display = 'block';
  });
}

// ---------- Contenuti dalla Tana (backend) ----------

const API_BASE_URL = 'http://localhost:3000/api';
const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

// Le immagini dei contenuti (es. /uploads/xyz.jpg) sono servite dal backend,
// non dal frontend: vanno risolte rispetto all'origine del backend.
function resolveImageUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${BACKEND_ORIGIN}${url}`;
}

interface ContentItem {
  slug: string;
  category: string;
  title: string;
  date?: string;
  excerpt?: string;
  body: string;
  featured?: boolean;
  image?: string;
}

async function fetchContent(category: string): Promise<ContentItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/content?category=${encodeURIComponent(category)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function pickFeatured(items: ContentItem[]): ContentItem | undefined {
  return items.find((item) => item.featured) || items[0];
}

// Icona decorativa mostrata al posto della foto quando un contenuto non ne ha
// ancora una, coerente con le icone già usate nei riquadri della home.
const CATEGORY_ICONS: Record<string, string> = {
  ariel: `
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M22 30c-5-4-9-7.4-9-11.8C13 15 15.4 13 18 13c1.8 0 3.2 1 4 2.4.8-1.4 2.2-2.4 4-2.4 2.6 0 5 2 5 5.2 0 4.4-4 7.8-9 11.8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>
  `,
  olivia: `
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M10 28 Q22 12 34 28" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="14" cy="29" r="3" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="30" cy="29" r="3" stroke="currentColor" stroke-width="1.6"/>
    </svg>
  `,
  bottega: `
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M14 18l8-6 8 6v10a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M19 30v-6h6v6" stroke="currentColor" stroke-width="1.6"/>
    </svg>
  `,
  tana: `
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M9 30c0-9 6-16 13-16s13 7 13 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M9 30h26" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `,
};
const DEFAULT_ICON = CATEGORY_ICONS.tana;

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || DEFAULT_ICON;
}

// Restituisce il markup per l'immagine di anteprima di un contenuto: la foto
// reale se presente, altrimenti un'icona decorativa della categoria.
function renderMedia(item: ContentItem, imageClass: string, placeholderClass: string): string {
  return item.image
    ? `<img class="${imageClass}" src="${resolveImageUrl(item.image)}" alt="">`
    : `<div class="${placeholderClass}">${getCategoryIcon(item.category)}</div>`;
}

// ---------- Modale di lettura racconto ----------

const storyModal = document.getElementById('storyModal');
const storyModalBackdrop = document.getElementById('storyModalBackdrop');
const storyModalClose = document.getElementById('storyModalClose');
const storyModalCategory = document.getElementById('storyModalCategory');
const storyModalTitle = document.getElementById('storyModalTitle');
const storyModalBody = document.getElementById('storyModalBody');

function openStoryModal(item: ContentItem) {
  if (!storyModal || !storyModalTitle || !storyModalBody) return;

  if (storyModalCategory) storyModalCategory.textContent = item.category;
  storyModalTitle.textContent = item.title;

  const imageHtml = renderMedia(item, 'story-modal-image', 'story-modal-image story-modal-placeholder');
  const bodyHtml = item.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('');
  storyModalBody.innerHTML = imageHtml + bodyHtml;

  storyModal.classList.remove('hidden');
  storyModal.setAttribute('aria-hidden', 'false');
}

function closeStoryModal() {
  if (!storyModal) return;
  storyModal.classList.add('hidden');
  storyModal.setAttribute('aria-hidden', 'true');
}

storyModalBackdrop?.addEventListener('click', closeStoryModal);
storyModalClose?.addEventListener('click', closeStoryModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeStoryModal();
});

// Aggiorna l'anteprima (titolo + teaser) di ogni riquadro Ariel/Olivia/Bottega
// nella home, con il racconto segnato come `featured: true` in
// backend/src/content/<categoria>/. Il riquadro rimanda poi alla pagina
// della categoria per leggere tutte le storie.
async function hydratePathCard(category: string) {
  const card = document.getElementById(category);
  if (!card) return;

  const items = await fetchContent(category);
  const featured = pickFeatured(items);
  if (!featured) return;

  const titleEl = card.querySelector('.sample .title');
  const teaserEl = card.querySelector('.sample .teaser');
  if (titleEl) titleEl.textContent = featured.title;
  if (teaserEl) teaserEl.textContent = featured.excerpt || '';
}

// Popola l'elenco completo dei racconti di una categoria nella sua pagina
// dedicata (ariel.html, olivia.html, bottega.html, tana.html). Ogni racconto
// si apre nel modale al click.
async function hydrateCategoryList() {
  const list = document.getElementById('storyList');
  if (!list) return;

  const category = list.getAttribute('data-category');
  if (!category) return;

  const items = await fetchContent(category);
  const emptyMsg = list.querySelector<HTMLElement>('.story-list-empty');

  if (items.length === 0) {
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }
  if (emptyMsg) emptyMsg.hidden = true;

  const cards = items
    .map(
      (item) => `
        <article class="story-card" data-slug="${item.slug}">
          ${renderMedia(item, 'story-card-image', 'story-card-placeholder')}
          <div class="story-card-body">
            <h3>${item.title}${item.featured ? ' ⭐' : ''}</h3>
            ${item.excerpt ? `<p class="teaser">${item.excerpt}</p>` : ''}
            <span class="story-cta">Leggi il racconto →</span>
          </div>
        </article>
      `
    )
    .join('');
  list.insertAdjacentHTML('beforeend', cards);

  list.querySelectorAll<HTMLElement>('.story-card').forEach((card) => {
    card.addEventListener('click', () => {
      const slug = card.getAttribute('data-slug');
      const item = items.find((i) => i.slug === slug);
      if (item) openStoryModal(item);
    });
  });
}

// Popola la vetrina della Bottega (bottega.html) con tutti gli oggetti
// handmade: foto quando presente (altrimenti un'icona), nome e anteprima.
// Il click apre il dettaglio completo nel modale.
async function hydrateShopGrid() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;

  const category = grid.getAttribute('data-category');
  if (!category) return;

  const items = await fetchContent(category);
  const emptyMsg = grid.querySelector<HTMLElement>('.story-list-empty');

  if (items.length === 0) {
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }
  if (emptyMsg) emptyMsg.hidden = true;

  const cards = items
    .map(
      (item) => `
        <article class="shop-card" data-slug="${item.slug}">
          ${renderMedia(item, 'shop-card-image', 'shop-card-placeholder')}
          <div class="shop-card-body">
            <h3>${item.title}${item.featured ? ' ⭐' : ''}</h3>
            ${item.excerpt ? `<p class="teaser">${item.excerpt}</p>` : ''}
            <span class="story-cta">Scopri di più →</span>
          </div>
        </article>
      `
    )
    .join('');
  grid.insertAdjacentHTML('beforeend', cards);

  grid.querySelectorAll<HTMLElement>('.shop-card').forEach((card) => {
    card.addEventListener('click', () => {
      const slug = card.getAttribute('data-slug');
      const item = items.find((i) => i.slug === slug);
      if (item) openStoryModal(item);
    });
  });
}

// Popola la lettera del manifesto ("Perché scriviamo") con il testo letto
// da backend/src/content/tana/.
async function hydrateManifesto() {
  const letter = document.querySelector('#tana .letter');
  if (!letter) return;

  const items = await fetchContent('tana');
  const item = items.find((i) => i.slug === 'perche-scriviamo') || items[0];
  if (!item) return;

  const paragraphs = item.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const signoff = paragraphs[paragraphs.length - 1]?.startsWith('—') ? paragraphs.pop() : undefined;

  letter.innerHTML =
    paragraphs.map((p) => `<p>${p}</p>`).join('') +
    (signoff ? `<p class="signoff">${signoff}</p>` : '');
}

hydratePathCard('ariel');
hydratePathCard('olivia');
hydratePathCard('bottega');
hydrateManifesto();
hydrateCategoryList();
hydrateShopGrid();
