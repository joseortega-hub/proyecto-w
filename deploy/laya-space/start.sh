#!/bin/sh
# Arranca Ollaya y precalienta Laya: carga el modelo en memoria y lo deja residente,
# para que la primera decisión real no pague los ~30 s de carga en CPU.
if [ -z "$OLLAYA_API_KEY" ]; then
  echo "AVISO: falta el secreto OLLAYA_API_KEY; el Space quedaría abierto a cualquiera. No arranco." >&2
  exit 1
fi

ollaya serve &
SERVER=$!

for i in $(seq 1 60); do
  ollaya ps > /dev/null 2>&1 && break
  sleep 1
done

ollaya run laya:multilingual --ask "¿Listo?" --keepalive -1 > /dev/null 2>&1 \
  && echo "Laya precalentado" || echo "Precalentado fallido (la API lo reintenta)"

wait $SERVER
