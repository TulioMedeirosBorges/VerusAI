import "dotenv/config";
import { classifyPage } from "../services/classifyPage.js";

const pageData = {
  url: "https://exemplo.com/noticia/governo-anuncia-medida",
  domain: "exemplo.com",
  title: "Governo anuncia nova medida econômica",
  description: "Nova medida foi anunciada nesta segunda-feira.",
  siteName: "Portal Exemplo",
  author: "Redação",
  publishDate: "2026-05-04",
  imageUrl: "",
  language: "pt-BR",
  pageType: "article",
  headings: ["Governo anuncia nova medida econômica"],
  links: ["https://exemplo.com/politica", "https://exemplo.com/economia"],
  textLength: 450,
  text: `
    Menu Home Política Economia Esportes.
    Governo anuncia nova medida econômica.
    Segundo o ministério, a proposta busca reduzir custos e ampliar investimentos.
    Leia também outras notícias.
    Newsletter. Publicidade.
  `,
};

try {
  const resultado = await classifyPage(pageData);
  console.log("Resultado classifyPage:");
  console.log(JSON.stringify(resultado, null, 2));
} catch (error) {
  console.error("Erro no teste:");
  console.error(error);
}
