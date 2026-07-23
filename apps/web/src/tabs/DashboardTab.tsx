import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, Kpi } from "../types/index.js";
import { fmtCurrency, fmtPct } from "../utils/format.js";

const fmtCompactNumber = (n: number) =>
  new Intl.NumberFormat("es-AR", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(n);

interface Props {
  kpis: Kpi[];
  chart: ChartPoint[];
}

export function DashboardTab({ kpis, chart }: Props) {
  return (
    <>
      <section className="kpi-grid">
        {kpis.map((k) => (
          <article key={k.title} className="kpi-card">
            <h3>{k.title}</h3>
            <p className="value">{fmtCurrency(k.value)}</p>
            <p className={k.deltaPct >= 0 ? "delta up" : "delta down"}>{fmtPct(k.deltaPct)}</p>
          </article>
        ))}
      </section>

      <section className="chart-card">
        <h2>EBITDA mensual sin Z_ESPECIALES</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis width={72} tickFormatter={(value) => fmtCompactNumber(Number(value))} />
              <Tooltip />
              <Legend />
              <Line name="EBITDA" dataKey="habitual" stroke="#0c7a5f" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
