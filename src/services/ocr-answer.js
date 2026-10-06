/** Selecciona lecturas completas sin corregir caracteres ambiguos a ciegas. */
export function selectOcrAnswer(readings, minConfidence, length = 4) {
  const valid = readings.map(reading => ({
    ...reading, text: reading.text.replace(/\s/g, '').toUpperCase(),
  })).filter(reading => new RegExp(`^[A-Z0-9]{${length}}$`).test(reading.text));
  const votes = new Map();
  for (const reading of valid) votes.set(reading.text, (votes.get(reading.text) || 0) + 1);
  valid.sort((left, right) => votes.get(right.text) - votes.get(left.text)
    || right.confidence - left.confidence);
  const answer = valid[0];
  return answer?.confidence >= minConfidence ? answer : null;
}
