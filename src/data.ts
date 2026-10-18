import type { Chapter, PortfolioProject } from './types';

export const identity = {
  name: 'Youssef Elsaid',
  alias: 'pplo',
  domain: 'pplo.dev',
  role: 'Software Engineer & AI Architect',
  location: 'Alexandria, Egypt',
  coordinates: '31.2001° N, 29.9187° E',
  availability: 'Available for Hire',
  since: 'Coding since age 8',
  copyright: '© 2016 — 2027',
  bio: "I'm Youssef Elsaid, a passionate Software Engineer and AI Architect from Alexandria, Egypt. My journey in technology began at age 8. Specializing in Python, Machine Learning, and Full-Stack Development, I'm currently pursuing higher education with a focus on AI and aspiring to contribute to groundbreaking innovations in artificial intelligence. When I'm not coding, you'll find me diving into psychoanalysis, playing chess, or supporting Real Madrid.",
  interests: ['Psychoanalysis', 'Chess', 'Real Madrid'],
} as const;

// Public destinations verified against the published pplo.dev portfolio.
export const contacts = [
  { name: 'Email', label: 'Let’s build something.', value: 'youssefdev74@gmail.com', href: 'mailto:youssefdev74@gmail.com' },
  { name: 'GitHub', label: 'Open-source signal', value: 'youssef-pplo', href: 'https://github.com/youssef-pplo' },
  { name: 'Instagram', label: 'Outside the terminal', value: '@pplo.dev', href: 'https://instagram.com/pplo.dev' },
  { name: 'WhatsApp', label: 'Start a conversation', value: '+20 109 173 4838', href: 'https://wa.me/201091734838' },
  { name: 'pplo.dev', label: 'The original portfolio', value: 'pplo.dev', href: 'https://pplo.dev' },
] as const;

export const projects: readonly PortfolioProject[] = [
  {
    id: 'i3rbly', title: 'A3rbly (known as I3rbly)', shortTitle: 'A3RBLY', index: '01', hardware: 'gpu',
    category: 'ARTIFICIAL INTELLIGENCE / NLP',
    description: 'An AI system for Arabic grammatical analysis. Four years of research and development, turning the complexity of Arabic into structured understanding.',
    tech: ['Python', 'NLP', 'Deep Learning'], url: 'https://a3rbly.com',
    spec: 'R&D: 4 YEARS // ARABIC LANGUAGE INTELLIGENCE', role: 'AI research & engineering',
  },
  {
    id: 'domino', title: 'Domino Game', shortTitle: 'DOMINO', index: '02', hardware: 'gpu',
    category: 'GAME DEVELOPMENT / WEB',
    description: 'A small, fast-paced interactive Domino game built in less than two hours. Lightweight, responsive, and playable directly in the browser.',
    tech: ['HTML5', 'JavaScript', 'CSS', 'Game Logic'], url: 'https://domino.pplo.dev',
    spec: 'SPEED BUILD // > 2 HOURS // WEB GAME ENGINE', role: 'Game design & front-end engineering',
  },
  {
    id: 'max-playstore', title: 'Max Play Store', shortTitle: 'MAX PLAY STORE', index: '03', hardware: 'ram-0',
    category: 'COMMERCE / GAMING',
    description: 'A modern digital gaming storefront for PlayStation games, digital gift cards, and gaming subscriptions with instant delivery and seamless checkout.',
    tech: ['React', 'TypeScript', 'E-Commerce', 'Tailwind CSS'], url: 'http://max-playstore.com',
    spec: 'DIMM_A1 // 32 GB // DIGITAL GAMING STORE', role: 'Full-stack & e-commerce development',
  },
  {
    id: 'alcoders', title: 'Alcoders', shortTitle: 'ALCODERS', index: '04', hardware: 'ram-1',
    category: 'COMMUNITY / DEVELOPER TOOLS',
    description: 'A developer community and coding platform. A shared space for people who build, learn, and move technology forward together.',
    tech: ['Community', 'Full Stack', 'Developer Platform'], url: 'https://alcoders.com',
    spec: 'DIMM_A2 // 32 GB // CONNECTED DEVELOPERS', role: 'Platform development',
  },
  {
    id: 'easybio', title: 'EasyBio — Dr. Abdelrahman', shortTitle: 'EASYBIO', index: '05', hardware: 'ram-2',
    category: 'EDUCATION / BIOLOGY',
    description: 'An educational platform for biology students in Egyptian secondary schools, bringing learning and digital tools into the same classroom.',
    tech: ['EdTech', 'Full Stack', 'Learning Platform'], url: 'https://easybio-drabdelrahman.com',
    spec: 'DIMM_B1 // 32 GB // EDUCATION SYSTEMS', role: 'Educational platform development',
  },
  {
    id: 'kotobee', title: 'Kotobee', shortTitle: 'KOTOBEE', index: '06', hardware: 'ram-3',
    category: 'E-LEARNING / BACKEND',
    description: 'Backend development for an e-learning platform. Engineering the systems behind connected, interactive learning experiences.',
    tech: ['Backend', 'E-learning', 'Platform Engineering'], url: 'https://kotobee.com',
    spec: 'DIMM_B2 // 32 GB // LEARNING INFRASTRUCTURE', role: 'Backend development',
  },
];

export const arsenal = [
  { id: 'focus', title: 'In focus', items: ['Python — AI, automation, and backend systems'] },
  { id: 'languages', title: 'Languages', items: ['Python', 'JavaScript', 'TypeScript', 'PHP', 'C++', 'Lua', 'Dart', 'Java', 'Go', 'Rust', 'SQL', 'Bash'] },
  { id: 'ai', title: 'AI / ML', items: ['TensorFlow', 'PyTorch', 'OpenCV', 'NumPy', 'Pandas', 'Scikit-learn', 'Keras', 'Hugging Face', 'LangChain', 'YOLO'] },
  { id: 'fullstack', title: 'Full stack', items: ['Django', 'Flask', 'FastAPI', 'Express', 'Node.js', 'React', 'Next.js', 'Vue', 'Tailwind CSS', 'Three.js'] },
  { id: 'devops', title: 'DevOps & tools', items: ['Git', 'Docker', 'Kubernetes', 'Linux', 'AWS', 'Google Cloud', 'Vercel', 'PostgreSQL', 'MongoDB', 'Redis', 'Figma'] },
  { id: 'mobile', title: 'Mobile & desktop', items: ['Flutter', 'React Native', 'Electron', 'Android SDK', 'iOS', 'Xamarin'] },
  { id: 'creative', title: 'Design & creative coding', items: ['Photoshop', 'Illustrator', 'After Effects', 'Blender', 'GSAP', 'WebGL'] },
  { id: 'systems', title: 'Problem solving', items: ['Algorithms', 'Data Structures', 'System Design', 'Code Review', 'Debugging', 'Optimization'] },
] as const;

export const chapters: readonly Chapter[] = [
  { id: 'void', short: 'VOID', title: 'It starts with a spark.', eyebrow: '01 / THE CODIC VOID', description: 'Ideas become systems. Systems become possibilities.', range: [0, 0.14], hardware: null },
  { id: 'pcb', short: 'PCB', title: 'A foundation for possibility.', eyebrow: '02 / THE MOTHERBOARD', description: 'Every great system starts with thoughtful architecture. Watch the connections come alive.', range: [0.14, 0.30], hardware: 'pcb' },
  { id: 'cpu', short: 'CPU / BIO', title: 'Human at the core.', eyebrow: '03 / THE PROCESSOR', description: 'Curiosity is my operating system. Building since age eight, still asking what comes next.', range: [0.30, 0.45], hardware: 'cpu' },
  { id: 'gpu', short: 'GPU / AI', title: 'Intelligence, accelerated.', eyebrow: '04 / THE NEURAL ENGINE', description: 'From the intricacies of Arabic to conversational intelligence. Research that becomes something real.', range: [0.45, 0.62], hardware: 'gpu' },
  { id: 'ram', short: 'RAM / WORK', title: 'Ideas. Loaded into reality.', eyebrow: '05 / SELECTED WORK', description: 'Four modules. Four platforms. Built for the people who use them.', range: [0.62, 0.80], hardware: 'ram-0' },
  { id: 'nvme', short: 'NVME / ARSENAL', title: 'A constantly evolving arsenal.', eyebrow: '06 / THE KNOWLEDGE BANK', description: '30+ languages and technologies. One principle: use the right tool, not just the familiar one.', range: [0.80, 0.92], hardware: 'nvme-0' },
  { id: 'io', short: 'I/O / CONTACT', title: 'Your next idea. Our next build.', eyebrow: '07 / OPEN CONNECTIONS', description: 'The system is online. Let’s make something worth putting into the world.', range: [0.92, 1], hardware: 'io' },
];
