# Consulta y validación de identidad

```sh
npm run query
```

El comando abre el CEJ, obtiene el formulario, ingresa los criterios de
`config/cej-query.json` y pulsa el botón real **Consultar**. Cuando aparece el modal
de identidad, selecciona DNI, ingresa los datos del archivo privado y pulsa **Validar**.
Comprueba la respuesta del CEJ y guarda si la identidad fue aceptada o rechazada.
El navegador sigue abierto hasta Ctrl+C. Para cerrar después de capturar:

```sh
npm run query -- --once
```

## Datos configurados

| Campo | Valor |
| --- | --- |
| Distrito judicial | JUNIN |
| Instancia | JUZGADO ESPECIALIZADO |
| Especialidad | LABORAL |
| Año | 2024 |
| Número de expediente | 116 |
| Parte | AGUIRRE GONZALO |

Las opciones se buscan por su etiqueta, tolerando acentos y esperando su carga
mediante AJAX. Cada valor se comprueba después de escribirlo.

## Identidad del consultante

Los datos se leen de `data/consultant-identity.json`, excluido de Git. El archivo
actual contiene los datos proporcionados para esta ejecución. Para otro equipo,
copia `examples/identity.example.json` a esa ruta y completa sus cinco campos.
Las fechas usan YYYY-MM-DD en el archivo; el navegador las presenta según su idioma.
Primero se selecciona DNI porque el CEJ limpia los campos al cambiar de documento.

```dotenv
VALIDATE_IDENTITY=true
IDENTITY_FILE=./data/consultant-identity.json
IDENTITY_TIMEOUT_MS=60000
```

VALIDATE_IDENTITY=false conserva el flujo anterior que se detiene con el modal vacío.
Un rechazo de identidad se informa sin volver a enviar los mismos datos. Si el CEJ
rechaza el CAPTCHA y lo renueva, se lee el nuevo desafío antes de otro intento.

## CAPTCHA vigente

El script captura únicamente `#captcha_image` en `output/captcha.png`.
Tesseract.js lee variantes de color, contraste y máscara del fondo rojo.
El modelo inglés está instalado mediante npm; la imagen se procesa localmente.
Se aceptan cuatro letras/dígitos con suficiente confianza, sin sustituir O por 0
ni reutilizar el código de una captura anterior.

Si el OCR no ofrece una lectura fiable y CAPTCHA_AUDIO_FALLBACK=true, el script
pulsa el botón de audio del CEJ y toma el código de esa respuesta accesible.
La lectura y sus variantes quedan registradas en `output/captcha-lectura.json`.
Si el sitio rechaza el CAPTCHA, se renueva y se vuelve a leer; hay tres intentos
por defecto. Un error de navegación o un bloqueo Radware no dispara ese reintento.

```dotenv
CAPTCHA_MODE=ocr
CAPTCHA_TYPE=image
CAPTCHA_IMAGE_SELECTOR="#captcha_image"
CAPTCHA_RESPONSE_SELECTOR="#codigoCaptcha"
OCR_MIN_CONFIDENCE=60
CAPTCHA_AUDIO_FALLBACK=true
CAPTCHA_TIMEOUT_MS=120000
QUERY_TIMEOUT_MS=45000
QUERY_CAPTCHA_ATTEMPTS=3
QUERY_FILE=./config/cej-query.json
```

Los selectores que comienzan con `#` deben estar entre comillas en `.env`;
sin comillas, Node interpreta el símbolo como inicio de un comentario.
Puedes desactivar el respaldo de audio para exigir una lectura únicamente OCR.
También puedes elegir CAPTCHA_MODE=2captcha y configurar TWOCAPTCHA_API_KEY
para usar el adaptador de pago existente.

## Evidencia guardada

- `output/consulta-preparada.*`: datos y CAPTCHA ingresados antes del clic.
- `output/validacion-identidad.*`: JSON, HTML y captura del modal verificado.
- `output/identidad-preparada.*`: modal rellenado antes del clic en Validar.
- `output/identidad-respuesta.*`: respuesta del CEJ; su JSON excluye el token de validación.
- `output/consulta-final.*`: estado final del flujo.
- `output/captcha.png`: desafío exacto leído durante esa ejecución.
- `output/captcha-lectura.json`: método, código y lecturas OCR.
- `output/diagnostico.*`: información de un intento fallido.

El estado identity-validated requiere confirmación del CEJ; pulsar Validar no basta.
Si el CEJ rechaza los datos, el estado es identity-rejected y el proceso usa código
de salida 1. El navegador permanece abierto hasta Ctrl+C salvo que uses --once.
Al aceptar la identidad, el CEJ inicia su consulta de resultados automáticamente.
Radware puede impedir que aparezca el formulario; en ese caso el script conserva
el diagnóstico y no declara alcanzado el modal.
