# Laya (modelo de decisión abierto) servido por Ollaya en un Space de Hugging Face (CPU gratis).
# Probado con ollaya 0.17.0. Para fijar la versión exacta usa el digest:
#   FROM ghcr.io/ollaya-dev/ollaya@sha256:9066089aa4a84e25a5cd990db5a8dcd7f03503256ccc41ad9c4feb2f2b159d07
FROM ghcr.io/ollaya-dev/ollaya:latest

# La imagen ya corre como el usuario 1000, que es el que usa Hugging Face.
ENV OLLAYA_MODELS=/home/ollaya/.ollaya/models

# El modelo (~700 MB) se descarga al construir: así el Space arranca sin bajar nada y sin
# depender del registro cuando se despierta. Para bajarlo hace falta el servidor encendido.
RUN ollaya serve > /tmp/build-serve.log 2>&1 & \
    for i in $(seq 1 60); do ollaya ps > /dev/null 2>&1 && break; sleep 1; done; \
    ollaya pull laya:multilingual && ollaya list; \
    ollaya stop || true

# Hugging Face solo expone el 7860. OLLAYA_API_KEY llega como secreto del Space (nunca va en este
# archivo): con ella, el servidor rechaza cualquier petición sin `Authorization: Bearer <clave>`.
# KEEP_ALIVE=-1 deja el modelo cargado, sin caducidad; MAX_QUEUE evita colas eternas en CPU.
ENV OLLAYA_HOST=0.0.0.0:7860 \
    OLLAYA_KEEP_ALIVE=-1 \
    OLLAYA_MAX_QUEUE=16

COPY --chown=1000:1000 start.sh /home/ollaya/start.sh
# Por si el archivo se subió desde Windows con saltos de línea CRLF.
RUN sed -i 's/\r$//' /home/ollaya/start.sh
EXPOSE 7860
ENTRYPOINT ["sh", "/home/ollaya/start.sh"]
