# ghosty-dev-demo

Repo de prueba para [ghosty-dev](https://github.com/blissito/ghosty-dev): un servidor HTTP mínimo en Node, sin
dependencias.

## Requisitos

Node 20 o más.

## Instalar

```sh
git clone https://github.com/blissito/ghosty-dev-demo
cd ghosty-dev-demo
npm install
```

## Arrancar

```sh
npm start              # escucha en http://localhost:3000
PORT=8080 npm start    # en otro puerto
```

## Tests

```sh
npm test
```

## Endpoints

| Método | Ruta      | Respuesta            |
| ------ | --------- | -------------------- |
| GET    | `/health` | `200 {"ok":true}`    |

```sh
curl http://localhost:3000/health
# {"ok":true}
```
