import { prisma } from './lib/prisma';

async function main() {
  const r = await prisma.contact.findFirst({
    where: { name: { contains: 'Kirian' } },
    select: { airtableId: true, experiences: true, name: true }
  });
  console.log('NAME:', r?.name);
  console.log('airtableId:', r?.airtableId);
  if (r?.experiences) {
    try {
      const parsed = JSON.parse(r.experiences);
      console.log('PARSE: OK, items:', Array.isArray(parsed) ? parsed.length : 'not array');
    } catch(e: any) {
      console.log('PARSE FAIL:', e.message);
      console.log('RAW:', r.experiences.slice(0, 100));
    }
  }
}
main().finally(() => prisma.$disconnect());
