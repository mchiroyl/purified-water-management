export function DashboardPage() {
  return (
    <main>
      <p className="eyebrow">Resumen</p>
      <h1>Panel operativo</h1>
      <div className="metric-grid">
        <article><span>Ventas de hoy</span><strong>Q0.00</strong></article>
        <article><span>Rutas activas</span><strong>0</strong></article>
        <article><span>Sincronización</span><strong>Al día</strong></article>
        <article><span>Diferencias</span><strong>Q0.00</strong></article>
      </div>
      <section className="panel">
        <h2>Primeros pasos</h2>
        <p>Configura los datos de la empresa antes de crear catálogos y rutas.</p>
      </section>
    </main>
  );
}
