/** Escenario de referencia y escenarios predefinidos. */
import type { Entradas, Escenario } from './types';

/** Demo del curso: 30 domiciliarios, base de 2 vCPU en São Paulo, 1 nodo. */
export const ENTRADAS_REFERENCIA: Entradas = {
  usuarios: 30,
  intervaloRutaS: 10,
  reportesPorUsuarioHora: 6,
  factorRafaga: 1,
  tRutaBdMs: 120,
  vcpuBd: 2,
  nodos: 1,
  vcpuNodo: 2,
  latenciaRedMs: 150,
  llamadasInternas: 3,
  disponibilidadComponentePct: 99.9,
  mtls: true,
  costoNodoUsd: 25,
  costoVcpuBdUsd: 25,
};

export const ESCENARIOS_PREDEFINIDOS: Escenario[] = [
  {
    id: 'referencia',
    nombre: 'Referencia: demo del curso',
    descripcion:
      '30 domiciliarios pidiendo ruta cada 10 s (carga sostenida medida en UrbanSafe), base de 2 vCPU en São Paulo con 150 ms de ida y vuelta y un nodo de aplicación.',
    entradas: ENTRADAS_REFERENCIA,
    predefinido: true,
  },
  {
    id: 'rafaga',
    nombre: 'Ráfaga de la demo',
    descripcion:
      'Los 30 domiciliarios aceptan y reportan a la vez (pico 20× el promedio). Reproduce la ráfaga medida con load:routes y load:demo.',
    entradas: { ...ENTRADAS_REFERENCIA, factorRafaga: 20, reportesPorUsuarioHora: 60 },
    predefinido: true,
  },
  {
    id: 'lanzamiento',
    nombre: 'Lanzamiento en Bogotá',
    descripcion:
      '1 000 domiciliarios pidiendo ruta cada 30 s, con base de 16 vCPU y 6 nodos de 4 vCPU. El presupuesto sube a 1 500 USD/mes solo en este escenario.',
    entradas: {
      ...ENTRADAS_REFERENCIA,
      usuarios: 1000,
      intervaloRutaS: 30,
      vcpuBd: 16,
      nodos: 6,
      vcpuNodo: 4,
    },
    requisitos: { presupuestoUsd: 1500 },
    predefinido: true,
  },
  {
    id: 'recursos-limitados',
    nombre: 'Recursos limitados con cifrado obligatorio',
    descripcion:
      '40 domiciliarios con 2 nodos de 1 vCPU, componentes de 99,7 % y costos bajos. El cifrado interno (mTLS) es obligatorio y el presupuesto baja a 90 USD/mes.',
    entradas: {
      ...ENTRADAS_REFERENCIA,
      usuarios: 40,
      intervaloRutaS: 15,
      nodos: 2,
      vcpuNodo: 1,
      disponibilidadComponentePct: 99.7,
      mtls: true,
      costoNodoUsd: 10,
      costoVcpuBdUsd: 15,
    },
    requisitos: { presupuestoUsd: 90 },
    predefinido: true,
  },
];

export const ID_REFERENCIA = 'referencia';
