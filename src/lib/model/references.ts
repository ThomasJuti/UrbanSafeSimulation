/**
 * Bibliografía del simulador: los 4 artículos de lectura obligatoria del curso
 * y la spec de UrbanSafe. Formato IEEE. Las claves coinciden con `RefKey`.
 */
import type { RefKey } from './types';

export interface Referencia {
  clave: RefKey;
  /** Cita completa, formato IEEE. */
  cita: string;
  /** Qué midió el estudio (resumen propio, parafraseado). */
  hallazgo: string;
  /** Cómo informa al modelo. */
  uso: string;
  /** Límite de generalización. */
  cuidado: string;
}

export const REFERENCIAS: Referencia[] = [
  {
    clave: '[1]',
    cita: 'F. Tapia, M. Á. Mora, W. Fuertes, H. Aules, E. Flores y T. Toulkeridis, "From Monolithic Systems to Microservices: A Comparative Study of Performance," Applied Sciences, vol. 10, n.º 17, art. 5797, 2020, doi: 10.3390/app10175797.',
    hallazgo:
      'Mismo aplicativo web como monolito en una VM con KVM y como microservicios en contenedores, con el mismo hardware y pruebas de estrés con JMeter. Con 273 peticiones, el promedio fue 1 150 ms (monolito) frente a 936 ms (microservicios) y 2,5 contra 3,1 peticiones/s; con 1 053 peticiones, 1,2 contra 1,4 peticiones/s y 2 errores solo en el monolito. Con regresión no paramétrica, los microservicios usaron más CPU (7,85 frente a 2,39) y más red, y menos memoria.',
    uso:
      'Fija la dirección del costo de plataforma de los contenedores (más CPU: overhead_plataforma de A3 mayor que el de A1) y la advertencia de que el resultado depende del entorno. Su ventaja de microservicios no se traslada al modelo porque compara una VM contra contenedores, no solo dos arquitecturas.',
    cuidado: 'La comparación mezcla arquitectura y tecnología de despliegue (VM frente a contenedores); no se puede atribuir toda la diferencia a la arquitectura.',
  },
  {
    clave: '[2]',
    cita: 'G. Blinowski, A. Ojdowska y A. Przybyłek, "Monolithic vs. Microservice Architecture: A Performance and Scalability Evaluation," IEEE Access, vol. 10, pp. 20357–20374, 2022, doi: 10.1109/ACCESS.2022.3152803.',
    hallazgo:
      'Aplicación de referencia en cuatro versiones (monolito y microservicios, Java y C#/.NET) probada en local y en Azure. En una sola máquina el monolito rinde más; con un servicio corto atendió entre 1,37 y 2 veces más peticiones que los microservicios y con un servicio de cómputo intenso solo un poco más. Escalar en vertical resultó más rentable que en horizontal. Con el servicio corto, pasar de 1 a 3 instancias dio como máximo 9 % y más de 6 casi no ayudó (con 10 bajó en la mitad de los casos); con el servicio de cómputo intenso hubo ganancia hasta unas 10 instancias, nada a 15 y caída a 20. La tecnología no cambió de forma notable la escalabilidad.',
    uso:
      'Respalda el sobrecosto por salto entre servicios (cSerializacionMs, tSaltoMs), la ventaja del monolito en una sola máquina, y la calibración de κ en la USL para que el rendimiento deje de crecer y caiga entre 10 y 20 instancias (N* entre 9 y 15).',
    cuidado: 'Es un benchmark sintético sin base de datos y los costos son de Azure: no se transfiere directamente a Supabase ni a otros proveedores.',
  },
  {
    clave: '[3]',
    cita: 'O. Al-Debagy y P. Martinek, "A Comparative Review of Microservices and Monolithic Architectures," en Proc. 18th IEEE Int. Symp. Computational Intelligence and Informatics (CINTI), Budapest, Hungría, nov. 2018, pp. 149–154.',
    hallazgo:
      'Aplicación generada con JHipster (Spring Boot y AngularJS) en versión monolítica y de microservicios con gateway, probada con JMeter en Docker (16 GB de RAM, 2,6 GHz). En la prueba de carga (100 a 7 000 hilos) la diferencia promedio fue de 0,87 %, sin significancia; con pocos usuarios el monolito rindió algo más. En la prueba de concurrencia el monolito tuvo 6 % más de peticiones por segundo. Con Consul como descubrimiento de servicios se logró cerca de 4 % más de rendimiento que con Eureka.',
    uso:
      'Fija el multiplicador de servicio de la aplicación de A3 en 1,06 (el 6 % del monolito), y respalda que con carga normal las arquitecturas rinden parecido, que es lo que muestra el escenario de referencia.',
    cuidado: 'Una sola aplicación pequeña (3 servicios) en un servidor, sin base de datos remota ni red de varios cientos de ms. No contiene mediciones de CPU, memoria o paquetes ni arquitectura orientada a eventos, aunque la guía del curso la resume así.',
  },
  {
    clave: '[4]',
    cita: 'A. Sunardi y Suharjito, "MVC Architecture: A Comparative Study Between Laravel Framework and Slim Framework in Freelancer Project Monitoring System Web Based," Procedia Computer Science, vol. 157, pp. 134–141, 2019, doi: 10.1016/j.procs.2019.08.150.',
    hallazgo:
      'Se probó la página de panel con JMeter con 1, 100 y 500 muestras. Slim fue más rápido que Laravel: promedio de 67 contra 197 ms (1 muestra), 368 contra 1 841 ms (100) y 2 812 contra 11 622 ms (500); el rendimiento fue de 14,9 contra 5,1, de 71,2 contra 27,8 y de 77,9 contra 25,3 peticiones/s. Ninguno tuvo errores.',
    uso:
      'Respalda que un stack liviano paga menos sobrecarga por petición: el API de UrbanSafe (Hono) se modela con CPU de aplicación pequeño (tAppRutaMs, tAppReporteMs) y la variabilidad del servicio cvApp crece con la carga.',
    cuidado: 'Compara dos frameworks PHP, no arquitecturas distribuidas; solo informa la dirección del efecto de la sobrecarga del framework.',
  },
];

export const REF_SPEC = {
  clave: 'spec' as RefKey,
  cita: 'Equipo UrbanSafe, "UrbanSafe: especificación del MVP y mediciones de carga", docs/spec.md, repositorio UrbanSafeApp, 2026.',
};

/** Texto que aparece como fuente en cada tipo de clave. */
export const ETIQUETA_REF: Record<RefKey, string> = {
  '[1]': 'Tapia et al. (2020)',
  '[2]': 'Blinowski et al. (2022)',
  '[3]': 'Al-Debagy y Martinek (2018)',
  '[4]': 'Sunardi y Suharjito (2019)',
  spec: 'spec de UrbanSafe',
  supuesto: 'Supuesto del equipo',
  conv: 'Convención',
};
