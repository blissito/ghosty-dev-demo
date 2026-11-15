# ghosty-dev-demo

Repo de prueba para [ghosty-dev](https://github.com/blissito/ghosty-dev): un servidor HTTP mínimo en Node, sin
dependencias.

## Requisitos

Node 20 o más. No hay dependencias que instalar.

## Arrancarlo

```sh
npm start
```

Escucha en el puerto **3000**. Para usar otro puerto, pásalo en la variable `PORT`:

```sh
PORT=8080 npm start
```

## Rutas

`GET /health` dice si el servidor está vivo:

```sh
$ curl localhost:3000/health
{"ok":true}
```

`GET /version` regresa la versión que dice `package.json`:

```sh
$ curl localhost:3000/version
{"version":"1.0.0"}
```

Las dos aceptan `HEAD` y la barra final (`/health/`). Cualquier otra ruta responde 404, y una URL mal formada
responde 400.

## Tests

```sh
npm test
```
