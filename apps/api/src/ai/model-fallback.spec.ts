import { coolDown, isBadOutput, isModelGone, isTransient, modelOrder, withModelFallback } from './model-fallback.js';

describe('cortacircuitos de modelos', () => {
  it('manda al final el modelo apartado y lo recupera al expirar', () => {
    const now = Date.now();
    coolDown('lento', now + 60_000);
    expect(modelOrder(['lento', 'rapido', 'reserva'], now)).toEqual(['rapido', 'reserva', 'lento']);
    expect(modelOrder(['lento', 'rapido'], now + 61_000)).toEqual(['lento', 'rapido']);
  });

  it('trata la cuota por minuto y la saturación como errores pasajeros (salta al respaldo)', () => {
    expect(isTransient(new Error('You exceeded your current quota, please check your plan'))).toBe(true);
    expect(isTransient(new Error('This model is currently experiencing high demand'))).toBe(true);
    expect(isTransient(new Error('Invalid JSON schema'))).toBe(false);
  });

  it('ante una respuesta mal formada prueba el siguiente modelo sin apartar el primero', async () => {
    expect(isBadOutput(new Error('Failed to generate JSON. Please adjust your prompt.'))).toBe(true);
    expect(isBadOutput(new Error('Generated JSON does not match the expected schema.'))).toBe(true);
    expect(isTransient(new Error('Failed to generate JSON. Please adjust your prompt.'))).toBe(false);
    const calls: string[] = [];
    const call = async (model: string) => {
      calls.push(model);
      if (model === 'gpt-oss' && calls.length === 1) throw new Error('Failed to generate JSON');
      return model;
    };
    expect(await withModelFallback(['gpt-oss', 'qwen'], call)).toBe('qwen');
    expect(await withModelFallback(['gpt-oss', 'qwen'], call)).toBe('gpt-oss');
  });
});

describe('modelo retirado (404)', () => {
  it('lo salta y prueba el siguiente, en vez de cortar la cadena', async () => {
    const gone = Object.assign(new Error('Not Found'), { statusCode: 404 });
    expect(isModelGone(gone)).toBe(true);
    expect(isModelGone(new Error('Invalid JSON schema'))).toBe(false);
    const call = async (model: string) => {
      if (model === 'retirado') throw gone;
      return model;
    };
    expect(await withModelFallback(['retirado', 'vivo'], call)).toBe('vivo');
    // y queda apartado: la siguiente vez ni se intenta primero
    expect(modelOrder(['retirado', 'vivo'])[0]).toBe('vivo');
  });
});
