import { describe, expect, it } from 'vitest';
import {
  calcularEstimacionViaticos,
  PARAMETROS_VIATICOS_INICIALES,
} from './parametros';
import type { ParametroViatico } from './types';

describe('Parámetros y cálculo de viáticos', () => {
  it('mantiene todas las tarifas iniciales en PENDIENTE_CONFIRMAR sin montos inventados', () => {
    expect(PARAMETROS_VIATICOS_INICIALES.length).toBeGreaterThan(0);
    for (const p of PARAMETROS_VIATICOS_INICIALES) {
      expect(p.estado).toBe('PENDIENTE_CONFIRMAR');
      expect(p.monto_rd).toBeNull();
    }
  });

  it('devuelve total null y PENDIENTE_CONFIRMAR cuando faltan tarifas confirmadas', () => {
    const res = calcularEstimacionViaticos({
      servicio: 'deslinde',
      topografia: 'llano',
      area_m2: 2500,
      distancia_ida_km: 120,
      cantidad_tecnicos: 2,
      dias_campo: 1,
      incluir_gabinete: true,
    });

    expect(res.estado_total).toBe('PENDIENTE_CONFIRMAR');
    expect(res.total_rd).toBeNull();
    expect(res.parametros_pendientes).toContain('jornada_deslinde');
    expect(res.parametros_pendientes).toContain('movilizacion_km');
    expect(res.parametros_pendientes).toContain('dieta_tecnico_dia');
  });

  it('calcula el total exacto en RD$ cuando la empresa confirma sus tarifas', () => {
    const confirmados: ParametroViatico[] = PARAMETROS_VIATICOS_INICIALES.map(
      (p) => {
        if (p.codigo === 'jornada_arquitectura') {
          return { ...p, monto_rd: 10000, estado: 'confirmada' };
        }
        if (p.codigo === 'movilizacion_km') {
          return { ...p, monto_rd: 50, estado: 'confirmada' };
        }
        if (p.codigo === 'dieta_tecnico_dia') {
          return { ...p, monto_rd: 1500, estado: 'confirmada' };
        }
        if (p.codigo === 'gabinete_cad') {
          return { ...p, monto_rd: 0, estado: 'confirmada' };
        }
        return p;
      }
    );

    const res = calcularEstimacionViaticos(
      {
        servicio: 'arquitectura',
        topografia: 'llano',
        area_m2: 2500,
        distancia_ida_km: 100,
        cantidad_tecnicos: 2,
        dias_campo: 1,
        incluir_gabinete: true,
      },
      confirmados
    );

    // Jornada: 10,000 + Movilización (200 km * 50 = 10,000) + Dietas (2 * 1 * 1,500 = 3,000) + Gabinete (0)
    expect(res.estado_total).toBe('confirmada');
    expect(res.total_rd).toBe(23000);
    expect(res.parametros_pendientes).toEqual([]);
  });
});
