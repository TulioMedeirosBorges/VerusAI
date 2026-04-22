const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_SEARCH_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 30000;

function fetchComTimeout(url, options, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function callOpenAI(prompt, { useSearch = false, caller = "" } = {}, retries = 2) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não foi definida no .env");
  }

  // useSearch usa o endpoint de Responses com web_search_preview
  const url = useSearch ? OPENAI_SEARCH_URL : OPENAI_URL;

  const body = useSearch
    ? {
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: prompt,
      }
    : {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      };

  const serialized = JSON.stringify(body);
  const tag = caller ? `[OpenAI:${caller}]` : "[OpenAI]";
  console.log(`${tag} Payload size: ${Buffer.byteLength(serialized, "utf8")} bytes | useSearch: ${useSearch}`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    let response, data;
    try {
      response = await fetchComTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: serialized,
      });
      data = await response.json();
    } catch (e) {
      if (e.name === "AbortError") {
        console.warn(`${tag} Timeout na tentativa ${attempt}/${retries}`);
        if (attempt < retries) continue;
        throw new Error(`${tag} Timeout após ${TIMEOUT_MS}ms`);
      }
      throw e;
    }

    if ((response.status === 503 || response.status === 429) && attempt < retries) {
      const wait = attempt * 2000;
      console.warn(`${tag} ${response.status} na tentativa ${attempt}/${retries}, aguardando ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!response.ok) {
      const reason = data.error?.message || JSON.stringify(data);
      throw new Error(`OpenAI HTTP ${response.status}: ${reason}`);
    }

    let text;
    if (useSearch) {
      const msg = data.output?.find((o) => o.type === "message");
      text =
        msg?.content?.find((c) => c.type === "output_text")?.text ??
        msg?.content?.find((c) => c.type === "text")?.text ??
        (typeof msg?.content === "string" ? msg.content : null) ??
        data.output_text ??
        null;
      if (!text) console.error(`${tag} output completo:`, JSON.stringify(data.output).slice(0, 800));
    } else {
      text = data.choices?.[0]?.message?.content ?? null;
    }

    if (!text) {
      console.error(`${tag} Resposta inesperada:`, JSON.stringify(data).slice(0, 500));
      throw new Error("OpenAI não retornou texto.");
    }

    return text;
  }

  throw new Error("OpenAI: todas as tentativas falharam.");
}

async function callOpenAIJSON(prompt, options = {}) {
  const raw = await callOpenAI(prompt, options);

  // Tenta extrair JSON mesmo que venha com texto ao redor
  const clean = raw.replace(/```json|```/g, "").trim();

  // Tenta parse direto
  try {
    return JSON.parse(clean);
  } catch (_) {}

  // Tenta extrair o primeiro bloco JSON válido da resposta
  const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    // Tenta do maior para o menor bloco (greedy já pega o maior, mas valida)
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      // Tenta encontrar o último fechamento válido reduzindo o bloco
      let block = match[0];
      while (block.length > 2) {
        const lastClose = Math.max(block.lastIndexOf("}"), block.lastIndexOf("]"));
        if (lastClose === -1) break;
        block = block.slice(0, lastClose + 1);
        try { return JSON.parse(block); } catch (_) {}
      }
    }
  }

  const tag = options.caller ? `[OpenAIJSON:${options.caller}]` : "[OpenAIJSON]";
  console.error(`${tag} Falha ao parsear JSON. Resposta bruta:`, raw.slice(0, 600));
  throw new Error(`${tag} Resposta não é JSON válido`);
}

async function callOpenAIVision(prompt, frames, { caller = "" } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não foi definida no .env");
  }
  if (!frames || frames.length === 0) return null;

  const imageContent = frames.map((base64) => ({
    type: "image_url",
    image_url: {
      url: base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`,
      detail: "high",
    },
  }));

  const body = {
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...imageContent,
      ],
    }],
    temperature: 0.1,
    max_tokens: 2000,
  };

  const tag = caller ? `[OpenAIVision:${caller}]` : "[OpenAIVision]";
  const serialized = JSON.stringify(body);
  console.log(`${tag} Payload size: ${Buffer.byteLength(serialized, "utf8")} bytes | frames: ${frames.length}`);

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: serialized,
  });

  const data = await response.json();
  if (!response.ok) {
    const reason = data.error?.message || JSON.stringify(data);
    console.warn(`${tag} Erro: ${reason}`);
    return null;
  }

  const text = data.choices?.[0]?.message?.content ?? null;
  if (text) console.log(`${tag} Resposta: ${text.slice(0, 200)}`);
  return text;
}

module.exports = { callOpenAI, callOpenAIJSON, callOpenAIVision };
