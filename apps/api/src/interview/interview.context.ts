/**
 * Datos de contexto que acompañan a la entrevista (hora, día de la semana, tiempo).
 * Viajan siempre como datos en el `state` de las decisiones, nunca dentro de las
 * instrucciones. De momento va vacío; más adelante se rellenará con Open-Meteo.
 */
export interface InterviewContext {
  hora?: string;
  diaSemana?: string;
  tiempo?: { descripcion: string; temperaturaC: number };
}

export async function collectContext(): Promise<InterviewContext> {
  return {};
}

/** Lo que se sabe de la persona antes de las preguntas, listo para el `state`. */
export function stateExtras(session: { context: InterviewContext; initialText: string | null }) {
  return {
    contexto: session.context,
    ...(session.initialText ? { textoInicialDeLaPersona: session.initialText } : {}),
  };
}
