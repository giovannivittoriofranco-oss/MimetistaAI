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

            val json = JSONObject()
            json.put("message", pergunta)

            val body = json.toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("https://mimetistaai-1.onrender.com/chat")
                .post(body)
                .build()

            client.newCall(request).enqueue(object : okhttp3.Callback {

                override fun onFailure(
                    call: okhttp3.Call,
                    e: java.io.IOException
                ) {
                    runOnUiThread {
                        response.text =
                            "Não consegui conectar ao servidor.\n\n${e.message}"
                    }
                }

                override fun onResponse(
                    call: okhttp3.Call,
                    responseHttp: okhttp3.Response
                ) {
                    val resultado = responseHttp.body?.string() ?: ""

                    runOnUiThread {

                        if (responseHttp.isSuccessful) {
                            try {
                                val jsonResposta = JSONObject(resultado)
                                response.text =
                                    jsonResposta.optString(
                                        "response",
                                        "A IA não retornou uma resposta."
                                    )
                            } catch (e: Exception) {
                                response.text = resultado
                            }
                        } else {
                            response.text =
                                "Erro do servidor: ${responseHttp.code}\n\n$resultado"
                        }
                    }
                }
            })
        }
    }
}