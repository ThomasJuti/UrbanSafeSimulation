/** Metadatos de las 14 variables de entrada: unidad, rango, ayuda y justificación. */
import type { Entradas } from './types';

export interface VarDef {
  clave: keyof Entradas;
  etiqueta: string;
  unidad: string;
  min: number;
  max: number;
  paso: number;
  entero: boolean;
  ayuda: string;
  justificacion: string;
}

export const VARIABLES: VarDef[] = [
  { clave: 'usuarios', etiqueta: 'Usuarios concurrentes (domiciliarios)', unidad: 'usuarios', min: 1, max: 5000, paso: 1, entero: true,
    ayuda: 'Domiciliarios con sesión activa al mismo tiempo.', justificacion: 'Concurrencia: la demo apunta a ~30 (spec §7).' },
  { clave: 'intervaloRutaS', etiqueta: 'Intervalo medio entre pedidos de ruta', unidad: 's', min: 1, max: 120, paso: 1, entero: false,
    ayuda: 'Cada cuántos segundos pide ruta cada usuario.', justificacion: 'Ruteo: la carga sostenida medida usa 5-15 s (media 10 s).' },
  { clave: 'reportesPorUsuarioHora', etiqueta: 'Reportes por usuario por hora', unidad: 'reportes/h', min: 0, max: 60, paso: 1, entero: false,
    ayuda: 'Reportes comunitarios que envía cada usuario.', justificacion: 'Tiempo real: RN-04 limita a 5 por hora por dispositivo; el tope 60 modela ráfagas de la demo.' },
  { clave: 'factorRafaga', etiqueta: 'Factor de ráfaga (pico / promedio)', unidad: '×', min: 1, max: 20, paso: 0.5, entero: false,
    ayuda: 'Multiplica la demanda de ruteo y reportes.', justificacion: 'Ráfaga al aceptar: 30 pedidos a la vez frente a 3 pedidos/s sostenidos.' },
  { clave: 'tRutaBdMs', etiqueta: 'Tiempo de cómputo de UNA ruta en la base', unidad: 'ms', min: 10, max: 5000, paso: 10, entero: false,
    ayuda: 'Dijkstra de pgRouting por ruta; cada pedido calcula 3.', justificacion: 'Medido: 80-280 ms por ruta en la base (spec).' },
  { clave: 'vcpuBd', etiqueta: 'Núcleos de la base de datos', unidad: 'vCPU', min: 1, max: 64, paso: 1, entero: false,
    ayuda: 'CPU disponible para pgRouting en Supabase.', justificacion: 'Cuello de botella principal: la CPU de la base no da para 30 Dijkstra a la vez.' },
  { clave: 'nodos', etiqueta: 'Nodos de aplicación', unidad: 'nodos', min: 1, max: 50, paso: 1, entero: true,
    ayuda: 'Instancias del API. A1 siempre usa 1.', justificacion: 'Escalabilidad horizontal (USL).' },
  { clave: 'vcpuNodo', etiqueta: 'vCPU por nodo', unidad: 'vCPU', min: 1, max: 32, paso: 1, entero: false,
    ayuda: 'Núcleos de cada nodo de aplicación.', justificacion: 'Capacidad de la capa de aplicación.' },
  { clave: 'latenciaRedMs', etiqueta: 'Latencia de red API ↔ base (ida y vuelta)', unidad: 'ms', min: 0.1, max: 300, paso: 1, entero: false,
    ayuda: 'Tiempo de un viaje de ida y vuelta a la base.', justificacion: 'São Paulo ≈ 150 ms (medido: domina los 0,6-0,9 s de punta a punta).' },
  { clave: 'llamadasInternas', etiqueta: 'Llamadas internas entre servicios por operación', unidad: 'llamadas', min: 0, max: 10, paso: 1, entero: true,
    ayuda: 'Solo afecta a A3 (microservicios).', justificacion: 'Sobrecarga de pasar peticiones entre servicios: [2] y [3].' },
  { clave: 'disponibilidadComponentePct', etiqueta: 'Disponibilidad por componente', unidad: '%', min: 90, max: 99.999, paso: 0.01, entero: false,
    ayuda: 'Disponibilidad de una instancia o servicio de aplicación.', justificacion: 'Disponibilidad: base de las fórmulas serie/paralelo.' },
  { clave: 'mtls', etiqueta: 'Cifrado interno (mTLS)', unidad: 'sí/no', min: 0, max: 1, paso: 1, entero: true,
    ayuda: 'Cifra los canales internos entre componentes.', justificacion: 'Seguridad: cifrado en tránsito obligatorio (Supabase exige sslmode=require).' },
  { clave: 'costoNodoUsd', etiqueta: 'Costo por nodo', unidad: 'USD/mes', min: 1, max: 2000, paso: 1, entero: false,
    ayuda: 'Costo mensual de un nodo de aplicación.', justificacion: 'Presupuesto.' },
  { clave: 'costoVcpuBdUsd', etiqueta: 'Costo por vCPU de la base', unidad: 'USD/mes', min: 1, max: 2000, paso: 1, entero: false,
    ayuda: 'Costo mensual de cada vCPU de la base.', justificacion: 'Presupuesto.' },
];
