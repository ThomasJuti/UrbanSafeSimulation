/** Proyecto precargado: UrbanSafe. */
import type { Proyecto } from './types';

export const PROYECTO_DEFECTO: Proyecto = {
  nombre: 'UrbanSafe',
  descripcion:
    'Calcula rutas seguras para domiciliarios en Bogotá. Combina reportes comunitarios y noticias para estimar el riesgo de cada tramo y ofrece tres rutas por pedido: rápida, balanceada y segura.',
  dominio: 'Movilidad urbana y seguridad ciudadana (domicilios en moto, Bogotá)',
  stack:
    'Monolito modular: Hono + Socket.IO + node-cron (TypeScript) sobre PostgreSQL/PostGIS/pgRouting en Supabase (São Paulo). Web con React y MapLibre.',
  usuarios: [
    { rol: 'Domiciliarios', cantidad: 30, descripcion: 'Piden 3 rutas por pedido y reciben alertas en tiempo real (demo del curso).' },
    { rol: 'Reporteros comunitarios', cantidad: 30, descripcion: 'Reportan incidentes y confirman o niegan los de otros (límite de 5 por hora).' },
    { rol: 'Sistema de ingesta', cantidad: 1, descripcion: 'Lee feeds de noticias cada 45 min y los convierte en incidentes.' },
    { rol: 'Simulador de pedidos', cantidad: 30, descripcion: 'Genera sesiones de entrega para la demo y las pruebas de carga.' },
  ],
  calidad: [
    { id: 'rendimiento', nombre: 'Rendimiento del ruteo', prioridad: 5 },
    { id: 'tiempo-real', nombre: 'Tiempo real (reporte → mapa)', prioridad: 4 },
    { id: 'disponibilidad', nombre: 'Disponibilidad', prioridad: 4 },
    { id: 'privacidad', nombre: 'Privacidad de la posición (RN-03)', prioridad: 4 },
    { id: 'costo', nombre: 'Costo', prioridad: 5 },
    { id: 'mantenibilidad', nombre: 'Mantenibilidad', prioridad: 3 },
  ],
  requisitos: {
    p95RuteoMs: 1500,
    p95ReporteMs: 1000,
    disponibilidadPct: 99.5,
    // Presupuesto por defecto: 150 USD/mes. Editable; ver docs/DOCUMENTACION.md.
    presupuestoUsd: 150,
    utilizacionMaxPct: 80,
    cifradoObligatorio: true,
  },
  restricciones:
    'Equipo estudiantil.\nSin Docker en desarrollo.\nSupabase solo como base de datos.\nPlazo del semestre.',
};
