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

app.get("/", (req, res) => {
  res.json({
    status: "online",
    app: "MimetistaAI"
  });
});

// Espera alguns milissegundos
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Tenta consultar a IA novamente quando houver erro temporário
async function gerarResposta(pergunta) {
  const maxTentativas = 3;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const resposta = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: pergunta
      });

      return resposta.text;

    } catch (error) {
      console.error(
        `Tentativa ${tentativa}/${maxTentativas} falhou:`,
        error
      );

      const status = error?.status || error?.error?.code;

      // Só repete automaticamente em erros temporários
      if (status === 503 || status === 429 || status === 500) {
        if (tentativa < maxTentativas) {
          const tempoEspera = tentativa * 2000;

          console.log(
            `Aguardando ${tempoEspera}ms antes de tentar novamente...`
          );

          await esperar(tempoEspera);
          continue;
        }
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

    const resposta = await gerarResposta(pergunta);

    res.json({
      response: resposta
    });

  } catch (error) {
    console.error("Erro final ao consultar a IA:", error);

    res.status(500).json({
      error: "Erro ao consultar a IA. Tente novamente em alguns segundos."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MimetistaAI online na porta ${PORT}`);
});