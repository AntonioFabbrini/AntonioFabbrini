---
title: Titolo del racconto
date: 2026-01-01
excerpt: Una riga breve che riassume il racconto (usata nelle anteprime).
image: /images/bottega/nome-file.jpg
featured: true
---

Corpo del racconto, in Markdown semplice.

Puoi scrivere più paragrafi lasciando una riga vuota tra uno e l'altro.

---

COME AGGIUNGERE UN NUOVO CONTENUTO:

1. Scegli la categoria giusta tra le cartelle in `backend/src/content/`
   (`ariel`, `olivia`, `tana`, `bottega` — o creane una nuova cartella
   per una nuova sezione, es. `viaggi`).
2. Copia questo file dentro quella cartella con un nome breve e leggibile,
   es. `una-pizza-in-due.md` (diventa lo slug/URL del contenuto).
3. Compila `title`, `date` (facoltativa), `excerpt` (facoltativa) e
   `image` (facoltativa — percorso di una foto, utile soprattutto per
   la Bottega) nel blocco tra `---`, poi scrivi il testo sotto. Metti
   `featured: true` solo sul contenuto che vuoi mostrare in anteprima
   sulla homepage per quella categoria (uno solo per categoria).
4. Cancella questa sezione di istruzioni: nel file reale deve restare
   solo il frontmatter e il testo del racconto.
5. Salva. Il backend legge i file al volo: nessun'altra modifica al
   codice è necessaria — il nuovo contenuto compare subito su
   GET /api/content e GET /api/content/<categoria>/<slug>.
