import express from "express";
import cors from "cors";
import "dotenv/config";
import fs from "fs";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================================================
   MEMÓRIA
========================================================= */

const memoriaDir = path.join(process.cwd(), "memory");
const memoriaFile = path.join(memoriaDir, "memory.json");

if (!fs.existsSync(memoriaDir)) {
  fs.mkdirSync(memoriaDir, { recursive: true });
}

if (!fs.existsSync(memoriaFile)) {
  fs.writeFileSync(
    memoriaFile,
    JSON.stringify(
      {
        conversas: [],
        conhecimentos: [],
        fontes: []
      },
      null,
      2
    )
  );
}

function carregarMemoria() {
  try {
    return JSON.parse(
      fs.readFileSync(memoriaFile, "utf8")
    );
  } catch {
    return {
      conversas: [],
      conhecimentos: [],
      fontes: []
    };
  }
}

function salvarMemoria(memoria) {
  try {
    fs.writeFileSync(
      memoriaFile,
      JSON.stringify(memoria, null, 2)
    );
  } catch (erro) {
    console.error("Erro ao salvar memória:", erro.message);
  }
}

/* =========================================================
   TESTE
========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "MimetistaAI",
    cerebro: "multimodelo",
    memoria: true
  });
});

/* =========================================================
   MEMÓRIA
========================================================= */

app.get("/memory", (req, res) => {
  const memoria = carregarMemoria();

  res.json({
    conversas: memoria.conversas.length,
    conhecimentos: memoria.conhecimentos.length,
    fontes: memoria.fontes.length
  });
});

/* =========================================================
   TIMEOUT
========================================================= */

async function fetchComTimeout(url, options, timeout = 45000) {

  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {

    return await fetch(url, {
      ...options,
      signal: controller.signal
    });

  } finally {

    clearTimeout(timer);

  }
}

/* =========================================================
   OPENROUTER
========================================================= */

async function consultarOpenRouter(messages) {

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada");
  }

  const modelos = [
    "openrouter/free",
    "arcee-ai/trinity-mini:free",
    "meta-llama/llama-3.3-8b-instruct:free",
    "deepseek/deepseek-r1-0528:free"
  ];

  let ultimoErro = null;

  for (const modelo of modelos) {

    try {

      console.log(`OpenRouter tentando: ${modelo}`);

      const resposta = await fetchComTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              "https://mimetistaai-1.onrender.com",
            "X-Title": "MimetistaAI"
          },

          body: JSON.stringify({
            model: modelo,
            messages,
            temperature: 0.7
          })
        },
        40000
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {

        ultimoErro =
          dados?.error?.message ||
          `HTTP ${resposta.status}`;

        console.log(
          `OpenRouter ${modelo} falhou: ${ultimoErro}`
        );

        continue;
      }

      const texto =
        dados?.choices?.[0]?.message?.content;

      if (texto && texto.trim()) {

        return {
          texto: texto.trim(),
          modelo: `OpenRouter/${modelo}`
        };

      }

      ultimoErro = "Resposta vazia";

    } catch (erro) {

      ultimoErro =
        erro?.name === "AbortError"
          ? "Timeout"
          : erro?.message || "Erro desconhecido";

      console.log(
        `OpenRouter ${modelo} falhou: ${ultimoErro}`
      );

    }
  }

  throw new Error(
    `OpenRouter indisponível: ${ultimoErro}`
  );
}

/* =========================================================
   GEMINI
========================================================= */

async function consultarGemini(messages) {

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  /*
    Modelo escolhido para texto.
    Se esse modelo estiver indisponível na conta,
    o sistema simplesmente passa para a próxima API.
  */
  const modelo = "gemini-2.5-flash-lite";

  const systemMessage =
    messages.find(
      (item) => item.role === "system"
    )?.content || "";

  const historico = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role:
        item.role === "assistant"
          ? "model"
          : "user",
      parts: [
        {
          text: item.content
        }
      ]
    }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const resposta = await fetchComTimeout(
    url,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemMessage
            }
          ]
        },

        contents: historico,

        generationConfig: {
          temperature: 0.7
        }
      })
    },
    40000
  );

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {

    const erro =
      dados?.error?.message ||
      `HTTP ${resposta.status}`;

    throw new Error(
      `Gemini: ${erro}`
    );
  }

  const texto =
    dados?.candidates?.[0]?.content?.parts
      ?.map((parte) => parte.text || "")
      .join("")
      .trim();

  if (!texto) {
    throw new Error("Gemini retornou resposta vazia");
  }

  return {
    texto,
    modelo: `Gemini/${modelo}`
  };
}

/* =========================================================
   MISTRAL
========================================================= */

async function consultarMistral(messages) {

  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY não configurada");
  }

  const modelo = "mistral-small-latest";

  const resposta = await fetchComTimeout(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model: modelo,
        messages,
        temperature: 0.7
      })
    },
    40000
  );

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {

    const erro =
      dados?.error?.message ||
      `HTTP ${resposta.status}`;

    throw new Error(
      `Mistral: ${erro}`
    );
  }

  const texto =
    dados?.choices?.[0]?.message?.content;

  if (!texto || !texto.trim()) {
    throw new Error(
      "Mistral retornou resposta vazia"
    );
  }

  return {
    texto: texto.trim(),
    modelo: `Mistral/${modelo}`
  };
}

/* =========================================================
   CHAT
========================================================= */

app.post("/chat", async (req, res) => {

  const pergunta =
    typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

  if (!pergunta) {

    return res.json({
      response: "Digite alguma coisa.",
      memoria: true,
      pesquisou: false,
      modelo: "sistema"
    });

  }

  const memoria = carregarMemoria();

  /* =======================================================
     SALVAR PERGUNTA
  ======================================================= */

  memoria.conversas.push({
    usuario: pergunta,
    data: new Date().toISOString()
  });

  if (memoria.conversas.length > 1000) {
    memoria.conversas =
      memoria.conversas.slice(-1000);
  }

  salvarMemoria(memoria);

  /* =======================================================
     CONTEXTO
  ======================================================= */

  const ultimasConversas =
    memoria.conversas
      .slice(-30)
      .map((item) => {

        if (item.usuario) {
          return `Usuário: ${item.usuario}`;
        }

        if (item.assistente) {
          return `MimetistaAI: ${item.assistente}`;
        }

        return "";

      })
      .filter(Boolean)
      .join("\n");

  const conhecimentos =
    memoria.conhecimentos
      .slice(-30)
      .join("\n");

  const promptSistema = `
Você é o MimetistaAI.

Responda em português do Brasil.

Seja natural, claro, inteligente e útil.

Responda diretamente à pergunta do usuário.

Não diga que a pergunta foi apenas armazenada.

Não invente que pesquisou na internet quando não pesquisou.

Use a memória quando ela for relevante.

Conhecimentos salvos:
${conhecimentos || "Nenhum conhecimento salvo."}

Conversas recentes:
${ultimasConversas || "Nenhuma conversa anterior."}
`;

  const messages = [
    {
      role: "system",
      content: promptSistema
    },
    {
      role: "user",
      content: pergunta
    }
  ];

  /* =======================================================
     ORDEM DAS INTELIGÊNCIAS
  ======================================================= */

  const provedores = [
    {
      nome: "OpenRouter",
      funcao: consultarOpenRouter
    },
    {
      nome: "Gemini",
      funcao: consultarGemini
    },
    {
      nome: "Mistral",
      funcao: consultarMistral
    }
  ];

  let respostaFinal = null;
  let modeloUsado = null;

  /* =======================================================
     FAILOVER AUTOMÁTICO
  ======================================================= */

  for (const provedor of provedores) {

    try {

      console.log(
        `🧠 Tentando ${provedor.nome}...`
      );

      const resultado =
        await provedor.funcao(messages);

      if (
        resultado?.texto &&
        resultado.texto.trim()
      ) {

        respostaFinal =
          resultado.texto.trim();

        modeloUsado =
          resultado.modelo;

        console.log(
          `✅ Resposta obtida por ${modeloUsado}`
        );

        break;
      }

    } catch (erro) {

      /*
        O usuário NÃO recebe esse erro.
        Ele fica somente no log do Render.
      */

      console.log(
        `⚠️ ${provedor.nome} indisponível:`,
        erro?.message || erro
      );

      console.log(
        `🔄 Passando para o próximo provedor...`
      );

    }
  }

  /* =======================================================
     TODAS FALHARAM
  ======================================================= */

  if (!respostaFinal) {

    console.log(
      "⚠️ Todas as inteligências estão indisponíveis."
    );

    /*
      IMPORTANTE:
      Não retornamos HTTP 500/503.
      O APK recebe uma resposta normal.
    */

    return res.json({
      response:
        "Estou com muita demanda nas minhas inteligências agora. Aguarde um momento e tente novamente.",
      pesquisou: false,
      memoria: true,
      modelo: "sistema-fallback"
    });
  }

  /* =======================================================
     SALVAR RESPOSTA
  ======================================================= */

  const memoriaAtualizada =
    carregarMemoria();

  memoriaAtualizada.conversas.push({
    assistente: respostaFinal,
    data: new Date().toISOString()
  });

  if (
    memoriaAtualizada.conversas.length > 1000
  ) {

    memoriaAtualizada.conversas =
      memoriaAtualizada.conversas.slice(-1000);

  }

  salvarMemoria(memoriaAtualizada);

  /* =======================================================
     RESPOSTA PARA O APK
  ======================================================= */

  return res.json({
    response: respostaFinal,
    pesquisou: false,
    memoria: true,
    modelo: modeloUsado
  });

});

/* =========================================================
   ERRO GLOBAL
========================================================= */

app.use((erro, req, res, next) => {

  console.error(
    "Erro interno:",
    erro
  );

  /*
    Mesmo um erro inesperado não vira
    aquele JSON 500 feio no aplicativo.
  */

  res.json({
    response:
      "Estou processando sua solicitação. Tente novamente em instantes.",
    pesquisou: false,
    memoria: true,
    modelo: "sistema-fallback"
  });

});

/* =========================================================
   SERVIDOR
========================================================= */

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `MimetistaAI online na porta ${PORT}`
  );

});