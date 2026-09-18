import express from "express";
import cors from "cors";
import "dotenv/config";
import fs from "fs";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ================================
   MEMÓRIA DO MIMETISTAAI
================================ */

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
  fs.writeFileSync(
    memoriaFile,
    JSON.stringify(memoria, null, 2)
  );
}

/* ================================
   TESTE DO SERVIDOR
================================ */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "MimetistaAI",
    cerebro: "open-source",
    memoria: true
  });
});

/* ================================
   MEMÓRIA
================================ */

app.get("/memory", (req, res) => {
  const memoria = carregarMemoria();

  res.json({
    conversas: memoria.conversas.length,
    conhecimentos: memoria.conhecimentos.length,
    fontes: memoria.fontes.length
  });
});

/* ================================
   CHAT + OPENROUTER
================================ */

app.post("/chat", async (req, res) => {
  try {
    const pergunta = req.body.message;

    if (!pergunta || !pergunta.trim()) {
      return res.status(400).json({
        error: "Mensagem vazia"
      });
    }

    const memoria = carregarMemoria();

    /* ================================
       SALVAR PERGUNTA NA MEMÓRIA
    ================================= */

    memoria.conversas.push({
      usuario: pergunta,
      data: new Date().toISOString()
    });

    if (memoria.conversas.length > 1000) {
      memoria.conversas =
        memoria.conversas.slice(-1000);
    }

    salvarMemoria(memoria);

    /* ================================
       PREPARAR CONTEXTO DA MEMÓRIA
    ================================= */

    const ultimasConversas =
      memoria.conversas
        .slice(-20)
        .map((item) => `Usuário: ${item.usuario}`)
        .join("\n");

    const conhecimentos =
      memoria.conhecimentos
        .slice(-20)
        .join("\n");

    const promptSistema = `
Você é o MimetistaAI.

Você é um assistente de inteligência artificial.
Responda em português do Brasil, de forma clara,
natural e útil.

Você possui memória.
Use as informações da memória quando forem
relevantes para responder ao usuário.

Não invente informações pessoais sobre o usuário.

Memória de conhecimentos:
${conhecimentos || "Nenhum conhecimento salvo ainda."}

Conversas recentes:
${ultimasConversas || "Nenhuma conversa anterior."}
`;

    /* ================================
       VERIFICAR API KEY
    ================================= */

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "OPENROUTER_API_KEY não está configurada no Render."
      });
    }

    /* ================================
       CHAMAR OPENROUTER
    ================================= */

    const respostaIA = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            "https://mimetistaai-1.onrender.com",
          "X-Title": "MimetistaAI"
        },

        body: JSON.stringify({
          model: "openrouter/free",

          messages: [
            {
              role: "system",
              content: promptSistema
            },
            {
              role: "user",
              content: pergunta
            }
          ],

          temperature: 0.7
        })
      }
    );

    const dados = await respostaIA.json();

    /* ================================
       ERRO DA OPENROUTER
    ================================= */

    if (!respostaIA.ok) {
      console.error(
        "Erro OpenRouter:",
        JSON.stringify(dados)
      );

      return res.status(500).json({
        error: "Erro ao consultar a inteligência artificial.",
        detalhes:
          dados?.error?.message ||
          "OpenRouter retornou um erro."
      });
    }

    /* ================================
       PEGAR RESPOSTA
    ================================= */

    const resposta =
      dados?.choices?.[0]?.message?.content;

    if (!resposta) {
      return res.status(500).json({
        error:
          "A inteligência artificial não retornou uma resposta."
      });
    }

    /* ================================
       SALVAR RESPOSTA NA MEMÓRIA
    ================================= */

    memoria.conversas.push({
      assistente: resposta,
      data: new Date().toISOString()
    });

    if (memoria.conversas.length > 1000) {
      memoria.conversas =
        memoria.conversas.slice(-1000);
    }

    salvarMemoria(memoria);

    /* ================================
       RESPONDER AO APK
    ================================= */

    return res.json({
      response: resposta,
      pesquisou: false,
      memoria: true
    });

  } catch (error) {

    console.error(
      "Erro no MimetistaAI:",
      error
    );

    return res.status(500).json({
      error: "Erro interno do MimetistaAI."
    });
  }
});

/* ================================
   SERVIDOR
================================ */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `MimetistaAI online na porta ${PORT}`
  );
});
