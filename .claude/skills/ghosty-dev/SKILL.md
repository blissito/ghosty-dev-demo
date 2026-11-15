---
name: ghosty-dev
description: Trabajar con la bitácora del repo (pendientes en GitHub Issues que se cierran con evidencia). Úsala al empezar cualquier tarea de código en un repo con etiquetas ghosty-dev:*, cuando pidan «toma el siguiente pendiente», «cierra el #n» o cuando descubras trabajo nuevo.
---

# Bitácora: el trabajo vive en GitHub Issues, no en tu sesión

Tu sesión se puede tirar en cualquier momento. Lo que importa queda en el **pendiente** (un issue con etiqueta
`ghosty-dev:*`). Tres leyes, sin excepción:

1. **El trabajo vive en la bitácora, no en la sesión.** Lo pendiente, lo decidido y lo descubierto se escribe en
   el issue, no en tu contexto ni en un TODO de markdown.
2. **Se revisa la evidencia, no el código.** Nunca digas «ya quedó» sin evidencia; nunca cierres sin el
   comentario de evidencia.
3. **Se espera por evento, no se sondea.** No te quedes vigilando el CI: deja el pendiente en `esperando` y
   termina.

## El ciclo

```sh
ghosty-dev ready --json            # qué se puede tomar (listo, desbloqueado o CI ya resuelto)
ghosty-dev claim <n>               # te lo asigna y crea su worktree y su rama ghosty-dev/<n>-…
cd ../<repo>-<n>                 # trabaja SÓLO ahí: un pendiente, un worktree, un escritor
# … código y tests …
git push -u origin HEAD && gh pr create --fill --body "Closes #<n>"
ghosty-dev wait <n>                # CI corriendo: termina tu sesión aquí
```

Cuando `ghosty-dev ready` te devuelva el pendiente con `ci-verde` (o `ci-rojo`, entonces arréglalo y repite):

```sh
ghosty-dev evidence <n> --file evidencia.md   # valida el formato y lo publica en el issue
```

El PR lo mergea el **Clerk** (la persona) después de leer la evidencia; `Closes #<n>` cierra el pendiente.
Si no hubo PR (tarea sin código), `ghosty-dev close <n>`, que también exige evidencia.

## El archivo de evidencia

~~~markdown
## Qué se hizo
Una o dos frases concretas.

## Verificación
```sh
$ npm test
<salida real, copiada, no resumida>
```

## CI
✅ passed — <liga del run>

## Preview
<liga o video del recorrido, o «no aplica»>

## Criterios de aceptación
- [x] <cada criterio del pendiente, con el mismo texto>
~~~

Reglas: la salida es la real (si la recortas, dilo); un criterio que no se cumple se queda `[ ]` y no publicas;
CI rojo no se publica como evidencia.

## Abrir pendientes desde la plática

Cuando la persona te diga qué hay que hacer («hay que paginar /pedidos»), tú abres el pendiente. Escribe un
objetivo (qué debe quedar cierto) y criterios que se puedan comprobar. Si son varios, uno por pendiente, y marca
los bloqueos. Enséñale a la persona la lista antes de crearlos.

```sh
ghosty-dev add "Paginar /pedidos" --goal "GET /pedidos responde por páginas de 20" \
  --criteria "acepta ?page=N" --criteria "hay un test por página"
ghosty-dev add "Exportar CSV" --goal "…" --criteria "…" --by 12   # bloqueado por #12
```

## Lo que descubras

Si encuentras un bug, un test roto que no es tuyo o trabajo que falta: **abre un pendiente nuevo**, no una nota
ni un comentario perdido, y sigue con el tuyo.

```sh
ghosty-dev add "título" --goal "…" --criteria "…" --from <n>
# si tu pendiente no puede seguir sin él:
ghosty-dev block <n> --by <nuevo>
```

## Prohibido

- Tomar un pendiente asignado a otro, o trabajar dos pendientes en el mismo worktree.
- Cerrar un issue con `gh issue close` directo, o publicar evidencia que no corriste.
- Dormir/sondear esperando CI (`sleep`, `gh run watch`, loops).
- Calificarte a ti mismo como revisión: la revisión la hace otra sesión o la persona, leyendo sólo el pendiente,
  la evidencia y el diff.
