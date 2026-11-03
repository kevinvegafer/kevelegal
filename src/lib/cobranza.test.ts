import { describe, expect, it } from 'vitest';
import { estadoCuotas, generarCuotas, segundosAMonto, formatDuracion } from './cobranza';
describe('cobranza', () => {
 it('distribuye céntimos sin pérdida',()=>expect(generarCuotas(1000,3,'2025-01-31','mensual').map(c=>c.monto)).toEqual([333.33,333.33,333.34]));
 it('conserva el día ancla y admite año bisiesto',()=>{
 expect(generarCuotas(3,3,'2024-01-31','mensual').map(c=>c.fecha_vencimiento)).toEqual(['2024-01-31','2024-02-29','2024-03-31']);
 expect(generarCuotas(2,2,'2025-01-31','mensual')[1]?.fecha_vencimiento).toBe('2025-02-28');
 });
 it('quincenas son quince días',()=>expect(generarCuotas(3,3,'2025-01-31','quincenal').map(c=>c.fecha_vencimiento)).toEqual(['2025-01-31','2025-02-15','2025-03-02']));
 it('aplica FIFO aunque las cuotas estén desordenadas',()=>{
 const cuotas = generarCuotas(300,3,'2025-01-01','mensual');
 expect(estadoCuotas(cuotas.reverse(),150,'2025-02-01').map(c=>[c.pagado,c.saldo,c.estado])).toEqual([[100,0,'pagada'],[50,50,'parcial'],[0,100,'pendiente']]);
 expect(estadoCuotas(cuotas,150,'2025-02-02')[1]?.estado).toBe('vencida');
 expect(estadoCuotas(cuotas,400,'2026-01-01').every(c=>c.saldo===0)).toBe(true);
 });
 it('no vence el mismo día',()=>expect(estadoCuotas(generarCuotas(100,1,'2025-01-01','mensual'),0,'2025-01-01')[0]?.estado).toBe('pendiente'));
 it('redondea importes y formatea duración',()=>{
 expect(segundosAMonto(3900,120)).toBe(130); expect(segundosAMonto(1,100)).toBe(.03);
 expect(formatDuracion(3900)).toBe('1 h 05 min'); expect(formatDuracion(0)).toBe('0 h 00 min');
 });
 it('rechaza entradas inválidas',()=>{expect(()=>generarCuotas(1,0,'2025-01-01','mensual')).toThrow();expect(()=>generarCuotas(1,2,'2025-02-30','mensual')).toThrow();expect(()=>segundosAMonto(-1,10)).toThrow();});
});
