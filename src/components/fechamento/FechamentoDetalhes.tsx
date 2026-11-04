import type { FechamentoDiario } from "@/lib/fechamento-types";
import { reportTables } from "@/lib/fechamento-export";
import { formatBRL } from "@/lib/pedidos-types";
export function FechamentoDetalhes({ fechamento }: { fechamento: FechamentoDiario }) {
  return (
    <div className="space-y-5">
      {reportTables(fechamento).map((t) => (
        <section key={t.title}>
          <h4 className="font-semibold mb-2">{t.title}</h4>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {t.headers.map((h) => (
                    <th key={h} className="p-2 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.length ? (
                  t.rows.map((row, n) => (
                    <tr key={n} className="border-t odd:bg-muted/20">
                      {row.map((v, j) => (
                        <td key={j} className="p-2">
                          {typeof v === "number" &&
                          t.money?.includes(j) &&
                          (!t.monetaryRows || t.monetaryRows.includes(n))
                            ? formatBRL(v)
                            : v}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={t.headers.length} className="p-3 text-muted-foreground">
                      Nenhum registro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        Valores de adicionais podem estar embutidos no preço unitário. Dados não registrados em
        fechamentos antigos aparecem como não informado. Cancelados ficam fora dos totais de vendas,
        fretes e cupons.
      </p>
    </div>
  );
}
