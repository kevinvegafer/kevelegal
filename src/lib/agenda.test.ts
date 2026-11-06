import { describe, expect, it } from 'vitest';
import { fechaLima, generarHorarios } from './agenda';
const base = {
  franjas: [{ dia: 1, desde: '09:00', hasta: '11:00' }], ocupado: [],
  duracionMin: 30, anticipacionHoras: 0, desde: new Date('2025-07-21T12:00:00Z'), dias: 1, feriados: [],
};
const cuatro = ['2025-07-21T14:00:00.000Z','2025-07-21T14:30:00.000Z','2025-07-21T15:00:00.000Z','2025-07-21T15:30:00.000Z'];
describe('agenda en America/Lima', () => {
  it('lunes 09–11 produce cuatro instantes de media hora', () => {
    expect(generarHorarios(base)).toEqual([{ fecha: '2025-07-21', horarios: cuatro }]);
  });
  it('ocupación 09:30–10 elimina exactamente un horario y permite los adyacentes', () => {
    expect(generarHorarios({ ...base, ocupado: [{ inicio: '2025-07-21T14:30:00Z', fin: '2025-07-21T15:00:00Z' }] })[0]?.horarios)
      .toEqual([cuatro[0], cuatro[2], cuatro[3]]);
  });
  it('omite 28 de julio aunque sea lunes', () => {
    expect(generarHorarios({ ...base, desde: new Date('2025-07-28T12:00:00Z'), feriados: ['2025-07-28'] })).toEqual([]);
  });
  it('anticipación de 2 h desde 07:15 deja 09:30, 10 y 10:30', () => {
    expect(generarHorarios({ ...base, desde: new Date('2025-07-21T12:15:00Z'), anticipacionHoras: 2 })[0]?.horarios).toEqual(cuatro.slice(1));
  });
  it('omite pasado y permite el límite exacto', () => {
    expect(generarHorarios({ ...base, desde: new Date('2025-07-21T15:00:00Z') })[0]?.horarios).toEqual(cuatro.slice(2));
  });
  it('usa la fecha limeña antes de medianoche, no la fecha UTC', () => {
    expect(fechaLima(new Date('2025-07-22T02:00:00Z'))).toBe('2025-07-21');
    expect(generarHorarios({ ...base, desde: new Date('2025-07-22T02:00:00Z') })).toEqual([]);
  });
  it('deduplica franjas y no permite duraciones parciales', () => {
    expect(generarHorarios({ ...base, franjas: [...base.franjas, ...base.franjas], duracionMin: 45 })[0]?.horarios)
      .toEqual(['2025-07-21T14:00:00.000Z','2025-07-21T14:45:00.000Z']);
  });
  it('detecta solapamientos parciales', () => {
    expect(generarHorarios({ ...base, ocupado: [{ inicio: '2025-07-21T14:20:00Z', fin: '2025-07-21T14:40:00Z' }] })[0]?.horarios).toEqual(cuatro.slice(2));
  });
  it('rechaza duración cero y horas inválidas sin bucles infinitos', () => {
    expect(generarHorarios({ ...base, duracionMin: 0 })).toEqual([]);
    expect(generarHorarios({ ...base, franjas: [{ dia: 1, desde: '99:00', hasta: '11:00' }] })).toEqual([]);
  });
});
