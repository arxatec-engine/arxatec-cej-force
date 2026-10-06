/** Extrae el contrato DOM de formularios, también dentro de iframes. */
export class FormInspector {
  constructor(target) {
    this.target = target;
  }

  async inspect(page) {
    const forms = [];
    for (const frame of page.frames()) {
      try {
        const found = await frame.evaluate(readForms, this.target);
        forms.push(...found.map(form => ({ ...form, frameUrl: frame.url() })));
      } catch (error) {
        if (!/detached|Execution context was destroyed|Cannot find context/i.test(error.message)) {
          throw error;
        }
      }
    }
    return forms;
  }
}

function readForms({ formSelector, requiredText }) {
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const selectorFor = element => {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const parts = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const siblings = [...node.parentElement.children].filter(item => item.tagName === node.tagName);
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
    }
    return `html > ${parts.join(' > ')}`;
  };
  const readField = field => ({
    tag: field.tagName.toLowerCase(),
    type: field.type || field.tagName.toLowerCase(),
    id: field.id || null,
    name: field.name || null,
    selector: selectorFor(field),
    label: normalize([...(field.labels || [])].map(label => label.textContent).join(' ')
      || field.getAttribute('aria-label') || field.getAttribute('title')
      || field.placeholder || field.textContent || ''),
    value: field.type === 'password' ? null : field.value,
    required: field.required || false,
    disabled: field.disabled || false,
    visible: Boolean(field.getClientRects().length),
    checked: ['checkbox', 'radio'].includes(field.type) ? field.checked : undefined,
    options: field.tagName === 'SELECT'
      ? [...field.options].map(option => ({
        value: option.value,
        text: normalize(option.textContent),
        selected: option.selected,
        disabled: option.disabled,
      })) : undefined,
  });
  const controls = 'input, select, textarea, button';
  const sharedFields = [...document.querySelectorAll(controls)]
    .filter(field => !field.form && field.getClientRects().length).map(readField);
  const captchaImages = [...document.querySelectorAll('img')]
    .filter(img => /captcha/i.test(`${img.id} ${img.alt}`) && img.getClientRects().length)
    .map(img => ({ selector: selectorFor(img), src: img.src, alt: img.alt }));
  return [...document.querySelectorAll(formSelector)]
    .filter(form => {
      const text = normalize(form.textContent || '').toLocaleLowerCase();
      return text.includes(normalize(requiredText).toLocaleLowerCase())
        && form.querySelector('input:not([type="hidden"]), select, textarea')
        && form.getClientRects().length;
    })
    .map(form => ({
      id: form.id || null,
      name: form.getAttribute('name'),
      selector: selectorFor(form),
      action: form.action || null,
      method: (form.method || 'get').toUpperCase(),
      html: form.outerHTML,
      fields: [...form.querySelectorAll(controls)].map(readField),
      sharedFields,
      captchaImages,
    }));
}
