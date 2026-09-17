package com.mimetista.ai

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : Activity() {

    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        val input = findViewById<EditText>(R.id.searchInput)
        val button = findViewById<Button>(R.id.searchButton)
        val response = findViewById<TextView>(R.id.responseText)

        button.setOnClickListener {

            val pergunta = input.text.toString().trim()

            if (pergunta.isEmpty()) {
                response.text = "Digite alguma coisa."
                return@setOnClickListener
            }

            response.text = "Mimetista está pensando..."

            val messages = JSONArray()

            messages.put(
                JSONObject().apply {
                    put("role", "system")
                    put(
                        "content",
                        "Você é o MimetistaAI. Responda sempre em português, seja direto e amigável."
                    )
                }
            )

            messages.put(
                JSONObject().apply {
                    put("role", "user")
                    put("content", pergunta)
                }
            )

            val json = JSONObject().apply {
                put("messages", messages)
                put("max_tokens", 128)
                put(
                    "chat_template_kwargs",
                    JSONObject().apply {
                        put("enable_thinking", false)
                    }
                )
            }

            val body = json.toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("http://127.0.0.1:8080/v1/chat/completions")
                .post(body)
                .build()

            client.newCall(request).enqueue(object : okhttp3.Callback {

                override fun onFailure(
                    call: okhttp3.Call,
                    e: java.io.IOException
                ) {
                    runOnUiThread {
                        response.text =
                            "Não consegui conectar ao cérebro local.\n\n${e.message}"
                    }
                }

                override fun onResponse(
                    call: okhttp3.Call,
                    responseHttp: okhttp3.Response
                ) {
                    val resultado =
                        responseHttp.body?.string() ?: ""

                    runOnUiThread {

                        if (responseHttp.isSuccessful) {
                            try {
                                val jsonResposta =
                                    JSONObject(resultado)

                                val escolhas =
                                    jsonResposta.getJSONArray("choices")

                                val mensagem =
                                    escolhas
                                        .getJSONObject(0)
                                        .getJSONObject("message")

                                response.text =
                                    mensagem.optString(
                                        "content",
                                        "O cérebro não retornou uma resposta."
                                    )

                            } catch (e: Exception) {
                                response.text =
                                    "Erro ao interpretar a resposta."
                            }

                        } else {
                            response.text =
                                "Erro do cérebro: ${responseHttp.code}\n\n$resultado"
                        }
                    }
                }
            })
        }
    }
}
