/** Las opciones activas primero (en su orden) y después el resto, para que se vean sin deslizar. */
export const activeFirst = <T extends { key: string }>(options: T[], value: string[]) => [
  ...options.filter((o) => value.includes(o.key)),
  ...options.filter((o) => !value.includes(o.key)),
]
