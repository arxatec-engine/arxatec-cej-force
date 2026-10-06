/** Describe un rechazo del proveedor sin incluir credenciales ni URLs privadas. */
export class ProxyProviderError extends Error {
  constructor(httpStatus, destination) {
    const authentication = [401, 407].includes(httpStatus);
    const advice = httpStatus === 402
      ? 'Revisa el tráfico restante y la vigencia de la prueba en Statistics / Subscription.'
      : authentication ? 'Revisa las credenciales de PROXY_URL.' : 'Revisa la conexión del proveedor.';
    super(`El proveedor proxy rechazó la conexión: HTTP ${httpStatus}. ${advice}`);
    this.name = 'ProxyProviderError';
    this.code = httpStatus === 402 ? 'PROXY_PAYMENT_REQUIRED'
      : authentication ? 'PROXY_AUTHENTICATION_FAILED' : 'PROXY_CONNECTION_FAILED';
    this.httpStatus = httpStatus;
    this.destination = destination;
  }
}
