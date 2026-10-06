import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Persiste evidencia del navegador para éxitos y bloqueos. */
export class ArtifactRepository {
  constructor(directory, storage) {
    this.directory = directory;
    this.storage = storage;
  }

  async save(page, name, metadata) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const files = {
      json: join(this.directory, `${name}.json`),
      html: join(this.directory, `${name}.html`),
      screenshot: join(this.directory, `${name}.png`),
    };
    await this.storage.write(files.json, metadata);
    await writeFile(files.html, await page.content(), { mode: 0o600 });
    await page.screenshot({ path: files.screenshot, fullPage: true });
    await chmod(files.screenshot, 0o600);
    return files;
  }

  async diagnostic(page, error, httpStatus) {
    return this.save(page, 'diagnostico', {
      capturedAt: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      httpStatus,
      error: error.message,
      text: await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || ''),
    });
  }
}
