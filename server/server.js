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
   MEMÓRIA
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
   TESTE
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
   MODELOS GRATUITOS
   ORDEM DE TENTATIVA
================================ */

const modelos = [
  "openrouter/free",
  "arcee-ai/trinity-mini:free",
  "meta-llama/llama-3.3-8b-instruct:free",
  "deepseek/deepseek-r1-0528:free"
];

/* ================================
   CHAT
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
       SALVAR PERGUNTA
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
       CONTEXTO
    ================================= */

    const ultimasConversas =
      memoria.conversas
        .slice(-20)
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
        .slice(-20)
        .join("\n");

    const promptSistema = `
Você é o MimetistaAI.

Responda em português do Brasil.

Seja natural, claro e útil.
Não diga que você está sendo preparado.
Não diga que a pergunta foi apenas armazenada.
Responda diretamente ao usuário.

Você possui memória e pode usar as informações
relevantes presentes abaixo.

Conhecimentos:
${conhecimentos || "Nenhum conhecimento salvo."}

Conversas recentes:
${ultimasConversas || "Nenhuma conversa anterior."}
`;

    /* ================================
       API KEY
    ================================= */

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "OPENROUTER_API_KEY não está configurada."
      });
    }

    /* ================================
       TENTAR MODELOS
    ================================= */

    let respostaFinal = null;
    let ultimoErro = null;
    let modeloUsado = null;

    for (const modelo of modelos) {

      try {

        console.log(
          `Tentando modelo: ${modelo}`
        );

        const respostaIA = await fetch(
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

        if (!respostaIA.ok) {

          ultimoErro =
            dados?.error?.message ||
            `Erro HTTP ${respostaIA.status}`;

          console.log(
            `Modelo ${modelo} falhou: ${ultimoErro}`
          );

          continue;
        }

        const resposta =
          dados?.choices?.[0]?.message?.content;

        if (
          resposta &&
          resposta.trim()
        ) {

          respostaFinal = resposta;
          modeloUsado = modelo;

          break;
        }

        ultimoErro =
          "O modelo não retornou texto.";

      } catch (erro) {

        ultimoErro =
          erro?.message ||
          "Erro desconhecido";

        console.log(
          `Erro no modelo ${modelo}:`,
          ultimoErro
        );
      }
    }

    /* ================================
       NENHUM MODELO RESPONDEU
    ================================= */

    if (!respostaFinal) {

      return res.status(503).json({
        error:
          "Nenhum modelo gratuito conseguiu responder agora.",
        detalhes: ultimoErro
      });
    }

    /* ================================
       SALVAR RESPOSTA
    ================================= */

    memoria.conversas.push({
      assistente: respostaFinal,
      data: new Date().toISOString()
    });

    if (memoria.conversas.length > 1000) {
      memoria.conversas =
        memoria.conversas.slice(-1000);
    }

    salvarMemoria(memoria);

    /* ================================
       RESPOSTA PARA O APK
    ================================= */

    return res.json({
      response: respostaFinal,
      pesquisou: false,
      memoria: true,
      modelo: modeloUsado
    });

  } catch (error) {

    console.error(
      "Erro geral do MimetistaAI:",
      error
    );

    return res.status(500).json({
      error:
        "Erro interno do MimetistaAI."
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