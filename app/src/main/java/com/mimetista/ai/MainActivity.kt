package com.mimetista.ai

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView

class MainActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        val input = findViewById<EditText>(R.id.searchInput)
        val button = findViewById<Button>(R.id.searchButton)
        val response = findViewById<TextView>(R.id.responseText)

        button.setOnClickListener {

            val pergunta = input.text.toString().trim()

            if (pergunta.isEmpty()) {
                response.text = "Digite alguma coisa para conversar comigo."
                return@setOnClickListener
            }

            response.text = responder(pergunta)
        }
    }

    private fun responder(pergunta: String): String {

        val texto = pergunta.lowercase()

        return when {
            texto.contains("oi") ||
            texto.contains("olá") ||
            texto.contains("ola") -> {
                "Olá! Eu sou o Mimetista AI. 👋\n\nComo posso ajudar?"
            }

            texto.contains("quem é você") ||
            texto.contains("quem e voce") -> {
                "Eu sou o Mimetista AI.\n\nEstou sendo desenvolvido para conversar, pesquisar informações, aprender com o contexto e ajudar em tarefas."
            }

            texto.contains("tudo bem") -> {
                "Tudo certo por aqui. 😄\n\nO que você quer fazer?"
            }

            else -> {
                "Entendi:\n\n$pergunta\n\nEstou sendo preparado para responder usando uma IA real."
            }
        }
    }
}