# Portfolio

Everything you see (text, projects, skills, links, effects) comes from **`site.config.js`**. Edit it, save, and the page updates.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Live preview at http://localhost:5173 (refreshes your LeetCode graph first) |
| `npm run build` | Builds the final site into `dist/` (refreshes your LeetCode graph first) |
| `npm run preview` | Serves `dist/` locally so you can check the final build |
| `npm run sync` | Only downloads your latest LeetCode graph |

## Images to add (in the `public/` folder)

| File | What it is |
|---|---|
| `scene.jpg` | The student-at-a-laptop picture shown on `/about`. Until it exists, your rotating portrait is shown instead. Its outlines (`face.scene.mask` in the config) were drawn by eye, so check the result and adjust them if parts of the background show. |
| `signature.png` | Your signature for the footer (dark ink on any light background, or a transparent PNG). Skipped if missing. |
| `face.png` | Your portrait (already there). |

## Contact form

Messages are sent to `contact.form.toEmail` through an email-forwarding service, because a static site has no server.
By default it uses FormSubmit: **the very first message you send makes FormSubmit email you an "Activate" link. Click it once**, and every message after that arrives normally.
To keep your address out of the page, get a free key at web3forms.com and paste it into `contact.form.accessKey`.

## Keeping the LeetCode graph up to date

`.github/workflows/deploy.yml` rebuilds and redeploys the site to GitHub Pages every 6 hours (and on every push to `main`),
and every build downloads your latest graph first. One-time setup: push this folder to a GitHub repo, then in the repo go to
*Settings -> Pages -> Source* and choose **GitHub Actions**.
