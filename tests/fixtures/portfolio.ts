// Independent content contract, cross-checked against https://pplo.dev on 2026-10-17.
// Project tags include editorial categories; they do not verify an unpublished stack.
export const expectedProjects = [
  {
    id: 'i3rbly', title: 'I3rbly', hardware: 'gpu', url: 'https://a3rbly.com',
    tech: ['Python', 'NLP', 'Deep Learning'],
  },
  {
    id: 'pplo-gpt', title: 'PPLO-GPT', hardware: 'gpu', url: 'https://pplo.vercel.app',
    tech: ['Python', 'Machine Learning', 'Conversational AI'],
  },
  {
    id: 'steam1st', title: 'Steam1st Store', hardware: 'ram-0', url: 'https://steam1st.store',
    tech: ['Flask', 'Python', 'PostgreSQL'],
  },
  {
    id: 'alcoders', title: 'Alcoders', hardware: 'ram-1', url: 'https://alcoders.com',
    tech: ['Community', 'Full Stack', 'Developer Platform'],
  },
  {
    id: 'easybio', title: 'EasyBio — Dr. Abdelrahman', hardware: 'ram-2', url: 'https://easybio-drabdelrahman.com',
    tech: ['EdTech', 'Full Stack', 'Learning Platform'],
  },
  {
    id: 'kotobee', title: 'Kotobee', hardware: 'ram-3', url: 'https://kotobee.com',
    tech: ['Backend', 'E-learning', 'Platform Engineering'],
  },
] as const;

export const expectedIdentity = {
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

export const expectedContacts = [
  { name: 'Email', value: 'youssefdev74@gmail.com', href: 'mailto:youssefdev74@gmail.com' },
  { name: 'GitHub', value: 'youssef-pplo', href: 'https://github.com/youssef-pplo' },
  { name: 'Instagram', value: '@pplo.dev', href: 'https://instagram.com/pplo.dev' },
  { name: 'WhatsApp', value: '+20 109 173 4838', href: 'https://wa.me/201091734838' },
  { name: 'pplo.dev', value: 'pplo.dev', href: 'https://pplo.dev' },
] as const;

export const expectedArsenal = [
  { id: 'focus', title: 'In focus', items: ['Python — AI, automation, and backend systems'] },
  { id: 'languages', title: 'Languages', items: ['Python', 'JavaScript', 'TypeScript', 'PHP', 'C++', 'Lua', 'Dart', 'Java', 'Go', 'Rust', 'SQL', 'Bash'] },
  { id: 'ai', title: 'AI / ML', items: ['TensorFlow', 'PyTorch', 'OpenCV', 'NumPy', 'Pandas', 'Scikit-learn', 'Keras', 'Hugging Face', 'LangChain', 'YOLO'] },
  { id: 'fullstack', title: 'Full stack', items: ['Django', 'Flask', 'FastAPI', 'Express', 'Node.js', 'React', 'Next.js', 'Vue', 'Tailwind CSS', 'Three.js'] },
  { id: 'devops', title: 'DevOps & tools', items: ['Git', 'Docker', 'Kubernetes', 'Linux', 'AWS', 'Google Cloud', 'Vercel', 'PostgreSQL', 'MongoDB', 'Redis', 'Figma'] },
  { id: 'mobile', title: 'Mobile & desktop', items: ['Flutter', 'React Native', 'Electron', 'Android SDK', 'iOS', 'Xamarin'] },
  { id: 'creative', title: 'Design & creative coding', items: ['Photoshop', 'Illustrator', 'After Effects', 'Blender', 'GSAP', 'WebGL'] },
  { id: 'systems', title: 'Problem solving', items: ['Algorithms', 'Data Structures', 'System Design', 'Code Review', 'Debugging', 'Optimization'] },
] as const;

export const expectedChapters = [
  { id: 'void', range: [0, 0.14], hardware: null },
  { id: 'pcb', range: [0.14, 0.30], hardware: 'pcb' },
  { id: 'cpu', range: [0.30, 0.45], hardware: 'cpu' },
  { id: 'gpu', range: [0.45, 0.62], hardware: 'gpu' },
  { id: 'ram', range: [0.62, 0.80], hardware: 'ram-0' },
  { id: 'nvme', range: [0.80, 0.92], hardware: 'nvme-0' },
  { id: 'io', range: [0.92, 1], hardware: 'io' },
] as const;

export const hardwareIds = [
  'pcb', 'cpu', 'gpu', 'ram-0', 'ram-1', 'ram-2', 'ram-3', 'nvme-0', 'nvme-1', 'pch', 'io',
] as const;

export const ramProgress = [0.6425, 0.6875, 0.7325, 0.7775] as const;
