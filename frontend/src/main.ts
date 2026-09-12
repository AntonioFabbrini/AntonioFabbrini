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

interface ContentItem {
  slug: string;
  category: string;
  title: string;
  date?: string;
  excerpt?: string;
  body: string;
  featured?: boolean;
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
  storyModalBody.innerHTML = item.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('');

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
          <h3>${item.title}${item.featured ? ' ⭐' : ''}</h3>
          ${item.excerpt ? `<p class="teaser">${item.excerpt}</p>` : ''}
          <span class="story-cta">Leggi il racconto →</span>
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
