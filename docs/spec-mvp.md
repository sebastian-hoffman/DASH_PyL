# DASH PL — Especificación MVP

**Fecha:** Abril 2026  
**Empresa:** TIARG S.A. (etapa 1)  
**Moneda:** AR$  
**Usuario principal:** CFO  
**Uso:** Gestión interna + Reuniones de Directorio

---

## 1. Alcance del MVP

### Incluido
- P&L real contable para TIARG S.A.
- Capa de ajustes de gestión sobre la base contable (con trazabilidad)
- Vista contable y vista gerencial con selector
- KPIs ejecutivos: Ventas, Margen Bruto, EBITDA, Resultado Neto
- Drill-down desde línea de P&L hasta movimiento individual del Libro Mayor
- Comentarios de gestión por línea de P&L y período
- Carga manual de Excel (snapshot completo) con revisión previa a publicación
- Detección de cambios retroactivos en períodos anteriores
- Versionado de cargas: carga importada vs versión publicada

### Fuera del MVP (etapa 2+)
- Segunda sociedad (Tiarg LLC / USD)
- Consolidación multimoneda
- Presupuesto / Forecast / Comparación año anterior
- Permisos por usuario
- Integración automática con Finnegans
- Prorrateos y distribuciones complejas

---

## 2. Fuentes de Datos

| Archivo | Rol |
|---------|-----|
| `Perdidas y ganancias.xlsx` | Resumen por cuenta, centro de costo y período. Base de conciliación. |
| `Libro mayor.xlsx` | Detalle de movimientos individuales. Base de drill-down y trazabilidad. |

### Estructura P&L (columnas detectadas)
- Año - mes
- Cuenta
- Dimensión valor (= Centro de Costo)
- Importe pcipal (AR$)
- Importe sec (USD equivalente)
- Empresa
- Nivel 1, 2, 3 cuenta (árbol contable)
- Nivel 1, 2 dimensión (árbol de centros de costo)
- Trimestre

### Estructura Libro Mayor (columnas detectadas)
- Fecha, Documento, Tipo de documento
- Cuentaid, Codigo cuenta, Cuenta
- Dimensión valor (= Centro de Costo)
- Descripción, Detalle
- Empresa, Comprobante
- Debe, Haber, Saldo mon. principal
- Año - mes, Fecha comprobante
- Cuentarama1, Cuentarama2, Cuentarama3 (árbol contable)
- Cuentanombrecodigo

---

## 3. Modelo de Datos

### Capas

```
┌─────────────────────────────────────────┐
│         Vista Gerencial Ajustada        │  ← lo que ve el CFO por defecto
├─────────────────────────────────────────┤
│         Reglas y Ajustes de Gestión     │  ← reclasificaciones, importes, etiquetas
├─────────────────────────────────────────┤
│         Base Contable Importada         │  ← intacta, nunca se modifica
└─────────────────────────────────────────┘
```

### Tablas principales

#### `imports`
Registro de cada carga de Excel.
- id, timestamp, archivo_pl, archivo_mayor, estado (importado / publicado)

#### `pl_lines`
Líneas del P&L importadas (snapshot de cada carga).
- import_id, anio_mes, trimestre, cuenta, centro_costo, nivel1_cuenta, nivel2_cuenta, nivel3_cuenta, nivel1_cc, nivel2_cc, importe_ars, importe_usd, empresa

#### `ledger_entries`
Movimientos del Libro Mayor (snapshot de cada carga).
- import_id, fecha, documento, tipo_doc, cuentaid, codigo_cuenta, cuenta, centro_costo, descripcion, detalle, empresa, comprobante, debe, haber, saldo, anio_mes, rama1, rama2, rama3

#### `account_mapping`
Mapeo de cuenta contable → rubro gerencial.
- codigo_cuenta, cuenta, nivel1_contable, nivel2_contable, nivel3_contable
- rubro_gerencial (ej: Ventas, Costo Directo, RRHH, Estructura, Financiero, Extraordinario)
- es_recurrente (bool)

#### `cc_mapping`
Mapeo de centro de costo contable → agrupación gerencial.
- cc_contable, nivel1_cc, nivel2_cc
- cc_gerencial, grupo_gerencial

#### `management_rules`
Reglas persistentes de ajuste de gestión.
- id, tipo (reclasificacion / ajuste_importe / excluir)
- filtro_cuenta, filtro_cc, filtro_periodo (pueden ser nulos = aplica siempre)
- rubro_destino, importe_ajuste
- descripcion, activa (bool), creada_en

#### `management_overrides`
Excepciones puntuales por movimiento individual.
- ledger_entry_id, tipo, valor, descripcion, creada_en

#### `comments`
Comentarios de gestión por línea P&L y período.
- rubro_gerencial, anio_mes, texto, creada_en, actualizada_en

#### `published_versions`
Registro de versiones publicadas.
- import_id, publicada_en, cambios_retroactivos (json)

---

## 4. KPIs y Fórmulas

| KPI | Fórmula | Fuente |
|-----|---------|--------|
| Ventas Netas | Σ importe donde rubro = Ventas | account_mapping |
| Costo de Ventas | Σ importe donde rubro = Costo Directo | account_mapping |
| Margen Bruto | Ventas Netas − Costo de Ventas | calculado |
| % Margen Bruto | Margen Bruto / Ventas Netas × 100 | calculado |
| EBITDA | Margen Bruto − Gastos Operativos (excl. amortizaciones y financiero) | account_mapping |
| % EBITDA | EBITDA / Ventas Netas × 100 | calculado |
| Resultado Neto | Σ todos los rubros del P&L | account_mapping |
| Variación vs mes anterior | KPI(mes) − KPI(mes−1) | calculado |

> Las fórmulas se construyen sobre la vista gerencial ajustada, no sobre la contable directa.

---

## 5. Vistas Temporales

Todas las métricas se calculan en tres cortes:
- **Mes actual** (o mes seleccionado)
- **Trimestre** (suma de los 3 meses del trimestre del período seleccionado)
- **YTD** (acumulado desde enero del año del período seleccionado)

---

## 6. Dimensiones de Análisis (filtros disponibles)

- Período (mes / trimestre / año)
- Centro de costo contable
- Agrupación gerencial de centros de costo
- Cuenta contable
- Rubro gerencial
- Tipo (recurrente / no recurrente / extraordinario)
- Vista (contable / gerencial)

---

## 7. Pantallas del MVP

### 7.1 Dashboard Principal
- Selector: período + vista (contable / gerencial)
- KPIs ejecutivos en cards: Ventas, Margen Bruto %, EBITDA %, Resultado Neto
- Gráfico de evolución mensual (ventas + resultado)
- Tabla P&L con jerarquía expandible (rubro → cuenta → movimiento)
- Columnas: Mes | Trimestre | YTD | % s/Ventas
- Indicador de comentario en líneas que tengan nota
- Selector para cambiar entre vista contable y gerencial

### 7.2 Drill-down de Movimientos
- Accesible desde cualquier línea de la tabla P&L
- Lista de movimientos del Libro Mayor que componen esa línea
- Columnas: fecha, documento, descripción, centro de costo, debe, haber, importe, ajuste aplicado
- Indicador visual si el movimiento tiene override o está afectado por una regla de gestión

### 7.3 Carga de Datos
- Upload de dos archivos Excel (P&L y Libro Mayor)
- Parseo y validación automática
- Resumen de cambios vs versión publicada anterior:
  - Períodos nuevos
  - Períodos modificados (incluyendo retroactivos)
  - Cuentas o centros de costo nuevos sin mapeo gerencial
- Botón "Publicar" solo disponible después de revisar

### 7.4 Ajustes de Gestión
- Listado de reglas activas con posibilidad de editar/desactivar
- Formulario para crear nueva regla (filtro + acción + descripción)
- Listado de overrides puntuales por movimiento
- Log de ajustes aplicados en la última publicación

### 7.5 Mapeo de Cuentas y Centros de Costo
- Tabla editable de account_mapping
- Tabla editable de cc_mapping
- Alerta cuando hay cuentas o CC sin mapeo gerencial

### 7.6 Comentarios
- Accesible desde la tabla P&L (ícono de comentario por fila)
- Editor simple de texto por rubro + período
- Historial de versiones del comentario

---

## 8. Flujo de Carga

```
Subir Excel
    ↓
Parsear y almacenar como nueva carga (estado: importado)
    ↓
Comparar contra versión publicada anterior
    ↓
Mostrar resumen de cambios (retroactivos destacados)
    ↓
Aplicar reglas de gestión automáticamente
    ↓
Revisar ajustes y mapeos pendientes
    ↓
Publicar → versión publicada actualizada
    ↓
Dashboard refleja nueva versión
```

---

## 9. Trazabilidad

Para cada número del dashboard debe ser posible llegar a:
1. Rubro gerencial → cuentas que lo componen (via account_mapping)
2. Cuenta → movimientos del período (via ledger_entries)
3. Movimiento → regla o override aplicado (si existe)
4. Importe gerencial → importe contable original + ajuste aplicado

---

## 10. Reglas de Negocio Pendientes de Validar

Estas definiciones deben confirmarse con el responsable contable antes de construir account_mapping:

- [ ] ¿Qué cuentas forman Ventas Netas? (descuentos, devoluciones incluidos?)
- [ ] ¿Qué diferencia Costo Directo de Gasto Operativo en este plan de cuentas?
- [ ] ¿Qué rubros del P&L contable entran en EBITDA y cuáles quedan fuera?
- [ ] ¿Hay cuentas financieras o de diferencia de cambio que deban separarse del resultado operativo?
- [ ] ¿Cómo se identifican los ítems no recurrentes: por cuenta, por CC, por tipo de documento, o por combinación?

---

## 11. Stack Tecnológico Propuesto

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Backend | Python + FastAPI | Liviano, ideal para datos financieros, fácil de testear |
| Base de datos | PostgreSQL | Railway lo incluye nativamente, soporta bien volumen de movimientos |
| ORM | SQLAlchemy | Robusto, migraciones con Alembic |
| Procesamiento Excel | pandas + openpyxl | Estándar para este tipo de ingesta |
| Frontend | React + TanStack Table | Tabla financiera con drill-down y jerarquía expandible |
| Gráficos | Recharts | Simple, composable, buena UX para series financieras |
| Deploy | Railway | Ya lo usan, PostgreSQL incluido, deploy desde GitHub |
| Dev local | Docker Compose | Backend + PostgreSQL local idéntico al de Railway |

---

## 12. Etapas de Construcción

### Etapa 1 (MVP)
1. Estructura del proyecto y base de datos
2. Ingesta de Excel (P&L + Libro Mayor)
3. Modelo de mapeo contable → gerencial
4. Motor de reglas y ajustes de gestión
5. API de P&L (contable y gerencial, con drill)
6. Pantalla principal con tabla P&L y KPIs
7. Pantalla de carga con revisión de cambios
8. Comentarios de gestión
9. Pantalla de mapeos y reglas

### Etapa 2
- Segunda sociedad (Tiarg LLC / USD)
- Consolidación
- Presupuesto y comparaciones
- Permisos por usuario
- Integración automática con Finnegans
