/**
 * ─────────────────────────────────────────────────────────────
 *  YOUR PORTFOLIO — EDIT THIS FILE ONLY
 * ─────────────────────────────────────────────────────────────
 *  Everything on the site (text, projects, skills, links, face,
 *  effects) is read from here.
 *
 *  Commands (run in this folder):
 *    npm run dev       live preview at http://localhost:5173
 *                      (the page reloads whenever you save this file)
 *    npm run sync      downloads your latest LeetCode graph (do this before each build)
 *    npm run build     produces the final site in the /dist folder
 *    npm run preview   serves /dist locally to check the final build
 *
 *  Text markup:  *word*  = highlighted word,   ~~word~~  = crossed-out word
 */

export default {
  // ── Basics ────────────────────────────────────────────────
  name: "Shivam Vishwakarma",
  role: "Backend & AI Developer",
  // Used for the browser tab and search engines
  description:
    "IT student at VIT Pune building distributed systems, APIs and RAG pipelines in Go and Python.",

  // ── Navigation (each one is its own page) ────────────────
  // `target` must be one of: about | work | skills | contact
  nav: [
    { label: "/about", target: "about" },
    { label: "/work", target: "work" },
    { label: "/skills", target: "skills" },
    { label: "/contact", target: "contact" },
  ],
  github: { label: "GitHub", url: "https://github.com/shivam-vishwakarmaa" },

  // ── /about (typewriter text next to the figure) ──────────
  about: {
    lines: [
      "Hello there! My name is *Shivam*.",
      "I'm a backend and AI developer, studying IT at VIT Pune.",
      "I build distributed systems, design APIs, and integrate AI.",
      "For me, it's all about building systems that are fast and useful.",
    ],
    typingSpeedMs: 28, // delay per character
  },

  // ── The ASCII figure on /about ────────────────────────────
  face: {
    // "scene"       = the student working at a laptop (needs public/scene.jpg), with typing animation.
    //                 If the picture is missing, the site falls back to your rotating portrait.
    // "photo"       = your own picture (public/face.png) rotating in 3D.
    // "placeholder" = a generic 3D bust that spins all the way round.
    mode: "scene",

    scene: {
      image: "/scene.jpg", // put the picture in the /public folder
      columns: 105, // how many characters wide the scene is (more = more detail, slower)
      // The picture's background is removed with these outlines (x, y points). Anything outside them is
      // dropped, which is how only the student, laptop, desk and chair are kept. `maskSize` is the width
      // and height of the original picture, so you can read coordinates straight off it in any image editor.
      maskSize: [1000, 667],
      mask: [
        // the student: head, headphones, sweatshirt, arm and hands
        [[585, 250], [586, 200], [588, 160], [574, 135], [572, 100], [590, 75], [630, 55], [680, 45], [725, 58], [755, 95], [766, 140], [770, 200], [772, 260], [800, 300], [850, 340], [890, 395], [908, 470], [912, 560], [905, 640], [890, 667], [640, 667], [640, 595], [600, 575], [560, 556], [505, 556], [445, 543], [398, 522], [393, 500], [420, 488], [470, 478], [520, 470], [548, 440], [575, 390], [600, 330], [632, 290], [640, 268], [615, 262], [600, 235]],
        // the laptop
        [[220, 388], [346, 380], [410, 498], [524, 552], [414, 568], [300, 520], [226, 480]],
        // the desk
        [[0, 602], [120, 578], [225, 566], [300, 548], [400, 572], [520, 555], [640, 565], [640, 667], [0, 667]],
        // the chair
        [[892, 468], [935, 452], [1000, 448], [1000, 667], [892, 667]],
      ],
      // Where things move, as ellipses (x, y = centre; rx, ry = radius) in fractions of the picture
      motion: {
        hands: { x: 0.475, y: 0.772, rx: 0.085, ry: 0.05 }, // fingers tap on the keyboard
        forearm: { x: 0.57, y: 0.76, rx: 0.08, ry: 0.06 }, // forearm follows the typing
        head: { x: 0.67, y: 0.235, rx: 0.11, ry: 0.19 }, // head nods and leans a little
        torso: { x: 0.8, y: 0.62, rx: 0.12, ry: 0.25 }, // body breathes
      },
      // Code symbols that float up from the laptop screen
      code: { x: 0.33, y: 0.58, count: 7, rise: 14 },
    },

    // Portrait settings (used by mode "photo", and as the fallback for "scene")
    photo: "/face.png",
    photoCutoff: 0,
    photoInvert: false,
    photoLandmarks: { top: 0.012, brow: 0.337, eyes: 0.359, noseTip: 0.429, mouth: 0.501, chin: 0.575 },
    photoCenterX: 0.5,
    photoRotation: "spin", // "spin" = full 360, "swing" = rocks left and right
    photoSwingDegrees: 38,
    spinSecondsPerTurn: 10, // seconds per full rotation
    columns: 120,
    rows: 80,
  },

  // ── LeetCode graph + bubble-shooter game (bottom of /about) ──
  leetcode: {
    username: "_shivamvishwa", // `npm run sync` downloads this user's graph
    url: "https://leetcode.com/u/_shivamvishwa/",
    heading: "My LeetCode submissions in the past year.",
    subheading: "… now with bubbles. Aim, click, and *pop* them responsibly.",
    demo: true, // plays itself until you touch it
  },

  // ── /work ─────────────────────────────────────────────────
  // `categories` make the filter chips; `stack` is the tech list; `highlights` are the proof points.
  work: {
    heading: "Systems, Apps, and ~~Bugs~~.",
    projects: [
      {
        title: "Distributed Rate Limiting Middleware",
        description:
          "A Go reverse proxy with four rate-limiting algorithms written as atomic Redis Lua scripts, so concurrent requests can never be over-admitted.",
        highlights: [
          "5,000+ req/s at p50 < 1ms and p99 < 2.6ms under k6 load",
          "Circuit breaker with in-memory fallback: served 531k requests with Redis killed mid-test and no incorrect denials",
          "94.8% test coverage across 151 tests, a 7-stage CI pipeline and a distroless image",
        ],
        categories: ["System", "Dev Tool"],
        stack: ["Go", "Redis", "Lua", "Docker", "Prometheus", "k6", "GitHub Actions"],
        github: "https://github.com/shivam-vishwakarmaa/Distributed-Rate-Limiting-Middleware",
      },
      {
        title: "Production-Grade RAG System",
        description:
          "An end-to-end retrieval-augmented generation service with semantic chunking, dense vector retrieval and per-stage latency telemetry.",
        highlights: [
          "0.92 faithfulness, 0.89 context precision and 0.91 context recall on a 30-pair Ragas benchmark",
          "3-tier pytest suite in CI blocks any pull request that degrades retrieval metrics by more than 5%",
        ],
        categories: ["System", "Data & AI"],
        stack: ["Python", "FastAPI", "Ragas", "Pytest", "Docker Compose", "GitHub Actions"],
        github: "https://github.com/shivam-vishwakarmaa/Production-Grade-RAG-System",
      },
      {
        title: "ShivamPay",
        description:
          "A digital payment and lending platform with an atomic ledger built on MongoDB multi-document ACID sessions.",
        highlights: [
          "Concurrent debit/credit tests showed no double-spends under parallel load",
          "Compound-interest schedules and instant loan foreclosure, secured with PIN authorization and Zod validation across 15+ endpoints",
        ],
        categories: ["Web App"],
        stack: ["MongoDB", "Express.js", "React.js", "Node.js", "Razorpay API", "JWT", "Zod"],
        github: "https://github.com/shivam-vishwakarmaa/shivam-pay",
        live: "https://shivam-pay.vercel.app",
      },
      {
        title: "NoteVault AI",
        description:
          "An offline OCR and local-LLM study assistant. 2nd Runner-Up at GenAI Hackathon 2026.",
        categories: ["Data & AI", "Dev Tool"],
        stack: ["OCR", "Local LLM", "Offline-first"],
        // add a repo or demo link when you have one: github: "https://github.com/...",
      },
    ],
  },

  // ── /skills ───────────────────────────────────────────────
  skills: {
    heading: ["What I do.", "What I use.", "What I am."], // the last line gets the highlight
    intro: [
      "I'm a *backend & AI developer* who enjoys building things that scale.",
      "I build *distributed systems*, *APIs*, and *AI-powered services*.",
      "I like problems where *correctness under load* matters.",
    ],
    sections: [
      {
        name: "Engineering Practices",
        items: ["Distributed Systems", "Concurrency", "API Security", "Data Structures & Algorithms", "OOP", "DBMS"],
      },
      { name: "Programming Languages", items: ["Go", "Python", "C++", "Java", "JavaScript", "SQL"] },
      {
        name: "Backend & Frameworks",
        items: ["Go net/http", "FastAPI", "Node.js", "Express.js", "REST APIs", "React.js"],
      },
      { name: "Databases", items: ["Redis", "PostgreSQL", "MongoDB", "MySQL", "Vector Databases"] },
      {
        name: "Data & AI",
        items: ["Retrieval-Augmented Generation", "Ragas Evaluation", "Semantic Chunking", "Dense Vector Retrieval"],
      },
      { name: "Developer Tools", items: ["Docker", "GitHub Actions", "Prometheus", "k6", "Pytest", "Git & GitHub"] },
      {
        name: "Education & Achievements",
        lines: true, // one item per line
        items: [
          "B.Tech in Information Technology, VIT Pune: CGPA 8.85/10 (2024 – 2028)",
          "550+ DSA problems solved on LeetCode: peak contest rating 1710, rank 1956 of 45,000+ in Weekly Contest 518",
          "GenAI Hackathon 2026: 2nd Runner-Up for NoteVault AI",
          "DSA Coordinator at GedIT Coding Club: mentored 60+ junior students",
        ],
      },
    ],
  },

  // ── /contact ──────────────────────────────────────────────
  contact: {
    heading: "Have an *idea* in mind?",
    subheading: "Let's bring it to life!",
    note: "I'm open to internships: May – July 2027 (summer) or January – June 2028 (6 months).",
    links: [
      { label: "svshivamshailendra@gmail.com", url: "mailto:svshivamshailendra@gmail.com" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/shivamvishwakarma8/" },
      { label: "LeetCode", url: "https://leetcode.com/u/_shivamvishwa/" },
      { label: "Codeforces", url: "https://codeforces.com/profile/Shivam-Vishwakarma" },
    ],
    // Where the contact form sends messages. A static site has no server, so the message is handed to an
    // email-forwarding service that delivers it to `toEmail`:
    //   - leave `accessKey` empty to use FormSubmit (no signup; the first message you ever send makes it email
    //     you an "Activate" link, click it once and every message after that arrives normally), or
    //   - paste a free access key from https://web3forms.com (enter your email there, the key arrives by
    //     email) to use Web3Forms instead, which keeps your address out of the page.
    form: {
      toEmail: "svshivamshailendra@gmail.com",
      accessKey: "",
      subject: "New portfolio message",
    },
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    signature: "/signature.png", // your signature image in /public (dark ink on a light background, or transparent)
    text: "© {year} Shivam Vishwakarma. All rights reserved.", // {year} is filled in automatically
  },

  // ── Look & feel ───────────────────────────────────────────
  theme: {
    default: "dark", // "dark" | "light" | "system"
  },
  effects: {
    grain: true, // TV-static noise that never stops moving
    grainFps: 24,
    vignette: true, // dark edges
    scanlines: true, // faint horizontal lines
    flicker: true, // very slight screen brightness flicker
    glow: true, // soft blur-glow on text, like an old monitor
  },
};
