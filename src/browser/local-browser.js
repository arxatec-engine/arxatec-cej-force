import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { availableDebuggingPort } from './debugging-port.js';
import { setTimeout } from 'node:timers/promises';
import { ProfileEndpoint } from './profile-endpoint.js';
import { CdpReadiness } from './cdp-readiness.js';
import { ChromeProcess } from './chrome-process.js';

/** Inicia un Chrome dedicado y conecta por CDP, sin WebDriver. */
export class LocalBrowser {
  constructor(options, view) {
    this.options = options;
    this.view = view;
  }

  async connect(signal) {
    const { profileDirectory, timeoutMs } = this.options;
    signal?.throwIfAborted();
    await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
    const profile = new ProfileEndpoint(profileDirectory);
    let endpoint = await profile.find(signal);
    const reused = Boolean(endpoint);
    let chrome;
    let browser;
    try {
      if (reused) {
        this.view?.info(`Chrome del perfil ya está abierto; usando CDP en el puerto ${new URL(endpoint).port}.`);
      } else {
        chrome = new ChromeProcess(this.options, await availableDebuggingPort());
        chrome.start();
        this.view?.info(`Chrome iniciado; esperando CDP en el puerto ${chrome.port}.`);
        endpoint = await new CdpReadiness().wait(chrome, timeoutMs, signal);
        await profile.remember(endpoint);
        if (this.options.startupUrl && this.options.startupDelayMs) {
          await setTimeout(this.options.startupDelayMs, undefined, { signal });
        }
        chrome.checkAlive();
        endpoint = await new CdpReadiness().wait(chrome, timeoutMs, signal);
      }
      signal?.throwIfAborted();
      browser = await puppeteer.connect({
        browserWSEndpoint: endpoint,
        defaultViewport: null,
        protocolTimeout: timeoutMs,
      });
      const pages = !reused && this.options.startupUrl ? await browser.pages() : [];
      const page = pages.find(page => page.url() === this.options.startupUrl) || pages[0] || null;
      return {
        browser, page, reused,
        release: async () => {
          await browser.disconnect();
          await chrome?.stop();
        },
      };
    } catch (error) {
      await browser?.disconnect();
      await chrome?.stop();
      throw error;
    }
  }
}
