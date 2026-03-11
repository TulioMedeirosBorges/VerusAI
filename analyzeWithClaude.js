async function analyzeWithClaude(text, frames) {
  const API_KEY = "AIzaSyCVroqs4eCz9phbHFVn3L-iFjWjJ88KlkA";
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
                Analise frames sequenciais de um vídeo do Instagram e a descrição: "${text}".

                Explique brevemente o que acontece.

                Se parecer uma notícia:
                - verifique se ela existe (pesquise na internet)
                - diga se é confiável ou enganosa
                - indique possíveis falácias

                Inclua links confiáveis em <a></a> se existirem. Nunca invente links.

                Resposta: máximo 200 caracteres (links não contam).
              `,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  return data.candidates[0].content.parts[0].text;
}
