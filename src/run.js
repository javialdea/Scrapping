// Punto de entrada: node src/run.js <tarea>
const tareas = {
  clipping: () => import('./clipping/index.js'),
  'sector-publico': () => import('./sector-publico/index.js'),
  diario: () => import('./diario/index.js'),
};

const nombre = process.argv[2];

if (!tareas[nombre]) {
  console.log(`Uso: node src/run.js <tarea>\nTareas disponibles: ${Object.keys(tareas).join(', ')}`);
  process.exit(1);
}

const { ejecutar } = await tareas[nombre]();
try {
  await ejecutar();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
// Algunas conexiones HTTP quedan abiertas y mantendrían el proceso vivo.
process.exit();
