import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createWorker, PSM } from 'tesseract.js';

/** Reconoce capturas localmente con el modelo inglés instalado por npm. */
parentPort.once('message', async ({ variants }) => {
  let worker;
  try {
    const require = createRequire(import.meta.url);
    const languageDirectory = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
    worker = await createWorker('eng', 1, {
      langPath: join(languageDirectory, '4.0.0_best_int'),
      cachePath: workerData.cacheDirectory,
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      user_defined_dpi: '300',
    });
    const readings = [];
    for (const variant of variants) {
      const { data } = await worker.recognize(Buffer.from(variant.image));
      readings.push({ variant: variant.name, text: data.text, confidence: data.confidence });
    }
    parentPort.postMessage({ result: readings });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  } finally {
    await worker?.terminate();
  }
});
