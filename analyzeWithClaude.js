async function analyzeWithClaude(text, frames, imageUrl) {
  const API_KEY = "AIzaSyAMVlJ4H2rAVxHX8k5UiZTKh6pgeJ6QvVw";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const images = frames.map((base64) => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64.replace(/^data:image\/jpeg;base64,/, ""),
    },
  }));

  const response = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            ...images,
            {
              text: `
                Você receberá o conteúdo de uma página da web. A página pode conter muitos elementos como menus, anúncios, comentários, barras laterais e scripts.

Foque apenas no conteúdo principal da página e ignore elementos secundários.

Se identificar uma notícia, faça:
1. Um breve resumo sobre o assunto da notícia.
2. Diga se as informações parecem ter base em fatos confiáveis ou se parecem ser teorias da conspiração ou informações duvidosas.

Se identificar que o conteúdo vem de uma página de busca (como Google) e a pesquisa parecer relacionada a uma notícia, responda com uma hipótese como:
"Vi que você está no Google procurando algo. Será que é sobre isso?"
Em seguida, mostre o possível link da notícia relacionada.

Se não houver nenhuma notícia detectável na página, informe que não foi possível encontrar notícias e que você não pode ajudar naquele momento.

                Se a página tiver um artigo ou notícia, baseie sua análise principalmente nesse conteúdo.

                ⚠️ IMPORTANTE: Execute todas as etapas de análise internamente, 
                mas NUNCA as exiba na resposta. Retorne APENAS o resultado final,
                com no máximo 300 caracteres.

                ---

                ## CONTEÚDO RECEBIDO:
                ${text}
                ${imageUrl ? `## IMAGEM DO POST: ${imageUrl}` : ""}

                ---

                ## ANÁLISE DE IMAGEM E/OU TEXTO

                Analise cuidadosamente todo o conteúdo recebido, seja ele:
                - Uma imagem
                - Um texto
                - Um texto presente dentro de uma imagem
                - Uma combinação de imagem e texto

                Extraia TODA informação que o conteúdo tenta transmitir e verifique 
                se essa informação é real e verificável.

                ⚠️ DEFINIÇÃO IMPORTANTE: Uma informação verificável não é apenas 
                aquilo que se apresenta explicitamente como "notícia". Qualquer 
                conteúdo que tente passar uma informação como verdade — seja um 
                print, um meme com dados, uma frase de impacto, uma estatística, 
                uma afirmação sobre pessoa pública, um acontecimento ou fato — 
                deve ser tratado como uma informação a ser verificada.

                Após extrair a informação, pesquise nos portais de notícias 
                confiáveis para verificar se essa informação existe, foi 
                confirmada ou desmentida por fontes jornalísticas. Se a informação 
                não existir em nenhum portal confiável, isso deve ser informado 
                claramente no resultado final.

                ---

                ## ANÁLISE INTERNA (não exibir):
                1. Classifique o conteúdo: Notícia, Opinião, Genérico ou 
                  Desinformação Aparente
                2. Verifique se há fonte declarada no conteúdo
                3. Se for Notícia ou Desinformação: pesquise nos portais abaixo
                4. Se for Genérico ou Opinião: apenas resuma e encerre

                Portais Brasileiros:
                - G1: https://g1.globo.com/
                - UOL Notícias: https://noticias.uol.com.br/
                - Folha de S.Paulo: https://www.folha.uol.com.br/
                - Estadão: https://www.estadao.com.br/
                - CNN Brasil: https://www.cnnbrasil.com.br/
                - Terra: https://www.terra.com.br/noticias/
                - Nexo Jornal: https://www.nexojornal.com.br/
                - Poder360: https://www.poder360.com.br/
                - Valor Econômico: https://valor.globo.com/

                Portais Internacionais:
                - BBC News: https://www.bbc.com/news
                - Reuters: https://www.reuters.com/
                - The New York Times: https://www.nytimes.com/
                - The Guardian: https://www.theguardian.com/

                ---

                ## VERIFICAÇÃO DE LINKS (OBRIGATÓRIO):

                Antes de incluir qualquer link na resposta, você DEVE:
                1. Confirmar que o link existe e leva diretamente à notícia
                2. Testar se a URL está correta e acessível
                3. Verificar se o link corresponde exatamente ao conteúdo encontrado

                ⚠️ PROIBIDO: Inventar, completar, supor ou modificar qualquer URL.
                Se o link não puder ser 100% confirmado, NÃO o inclua na resposta.
                Um link inventado é pior que nenhum link.

                ---

                ## PESQUISA NO GOOGLE

                Se não encontrar a informação diretamente nos portais confiáveis,
                realize uma busca no Google como recurso secundário.

                ⚠️ REGRA IMPORTANTE SOBRE RESULTADOS DO GOOGLE:
                O Google é apenas um mecanismo de busca e não é uma fonte confiável
                por si só. Se o único resultado encontrado vier de uma busca genérica
                no Google — sem apontar para um dos portais confiáveis listados —
                você DEVE retornar a seguinte mensagem no lugar do link:

                "⚠️ FONTE GENÉRICA — Esta informação foi encontrada via Google,
                porém não está disponível em nenhum portal jornalístico confiável.
                Não é possível verificar sua veracidade com total credibilidade."

                Apenas resultados que apontem diretamente para um dos portais
                confiáveis listados devem ser incluídos como links verificados.
                Resultados de blogs, redes sociais, fóruns ou sites desconhecidos
                encontrados via Google devem ser completamente ignorados.

                ---

                ## FORMATO DE RESPOSTA (APENAS ISSO DEVE SER EXIBIDO):

                ### SE for informação/notícia verificada:
                Notícia:
                [Resumo de até 200 caracteres sobre o que se trata]
                Links:
                <a href="[URL confirmada]">[Nome do Portal]</a>

                ### SE for informação/notícia não verificada:
                Notícia:
                [Resumo de até 200 caracteres sobre o que se trata]
                Links:
                ❌ Nenhum link confirmado encontrado nos portais consultados.

                ### SE não for notícia ou informação verificável:
                📌 [Resumo de até 200 caracteres sobre o que se trata o post]
                ℹ️ NÃO É NOTÍCIA — Este conteúdo não tenta passar uma informação
                verificável.

                ---

                ## REGRAS OBRIGATÓRIAS:
                1. NUNCA exiba etapas, títulos de etapas ou o processo de análise
                2. NUNCA invente, suponha ou modifique links
                3. NUNCA inclua um link sem ter confirmado que ele funciona
                4. Resumo deve ter no máximo 200 caracteres
                5. Seja direto e objetivo
              `,
            },
          ],
        },
      ],
      tools: [
        {
          googleSearch: {},
        },
      ],
    }),
  });

  const data = await response.json();

  console.log(text);
  const parts = data.candidates[0].content.parts;
  const textPart = parts.find((part) => part.text);
  return textPart.text;
}
