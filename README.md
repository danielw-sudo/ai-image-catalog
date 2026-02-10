# ⚡ GenLog - AI Generation Log

A tiny, elegant tool for AIGC creators to catalog AI-generated images and prompts. Built as a static site that runs entirely in the browser — no backend required.

**Live demo:** [danielw-sudo.github.io/ai-image-catalog](https://danielw-sudo.github.io/ai-image-catalog/)

## Features

- **Card gallery** with image preview, prompt display, platform badges, and tags
- **Search & filter** by platform (Gemini, Grok, Meta AI, ChatGPT/DALL-E, Midjourney, etc.)
- **Add / Edit / Delete entries** directly from the browser
- **GitHub API integration** — save entries straight to your repo, no CLI needed
- **Dark mode** with persistent toggle
- **Share to X** — one-click sharing with pre-filled prompt text
- **Prompt copy** — click to copy any prompt to clipboard
- **Pagination** — loads 12 entries at a time with "Load More"
- **Download fallback** — export markdown + JSON files when offline
- **Responsive design** — works on desktop, tablet, and mobile
- **Zero dependencies** — pure vanilla HTML, CSS, and JavaScript

## How It Works

Each entry is stored in two places:

| File | Purpose |
|------|---------|
| `entries.json` | Master index — the app reads this to render the gallery |
| `entries/<slug>.md` | Human-readable markdown file per entry, great for git history |

When you save via the GitHub API, GenLog updates both files in a single flow. You can also browse the `entries/` folder directly on GitHub for a nice readable view.

## Quick Start

1. **Fork or clone** this repo
2. **Enable GitHub Pages** (Settings > Pages > Source: main branch, root)
3. **Open the site** and click the status button in the toolbar to configure:
   - GitHub username
   - Repository name
   - Branch (default: `main`)
   - Personal Access Token (fine-grained, with Contents read/write permission)
4. **Add your first entry** — click "+ Add Entry", fill in the form, and hit "Save to GitHub"

### Getting a Personal Access Token

1. Go to **GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens**
2. Click **Generate new token**
3. Select your repository under **Repository access**
4. Under **Permissions**, grant **Contents: Read and write**
5. Copy the token and paste it into GenLog's settings panel

Your token is stored in `localStorage` — it never leaves your browser.

## Entry Format

Each markdown entry follows this structure:

```markdown
### My Image Title

![My Image Title](https://example.com/image.jpg)

- **Platform:** Gemini
- **Date:** 2025-02-08
- **Tags:** landscape, fantasy

> The prompt you used to generate this image...
```

## Tech Stack

- **HTML/CSS/JavaScript** — zero frameworks, zero build steps
- **GitHub Pages** — free static hosting
- **GitHub Contents API** — CRUD operations directly from the browser
- **localStorage** — persists settings and dark mode preference

## Project Structure

```
ai-image-catalog/
├── index.html          # Main page
├── style.css           # All styles including dark mode
├── script.js           # All application logic (~950 lines)
├── entries.json        # Master entry index
├── entries/            # Individual markdown files
│   ├── entry-one.md
│   └── entry-two.md
└── README.md
```

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Vibe coded with [Claude AI](https://claude.ai/code) · Made by Daniel
