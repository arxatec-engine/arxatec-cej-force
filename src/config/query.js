import { readFile } from 'node:fs/promises';

/** Lee y valida los datos que debe ingresar la consulta por filtros. */
export async function loadQuery(file) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  const fields = ['district', 'instance', 'specialty', 'year', 'number', 'party'];
  for (const name of fields) {
    if (typeof data[name] !== 'string' || !data[name].trim()) {
      throw new Error(`La consulta necesita ${name} de tipo string y no vacío.`);
    }
  }
  if (!/^\d{4}$/.test(data.year) || !/^\d{1,5}$/.test(data.number)) {
    throw new Error('Usa un año de cuatro dígitos y un expediente de uno a cinco dígitos.');
  }
  return Object.fromEntries(fields.map(name => [name, data[name].trim()]));
}
