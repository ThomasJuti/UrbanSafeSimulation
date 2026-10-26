import { useRef, useState } from 'react';
import { exportarEstado, importarEstado, restaurarTodo } from '../stores/state';

/** Menú de datos: exportar, importar, restaurar e imprimir. */
export default function Datos() {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  function exportar() {
    const blob = new Blob([exportarEstado()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'simulador-urbansafe.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, texto: 'Exportado.' });
  }

  async function importar(f: File | undefined) {
    if (!f) return;
    const r = importarEstado(await f.text());
    setMsg(r.ok ? { ok: true, texto: 'Importado.' } : { ok: false, texto: r.error ?? 'Error al importar.' });
    if (archivo.current) archivo.current.value = '';
  }

  function restaurar() {
    if (confirm('¿Restaurar proyecto, escenarios y pesos a los valores por defecto?')) {
      restaurarTodo();
      setMsg({ ok: true, texto: 'Valores restaurados.' });
    }
  }

  return (
    <details>
      <summary>
        <span className="btn" role="button">Datos</span>
      </summary>
      <div className="card menu-pop">
        <div className="btn-row">
          <button type="button" onClick={exportar}>Exportar JSON</button>
          <button type="button" onClick={() => archivo.current?.click()}>Importar JSON</button>
          <button type="button" onClick={() => window.print()}>Imprimir informe</button>
          <button type="button" className="danger" onClick={restaurar}>Restaurar valores por defecto</button>
        </div>
        <input ref={archivo} type="file" accept="application/json,.json" className="sr-only" aria-label="Archivo JSON a importar"
          onChange={(e) => importar(e.target.files?.[0])} />
        {msg && <p role="status" className={msg.ok ? 'hint' : 'err'} style={{ marginTop: 8 }}>{msg.texto}</p>}
      </div>
    </details>
  );
}
