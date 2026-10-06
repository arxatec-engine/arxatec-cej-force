/** Mantiene el transporte activo y guarda cookies sin recargar la página. */
export class SessionHeartbeat {
  constructor(session, view, intervalMs, onFailure) {
    Object.assign(this, { session, view, intervalMs, onFailure });
  }

  start() {
    this.timer = setInterval(() => {
      if (this.pending) return;
      this.pending = this.tick().finally(() => { this.pending = null; });
    }, this.intervalMs);
  }

  async tick() {
    try {
      await this.session.ping();
      await this.session.saveCookies();
    } catch (error) {
      clearInterval(this.timer);
      this.view.error(error);
      this.onFailure(error);
    }
  }

  async stop() {
    clearInterval(this.timer);
    await this.pending;
  }
}
