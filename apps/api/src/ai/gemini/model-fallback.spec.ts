import { coolDown, isTransient, modelOrder } from './gemini.providers.js';

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
});
