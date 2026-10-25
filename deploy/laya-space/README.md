---
title: Laya Decider
emoji: 🧭
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Laya (modelo de decisión abierto) servido con Ollaya
---

# Laya en un Space de Docker

Servidor [Ollaya](https://github.com/ollaya-dev/ollaya) con el modelo `laya:multilingual` para las
decisiones de la entrevista de Sintonía. Habla el mismo protocolo que Jev (`POST /v1/systemone`),
así que la API de Sintonía lo usa cambiando solo la URL.

- **Protegido con clave**: el secreto `OLLAYA_API_KEY` del Space es obligatorio. Sin él, el
  contenedor no arranca. Toda petición lleva `Authorization: Bearer <clave>`.
- **Puerto 7860**, el que exige Hugging Face.
- El modelo se descarga al construir la imagen y se precalienta al arrancar.

Guía completa y variables de la API: sección «Laya en Hugging Face» de `docs/ESTADO.md`.
