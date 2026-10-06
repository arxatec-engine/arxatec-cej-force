import { readFile } from 'node:fs/promises';

/** Valida los pasos opcionales antes de abrir el navegador. */
export async function loadActions(file) {
  if (!file) return [];
  const actions = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(actions)) throw new Error('ACTIONS_FILE debe contener un array.');
  for (const action of actions) {
    if (!action || !['fill', 'select', 'click', 'wait', 'captcha'].includes(action.type)) {
      throw new Error('Las acciones permitidas son fill, select, click, wait y captcha.');
    }
    if (action.type !== 'captcha' && (typeof action.selector !== 'string' || !action.selector.trim())) {
      throw new Error('Cada acción necesita un selector.');
    }
    if (['fill', 'select'].includes(action.type) && typeof action.value !== 'string') {
      throw new Error('fill y select necesitan un value de tipo string.');
    }
    if (action.waitForNavigation !== undefined && typeof action.waitForNavigation !== 'boolean') {
      throw new Error('waitForNavigation debe ser booleano.');
    }
    if (action.visible !== undefined && typeof action.visible !== 'boolean') {
      throw new Error('visible debe ser booleano.');
    }
  }
  return actions;
}
