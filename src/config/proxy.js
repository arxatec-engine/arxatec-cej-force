import { createHash } from 'node:crypto';

/** Valida el proxy y normaliza URLs estándar o cadenas exportadas por Evomi. */
export function loadProxy(env, mode) {
  const value = env.PROXY_URL?.trim();
  if (!value) return null;
  if (mode !== 'local') throw new Error('PROXY_URL requiere BROWSER_MODE=local.');
  let url;
  try {
    const exported = value.match(/^(https?):\/\/([^\s/:]+):(\d+):([^\s:]+):(.+)$/);
    if (exported) {
      url = new URL(`${exported[1]}://${exported[2]}:${exported[3]}`);
      url.username = encodeURIComponent(exported[4]);
      url.password = encodeURIComponent(exported[5]);
    } else {
      url = new URL(value);
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname
      || url.pathname !== '/' || url.search || url.hash
      || Boolean(url.username) !== Boolean(url.password) || /[\r\n]/.test(value)) throw new Error();
    url.username = encodeURIComponent(decodeURIComponent(url.username));
    url.password = encodeURIComponent(decodeURIComponent(url.password));
  } catch {
    throw new Error('PROXY_URL inválido: usa http(s)://usuario:clave@host:puerto '
      + 'o http(s)://host:puerto:usuario:clave.');
  }
  return {
    url: url.href, server: url.origin,
    username: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    id: createHash('sha256').update(url.href).digest('hex').slice(0, 16),
  };
}

export function loadProxyCheck(env) {
  let url;
  try { url = new URL(env.PROXY_CHECK_URL || 'https://ip.evomi.com/'); } catch {
    throw new Error('PROXY_CHECK_URL debe ser una URL HTTP(S).');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('PROXY_CHECK_URL debe ser una URL HTTP(S) sin credenciales.');
  }
  const expectedCountry = (env.PROXY_EXPECTED_COUNTRY || 'PE').toUpperCase();
  if (!/^[A-Z]{2}$/.test(expectedCountry)) throw new Error('PROXY_EXPECTED_COUNTRY debe tener dos letras, como PE.');
  return { url: url.href, expectedCountry };
}
