# Simulador de arquitecturas para UrbanSafe

App web (Astro 5 + islas React + TypeScript estricto) de la Actividad 9, Ingeniería Aplicada. Compara cuatro arquitecturas para UrbanSafe con un modelo de colas calibrado con las mediciones de `UrbanSafeApp/docs/spec.md`. Los resultados son estimaciones del modelo, no mediciones reales.

**App desplegada:** https://urbansafe-simulation.vercel.app

## Comandos

```bash
npm install
npm run dev      # servidor de desarrollo
npm run test     # pruebas del modelo (Vitest)
npm run check    # tipos (astro check)
npm run build    # build estático en dist/
npm run preview  # sirve dist/
```

## Estructura

- `src/lib/model/`: modelo puro y probado (parámetros, colas, simulación, decisión, validación, escenarios, casos de prueba).
- `src/stores/state.ts`: estado persistente (localStorage) con nanostores.
- `src/components/`: islas React (`client:only="react"`) y gráficos.
- `src/pages/`: Proyecto, Alternativas, Escenarios, Resultados, Decisión, Modelo y Pruebas.
- `docs/DOCUMENTACION.md`: entregable escrito. `docs/PLAN.md`: especificación.
