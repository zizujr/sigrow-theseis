# SiGrow theseis feed

Live vacancy and exam listings for [sigrow.net/theseis](https://sigrow.net/theseis/).

- Page: https://zizujr.github.io/sigrow-theseis/
- JSON API: https://zizujr.github.io/sigrow-theseis/theseis.json

Rebuilt on 27/11/2026 (Asia/Nicosia). Currently **80** vacancy posts and **4** exam announcements, each split into open (upcoming/active) and expired (within 6 months). The embed has two tabs: Θέσεις Εργασίας and Προκηρύξεις Εξετάσεων.

## Embed

Paste the iframe snippet from [`shortcode/embed-snippet.html`](shortcode/embed-snippet.html) into the `#theseis-embed` Elementor HTML widget on the /theseis/ page.

## Files

- `theseis.json` — versioned API (`generated_at`, `posts[]`, `exams[]`)
- `index.html` — iframe page (transparent background, auto-height via `postMessage`)
- `theseis.css`, `theseis.js`, `fonts/` — assets matched to the live sigrow.net design (self-hosted Roboto with Greek)
