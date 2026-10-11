import { formatBRL } from "@/lib/pedidos-types";

// Mesmo cardápio e mesmo adicional do site (sitebolaburger/src/lib/menu-data.ts) e do app
// (bolaburguer-app/lib/src/cardapio.dart). Mudou um preço, mude nos três.
export const CARDAPIO = [
  { nome: "Bola Salada Bacon", preco: 28.0, categoria: "Hambúrgueres" },
  { nome: "Bola Catupiry com Fritas", preco: 25.0, categoria: "Hambúrgueres" },
  { nome: "Bola Catupiry com Bacon", preco: 28.0, categoria: "Hambúrgueres" },
  { nome: "Bola Bacon Cheddar", preco: 29.0, categoria: "Hambúrgueres" },
  { nome: "Bola Mega Triplo", preco: 44.0, categoria: "Hambúrgueres" },
  { nome: "Bola Salada", preco: 25.0, categoria: "Hambúrgueres" },
  { nome: "Batata Palito 200g", preco: 20.0, categoria: "Porções" },
  { nome: "Batata Palito 400g", preco: 30.0, categoria: "Porções" },
  { nome: "Batata Canoa 200g", preco: 20.0, categoria: "Porções" },
  { nome: "Batata Canoa 400g", preco: 30.0, categoria: "Porções" },
  { nome: "Coca-Cola 350ml Latinha", preco: 5.0, categoria: "Bebidas" },
  { nome: "Coca-Cola 600ml", preco: 7.0, categoria: "Bebidas" },
  { nome: "Coca-Cola 1 Litro", preco: 9.0, categoria: "Bebidas" },
  { nome: "Coca-Cola 2 Litros", preco: 13.0, categoria: "Bebidas" },
] as const;

export const EXTRA_BURGER_PRICE = 6;

const ADICIONAL_PREFIXO = "Adicional: 1 hambúrguer";

// Mesmo texto que o site grava na observação do item, para o card e a notinha ficarem iguais.
export const ADICIONAL_OBSERVACAO = `${ADICIONAL_PREFIXO} (+${formatBRL(EXTRA_BURGER_PRICE)} por unidade)`;

export function ehHamburguer(nome: string) {
  return CARDAPIO.some((item) => item.nome === nome && item.categoria === "Hambúrgueres");
}

// O site junta o adicional e a observação do cliente com " | ".
export function temAdicional(observacao?: string) {
  return (observacao ?? "")
    .split(" | ")
    .some((parte) => parte.trim().startsWith(ADICIONAL_PREFIXO));
}

export function observacaoComAdicional(observacao: string | undefined, adicional: boolean) {
  const outras = (observacao ?? "")
    .split(" | ")
    .map((parte) => parte.trim())
    .filter((parte) => parte && !parte.startsWith(ADICIONAL_PREFIXO));
  return [adicional ? ADICIONAL_OBSERVACAO : "", ...outras].filter(Boolean).join(" | ");
}
