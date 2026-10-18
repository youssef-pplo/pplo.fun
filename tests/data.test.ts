import { describe, expect, it } from 'vitest';
import { arsenal, chapters, contacts, identity, projects } from '../src/data';
import { getRamIndex } from '../src/scene/choreography';
import {
  expectedArsenal,
  expectedContacts,
  expectedIdentity,
  expectedProjects,
  hardwareIds,
  ramProgress,
} from './fixtures/portfolio';

// These checks are deliberately offline: external availability is not a content contract.
describe('published portfolio content', () => {
  it('preserves the biography, identity, location, availability, and actual interests', () => {
    expect(identity).toEqual(expectedIdentity);
    expect(identity.bio).toContain('age 8');
    expect(identity.bio).toContain('currently pursuing higher education with a focus on AI');
    expect(identity.bio).toContain('Python, Machine Learning, and Full-Stack Development');
    expect(identity.interests).toEqual(['Psychoanalysis', 'Chess', 'Real Madrid']);
  });

  it('contains exactly the six real project destinations and their intended hardware', () => {
    expect(projects.map(({ id, title, hardware, url, tech }) => ({ id, title, hardware, url, tech }))).toEqual(expectedProjects);
    expect(new Set(projects.map(({ id }) => id)).size).toBe(6);
    expect(new Set(projects.map(({ url }) => url)).size).toBe(6);
    expect(projects.map(({ index }) => index)).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it.each(expectedProjects)('keeps $title linked directly to $url', (expected) => {
    const project = projects.find(({ id }) => id === expected.id);
    expect(project).toBeDefined();
    const url = new URL(project!.url);
    expect(['http:', 'https:']).toContain(url.protocol);
    expect(url.href.replace(/\/$/, '')).toBe(expected.url.replace(/\/$/, ''));
    expect(url.username).toBe('');
    expect(url.password).toBe('');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    for (const field of [project!.title, project!.shortTitle, project!.description, project!.category, project!.role, project!.spec]) {
      expect(field.trim().length).toBeGreaterThan(0);
      expect(field).not.toMatch(/lorem ipsum|placeholder|coming soon|example\.com/i);
    }
  });

  it('retains source-backed project descriptions without inventing named framework stacks', () => {
    const project = (id: string) => projects.find((item) => item.id === id)!;
    expect(project('i3rbly').description).toMatch(/Arabic grammatical analysis/);
    expect(project('i3rbly').description).toMatch(/Four years of research and development/);
    expect(project('domino').description).toMatch(/Domino game built in less than two hours/);
    expect(project('max-playstore').description).toMatch(/PlayStation games/);
    expect(project('alcoders').description).toMatch(/developer community and coding platform/i);
    expect(project('easybio').description).toMatch(/biology students in Egyptian secondary schools/);
    expect(project('kotobee').description).toMatch(/Backend development for an e-learning platform/);

    // The source does not name frameworks for these three platforms. Keep their
    // labels descriptive rather than assigning React, Django, or other stacks.
    for (const id of ['alcoders', 'easybio', 'kotobee']) {
      const expected = expectedProjects.find((item) => item.id === id)!;
      expect(project(id).tech).toEqual(expected.tech);
      expect([project(id).description, ...project(id).tech].join(' ')).not.toMatch(
        /React|Next\.js|Django|Flask|Laravel|TensorFlow|PyTorch|PostgreSQL|MongoDB|AWS/i,
      );
    }
  });

  it('maps the AI pair and the four RAM projects one-to-one', () => {
    expect(projects.filter(({ hardware }) => hardware === 'gpu').map(({ id }) => id)).toEqual(['i3rbly', 'domino']);
    const ram = projects.filter(({ hardware }) => hardware.startsWith('ram-'));
    expect(ram.map(({ hardware }) => hardware)).toEqual(['ram-0', 'ram-1', 'ram-2', 'ram-3']);
    expect(ram.map(({ id }) => id)).toEqual(['max-playstore', 'alcoders', 'easybio', 'kotobee']);
    ramProgress.forEach((progress, index) => {
      expect(ram[getRamIndex(progress)].id).toBe(ram[index].id);
    });
    for (const { hardware } of [...projects, ...chapters]) {
      if (hardware !== null) expect(hardwareIds).toContain(hardware);
    }
  });

  it('keeps the complete published skill list, with no added technology claims', () => {
    expect(arsenal).toEqual(expectedArsenal);
    expect(arsenal).toHaveLength(8);
    const skills = arsenal.flatMap(({ items }) => [...items]);
    expect(skills).toHaveLength(62);
    expect(new Set(skills).size).toBe(skills.length);
    for (const category of arsenal) {
      expect(category.items.length).toBeGreaterThan(0);
      for (const item of category.items) expect(item.trim()).toBe(item);
    }
  });

  it('preserves all five real contact routes, including normalized WhatsApp digits', () => {
    expect(contacts.map(({ name, value, href }) => ({ name, value, href }))).toEqual(expectedContacts);
    expect(new Set(contacts.map(({ href }) => href)).size).toBe(5);
    for (const contact of contacts) {
      expect(contact.label.trim()).not.toBe('');
      const url = new URL(contact.href);
      expect(['https:', 'mailto:']).toContain(url.protocol);
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    }
    const email = contacts.find(({ name }) => name === 'Email')!;
    expect(email.href).toBe(`mailto:${email.value}`);
    const whatsapp = contacts.find(({ name }) => name === 'WhatsApp')!;
    expect(new URL(whatsapp.href).pathname.slice(1)).toBe(whatsapp.value.replace(/\D/g, ''));
  });
});
