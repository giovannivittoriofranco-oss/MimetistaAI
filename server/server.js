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

app.post("/chat", async (req, res) => {
  try {
    const pergunta = req.body.message;

    if (!pergunta) {
      return res.status(400).json({
        error: "Mensagem vazia"
      });
    }

    const resposta = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: pergunta
    });

    res.json({
      response: resposta.text
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erro ao consultar a IA"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MimetistaAI online na porta ${PORT}`);
});