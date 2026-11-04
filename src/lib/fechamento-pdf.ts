import autoTable from "jspdf-autotable";
import { reportTables, periodoReport } from "./fechamento-export";
import { jsPDF } from "jspdf";

import type { FechamentoDiario } from "@/lib/fechamento-types";
import { formatDateBR } from "@/lib/fechamento-stats";
import { formatBRL } from "@/lib/pedidos-types";

export function buildFechamentoPdf(
  f: FechamentoDiario,
  tables = reportTables(f),
  caption = `Fechamento - ${formatDateBR(f.data)}`,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 37;
  const drawnPages = new Set<number>();
  const header = () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (drawnPages.has(page)) return;
    drawnPages.add(page);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(168, 71, 22);
    doc.text("Bola Burguer", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(35, 45, 55);
    doc.text(caption, 14, 27);
  };
  for (const table of tables) {
    if (y > 235) {
      doc.addPage();
      y = 37;
    }
    header();
    autoTable(doc, {
      startY: y,
      head: [
        [
          {
            content: table.title,
            colSpan: table.headers.length,
            styles: {
              fillColor: [255, 255, 255],
              textColor: [35, 45, 55],
              fontSize: 11,
              cellPadding: { top: 2, bottom: 4, left: 0, right: 0 },
            },
          },
        ],
        table.headers,
      ],
      body: table.rows.map((row, n) =>
        row.map((c, j) =>
          typeof c === "number" &&
          table.money?.includes(j) &&
          (!table.monetaryRows || table.monetaryRows.includes(n))
            ? formatBRL(c)
            : String(c),
        ),
      ),
      styles: {
        font: "helvetica",
        fontSize: table.headers.length > 6 ? 7 : 9,
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [37, 52, 66] },
      alternateRowStyles: { fillColor: [241, 244, 246] },
      margin: { left: 14, right: 14, top: 34, bottom: 22 },
      didDrawPage: header,
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85, 95, 105);
    doc.text("Pago no sistema não comprova liquidação. Dados ausentes: não informado.", 14, 283);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} | ${page}/${doc.getNumberOfPages()}`,
      14,
      289,
    );
  }
  return doc;
}

export function downloadFechamentoPdf(f: FechamentoDiario) {
  buildFechamentoPdf(f).save(`fechamento-${f.data}-bolaburguer.pdf`);
}

export function downloadPeriodoPdf(
  titulo: string,
  resumo: {
    faturado: number;
    recebido: number;
    a_receber: number;
    total_pedidos: number;
    dias_registrados: number;
  },
  fechamentos: FechamentoDiario[],
) {
  const { fechamento, tables } = periodoReport(fechamentos);
  buildFechamentoPdf(fechamento, tables, titulo).save(
    `relatorio-${titulo.replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`,
  );
}
