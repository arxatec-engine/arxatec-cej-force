import { join } from 'node:path';
import { CaptchaTokenWriter } from './captcha-token-writer.js';
import { TwoCaptchaSolver } from './two-captcha-solver.js';
import { CaptchaImage } from './captcha-image.js';
import { CaptchaPreprocessor } from './captcha-preprocessor.js';
import { CaptchaAudio } from './captcha-audio.js';
import { OcrCaptchaSolver } from './ocr-captcha-solver.js';
import { OcrClient } from '../infrastructure/ocr-client.js';

/** Compone el adaptador de CAPTCHA elegido sin acoplar el flujo al motor OCR. */
export function createCaptchaSolver(config, view, storage) {
  const options = config.captcha;
  const writer = new CaptchaTokenWriter();
  if (options.mode === '2captcha') return new TwoCaptchaSolver(options, writer);
  if (options.mode !== 'ocr') return null;
  return new OcrCaptchaSolver({
    image: new CaptchaImage(options.imageSelector, join(config.outputDirectory, 'captcha.png')),
    preprocessor: new CaptchaPreprocessor(),
    client: new OcrClient(options.cacheDirectory, options.timeoutMs),
    writer, audio: options.audioFallback ? new CaptchaAudio() : null,
    options, view, storage, readingFile: join(config.outputDirectory, 'captcha-lectura.json'),
  });
}
