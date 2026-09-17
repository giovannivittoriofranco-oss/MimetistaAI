import express from "express";
import cors from "cors";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "MimetistaAI"
  });
});

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Pesquisa na Internet usando Tavily
async function pesquisarInternet(pergunta) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY não configurada no Render");
  }

  const resposta = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: pergunta,
      search_depth: "advanced",
      topic: "general",
      max_results: 5,
      include_answer: true,
      include_raw_content: true
    })
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Erro Tavily ${resposta.status}: ${erro}`);
  }

  return await resposta.json();
}

// Consulta o Gemini com tentativas automáticas
async function gerarResposta(conteudo) {
  const maxTentativas = 3;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const resposta = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: conteudo
      });

      return resposta.text;

    } catch (error) {
      console.error(
        `Tentativa ${tentativa}/${maxTentativas} falhou:`,
        error
      );

      const status = error?.status || error?.error?.code;

      if (
        (status === 503 || status === 429 || status === 500) &&
        tentativa < maxTentativas
      ) {
        const tempoEspera = tentativa * 2000;

        console.log(
          `Aguardando ${tempoEspera}ms antes de tentar novamente...`
        );

        await esperar(tempoEspera);
        continue;
      }

      throw error;
    }
  }
}

app.post("/chat", async (req, res) => {
  try {
    const pergunta = req.body.message;

    if (!pergunta) {
      return res.status(400).json({
        error: "Mensagem vazia"
      });
    }

    // Detecta se o usuário pediu uma pesquisa na Internet
    const texto = pergunta.toLowerCase();

    const pesquisar =
      texto.includes("pesquise na internet") ||
      texto.includes("pesquisar na internet") ||
      texto.includes("pesquise na web") ||
      texto.includes("pesquisar na web") ||
      texto.includes("procure na internet") ||
      texto.includes("procure na web") ||
      texto.includes("pesquise online");

    let conteudoParaIA = pergunta;

    if (pesquisar) {
      console.log("🔎 Pesquisa na Internet solicitada");

      const dados = await pesquisarInternet(pergunta);

      const resultados = dados.results || [];

      let contextoWeb = "";

      if (dados.answer) {
        contextoWeb += `Resumo encontrado pela pesquisa:\n${dados.answer}\n\n`;
      }

      resultados.forEach((resultado, index) => {
        contextoWeb += `
Fonte ${index + 1}:
Título: ${resultado.title}
URL: ${resultado.url}
Conteúdo:
${resultado.raw_content || resultado.content || ""}
        
`;
      });

      conteudoParaIA = `
Você é o MimetistaAI.

O usuário pediu explicitamente uma pesquisa na Internet.

Use os resultados reais da pesquisa abaixo para responder.
Não invente informações que não estejam nos resultados.
Se os resultados forem insuficientes, diga claramente.

Pergunta do usuário:
${pergunta}

Resultados da Internet:
${contextoWeb}

Responda de forma clara e útil.
Quando utilizar uma informação encontrada nas fontes, mencione a fonte ou o site correspondente.
`;
    }

    const resposta = await gerarResposta(conteudoParaIA);

    res.json({
      response: resposta,
      pesquisou: pesquisar
    });

  } catch (error) {
    console.error("Erro final:", error);

    res.status(500).json({
      error: "Erro ao processar sua pergunta. Tente novamente."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MimetistaAI online na porta ${PORT}`);
});