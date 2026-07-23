import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const root = path.resolve(process.cwd(), "..", "..");

const pickExisting = (...candidates) => candidates.map((file) => path.join(root, file)).find((file) => fs.existsSync(file));

const pnlFile = pickExisting("PyG_2026_05.xlsx", "Perdidas y ganancias.xlsx");
const mayorFile = pickExisting("Mayor_PyG_2026_05.xlsx", "Libro mayor.xlsx");
const bankFile = path.join(root, "Movimientos banco 2025.xlsx");

if (!pnlFile || !mayorFile) {
  throw new Error("No se encontraron archivos de P&L/Mayor para validar reconciliacion");
}

const toNum = (v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/\./g, "").replace(",", ".").trim();
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
};

const monthFromDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (m) return `${m[1]}-${m[2]}`;
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  return "";
};

const readRows = (file, sheetName) => {
  const wb = xlsx.readFile(file, { cellDates: true });
  const sheet = wb.Sheets[sheetName || wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });
};

const pnlRows = readRows(pnlFile);
const mayorRows = readRows(mayorFile);
const bankRows = readRows(bankFile, "BASE");

const pnlMonths = [...new Set(pnlRows.map((r) => String(r["Año - mes"] || "").trim()).filter(Boolean))].sort();
const months2025 = pnlMonths.filter((m) => m.startsWith("2025-"));

const pnlByMonth = new Map(months2025.map((m) => [m, 0]));
for (const r of pnlRows) {
  const m = String(r["Año - mes"] || "").trim();
  if (!pnlByMonth.has(m)) continue;
  pnlByMonth.set(m, (pnlByMonth.get(m) || 0) + toNum(r["Importe pcipal"]));
}

const mayorByMonth = new Map(months2025.map((m) => [m, { debe: 0, haber: 0, netHaberDebe: 0, netDebeHaber: 0 }]));
for (const r of mayorRows) {
  const m = String(r["Año - mes"] || "").trim() || monthFromDate(r["Fecha"]);
  if (!mayorByMonth.has(m)) continue;
  const debe = toNum(r["Debe"]);
  const haber = toNum(r["Haber"]);
  const bucket = mayorByMonth.get(m);
  bucket.debe += debe;
  bucket.haber += haber;
  bucket.netHaberDebe += haber - debe;
  bucket.netDebeHaber += debe - haber;
}

const bankByMonth = new Map(months2025.map((m) => [m, { in: 0, out: 0, net: 0 }]));
for (const r of bankRows) {
  const m = String(r["Periodo"] || "").trim() || monthFromDate(r["Fecha"]);
  if (!bankByMonth.has(m)) continue;
  const amount = toNum(r["Importe Pesos"]);
  const bucket = bankByMonth.get(m);
  if (amount >= 0) bucket.in += amount;
  else bucket.out += amount;
  bucket.net += amount;
}

const fmt = (n) => Math.round(n).toLocaleString("es-AR");

console.log("VALIDACION 3 VIAS (2025)");
console.log("Mes | PNL_NET | MAYOR(H-D) | BANK_NET | DELTA PNL-MAYOR | DELTA PNL-BANK | DELTA MAYOR-BANK");

let totals = {
  pnl: 0,
  mayor: 0,
  bank: 0,
  dPnlMayor: 0,
  dPnlBank: 0,
  dMayorBank: 0,
  mayorDebe: 0,
  mayorHaber: 0,
  bankIn: 0,
  bankOut: 0
};

for (const m of months2025) {
  const pnl = pnlByMonth.get(m) || 0;
  const mayor = mayorByMonth.get(m) || { debe: 0, haber: 0, netHaberDebe: 0, netDebeHaber: 0 };
  const bank = bankByMonth.get(m) || { in: 0, out: 0, net: 0 };

  const mayorNet = mayor.netHaberDebe;
  const dPnlMayor = pnl - mayorNet;
  const dPnlBank = pnl - bank.net;
  const dMayorBank = mayorNet - bank.net;

  totals.pnl += pnl;
  totals.mayor += mayorNet;
  totals.bank += bank.net;
  totals.dPnlMayor += dPnlMayor;
  totals.dPnlBank += dPnlBank;
  totals.dMayorBank += dMayorBank;
  totals.mayorDebe += mayor.debe;
  totals.mayorHaber += mayor.haber;
  totals.bankIn += bank.in;
  totals.bankOut += bank.out;

  console.log(
    [
      m,
      fmt(pnl),
      fmt(mayorNet),
      fmt(bank.net),
      fmt(dPnlMayor),
      fmt(dPnlBank),
      fmt(dMayorBank)
    ].join(" | ")
  );
}

console.log("\nTOTALES 2025");
console.log(`PNL_NET=${fmt(totals.pnl)}`);
console.log(`MAYOR_NET(H-D)=${fmt(totals.mayor)}`);
console.log(`BANK_NET=${fmt(totals.bank)}`);
console.log(`DELTA PNL-MAYOR=${fmt(totals.dPnlMayor)}`);
console.log(`DELTA PNL-BANK=${fmt(totals.dPnlBank)}`);
console.log(`DELTA MAYOR-BANK=${fmt(totals.dMayorBank)}`);
console.log(`MAYOR_DEBE=${fmt(totals.mayorDebe)}`);
console.log(`MAYOR_HABER=${fmt(totals.mayorHaber)}`);
console.log(`BANK_IN=${fmt(totals.bankIn)}`);
console.log(`BANK_OUT=${fmt(totals.bankOut)}`);

const pnlByAccount = new Map();
for (const r of pnlRows) {
  const m = String(r["Año - mes"] || "").trim();
  if (!months2025.includes(m)) continue;
  const account = String(r["Cuenta"] || "Sin Cuenta").trim() || "Sin Cuenta";
  pnlByAccount.set(account, (pnlByAccount.get(account) || 0) + toNum(r["Importe pcipal"]));
}

const mayorByAccount = new Map();
for (const r of mayorRows) {
  const m = String(r["Año - mes"] || "").trim() || monthFromDate(r["Fecha"]);
  if (!months2025.includes(m)) continue;
  const account = String(r["Cuenta"] || "Sin Cuenta").trim() || "Sin Cuenta";
  const amount = toNum(r["Haber"]) - toNum(r["Debe"]);
  mayorByAccount.set(account, (mayorByAccount.get(account) || 0) + amount);
}

const allAccounts = [...new Set([...pnlByAccount.keys(), ...mayorByAccount.keys()])];
const accountDiffs = allAccounts
  .map((acc) => {
    const pnl = pnlByAccount.get(acc) || 0;
    const mayor = mayorByAccount.get(acc) || 0;
    return { account: acc, pnl, mayor, delta: pnl - mayor };
  })
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  .slice(0, 15);

console.log("\nTOP 15 DESVIOS POR CUENTA (PNL - MAYOR)");
for (const d of accountDiffs) {
  console.log(`${d.account} | PNL=${fmt(d.pnl)} | MAYOR=${fmt(d.mayor)} | DELTA=${fmt(d.delta)}`);
}
