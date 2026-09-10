import { GalleryItem } from './types';

const API_BASE_URL = 'http://localhost:3000/api';

const app = document.getElementById('app') as HTMLElement;
const modal = document.getElementById('modal') as HTMLElement;
const modalBody = document.getElementById('modal-body') as HTMLElement;
const modalClose = document.getElementById('modal-close') as HTMLElement;

let currentFilter = 'Tutti';

// Routing Client-side
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    target.classList.add('active');
    
    const page = target.getAttribute('data-page');
    if (page === 'home') renderHome();
    else if (page === 'gallery') renderGallery();
    else if (page === 'about') renderAbout();
  });
});

// Render della Home Page Descrittiva
function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <h1>Benvenuti su La Tana di Ariel</h1>
      <p>Un diario aperto dove si intrecciano racconti di vacanze e viaggi nella natura, insieme a creazioni artigianali uniche fatte a mano con materiali sostenibili.</p>
    </section>
    <section class="grid" id="featured-grid"></section>
  `;
  fetchGalleryItems().then(items => {
    const featuredGrid = document.getElementById('featured-grid');
    if (featuredGrid) {
      featuredGrid.innerHTML = items.slice(0, 2).map(createCardHTML).join('');
      attachCardEvents(items);
    }
  });
}

// Render Galleria Completa con Filtri
async function renderGallery() {
  app.innerHTML = `
    <div class="filter-bar">
      <button class="filter-btn ${currentFilter === 'Tutti' ? 'active' : ''}" data-cat="Tutti">Tutti</button>
      <button class="filter-btn ${currentFilter === 'Ingegneria' ? 'active' : ''}" data-cat="Ingegneria">Ingegneria</button>
      <button class="filter-btn ${currentFilter === 'Sviluppo Web' ? 'active' : ''}" data-cat="Sviluppo Web">Sviluppo Web</button>
      <button class="filter-btn ${currentFilter === 'Galleria' ? 'active' : ''}" data-cat="Galleria">Galleria</button>
    </div>
    <div class="grid" id="gallery-grid"></div>
  `;

  // Attach filter events
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = (e.target as HTMLElement).getAttribute('data-cat') || 'Tutti';
      currentFilter = cat;
      renderGallery();
    });
  });

  const items = await fetchGalleryItems(currentFilter);
  const grid = document.getElementById('gallery-grid');
  if (grid) {
    grid.innerHTML = items.map(createCardHTML).join('');
    attachCardEvents(items);
  }
}

// Render Pagina Chi Siamo Descrittiva
function renderAbout() {
  app.innerHTML = `
    <section class="hero">
      <h1>Chi Siamo</h1>
      <p><strong>La Tana di Ariel</strong> nasce dalla passione per i viaggi autentici e dal desiderio di dare nuova vita ai materiali naturali e di recupero.</p>
    </section>
  `;
}

// Helpers
async function fetchGalleryItems(category?: string): Promise<GalleryItem[]> {
  try {
    const url = category && category !== 'Tutti' 
      ? `${API_BASE_URL}/gallery?category=${encodeURIComponent(category)}`
      : `${API_BASE_URL}/gallery`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error('Errore nel caricamento dei dati:', err);
    return [];
  }
}

function createCardHTML(item: GalleryItem): string {
  return `
    <article class="card" data-id="${item.id}">
      <img src="${item.imageUrl}" alt="${item.title}" loading="lazy" />
      <div class="card-content">
        <div class="card-tag">${item.category}</div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-desc">${item.description}</p>
      </div>
    </article>
  `;
}

function attachCardEvents(items: GalleryItem[]) {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const item = items.find(i => i.id === id);
      if (item) openModal(item);
    });
  });
}

function openModal(item: GalleryItem) {
  modalBody.innerHTML = `
    <img src="${item.imageUrl}" alt="${item.title}" class="modal-img" />
    <div class="card-tag">${item.category}</div>
    <h2>${item.title}</h2>
    <p style="margin: 0.8rem 0; color: var(--text-muted);">${item.description}</p>
    ${item.details ? `
      <ul style="padding-left: 1.2rem; color: var(--accent);">
        ${item.details.map(d => `<li>${d}</li>`).join('')}
      </ul>
    ` : ''}
  `;
  modal.classList.remove('hidden');
}

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

// Avvio iniziale
renderHome();
