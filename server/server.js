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
   CHAT
================================ */

app.post("/chat", async (req, res) => {
  try {
    const pergunta = req.body.message;

    if (!pergunta) {
      return res.status(400).json({
        error: "Mensagem vazia"
      });
    }

    const memoria = carregarMemoria();

    /*
      Guardamos a conversa.
    */

    memoria.conversas.push({
      usuario: pergunta,
      data: new Date().toISOString()
    });

    /*
      Limitamos o histórico para evitar
      que o arquivo cresça indefinidamente.
    */

    if (memoria.conversas.length > 1000) {
      memoria.conversas =
        memoria.conversas.slice(-1000);
    }

    salvarMemoria(memoria);

    /*
      Por enquanto, resposta de teste.
      Na próxima etapa vamos ligar o
      modelo open-source aqui.
    */

    return res.json({
      response:
        "Meu cérebro open-source está sendo preparado. " +
        "Sua mensagem foi armazenada na minha memória.",
      pesquisou: false,
      memoria: true
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Erro interno do MimetistaAI"
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