---
# Memoria de la caja de trabajo de Ghosty (instalar, construir y probar): de 4gb a 8gb, múltiplos de 1 GB.
memory: 4gb
# «Ghosty · Smoke»: páginas o pasos (con método y cuerpo JSON) que deben dar 2xx en la vista previa de cada PR, ya con
# sesión (identidad ghosty-smoke). Pon la FUNCIÓN PRINCIPAL, no sólo /login: un smoke de /login pasó en verde con el
# chat roto (Formmy #73). Quita los # y cámbialos:
# smoke:
#   - /ruta-de-la-funcion-principal
#   - POST /api/accion-principal {"campo":"valor"}
---
Configuración de la fábrica de Ghosty Studio para este repo.

- `memory:` es la memoria de la caja donde los agentes instalan, construyen y prueban este repo (y la de su
  preview). Va de 4gb (la de siempre) a 8gb (el tope), en múltiplos de 1 GB; la de 8gb cuenta como dos cajas
  del plan. `ghosty-dev init` eligió 4gb porque no hay señales de monorepo ni de build pesado (la caja de siempre).
- Si el build revienta por memoria («JavaScript heap out of memory», «Killed», código 137), mide el pico con
  `/usr/bin/time -v npm run build` en Linux («Maximum resident set size») o `/usr/bin/time -l npm run build`
  en macOS, deja ~1 GB de holgura y sube `memory:`. El cambio aplica a la siguiente caja que nazca.
- Abajo de esta lista van las convenciones del repo que deben saber los agentes (pruebas, estilo, qué no tocar).
