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
import java.io.IOException
import java.util.concurrent.TimeUnit

class MainActivity : Activity() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

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

            button.isEnabled = false
            response.text = "Mimetista está pensando..."

            val json = JSONObject().apply {
                put("message", pergunta)
            }

            val body = json.toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("https://mimetistaai-1.onrender.com/chat")
                .post(body)
                .build()

            client.newCall(request).enqueue(object : okhttp3.Callback {

                override fun onFailure(
                    call: okhttp3.Call,
                    e: IOException
                ) {
                    runOnUiThread {
                        button.isEnabled = true

                        response.text =
                            "Não consegui conectar ao MimetistaAI.\n\n" +
                            (e.message ?: "Erro de conexão")
                    }
                }

                override fun onResponse(
                    call: okhttp3.Call,
                    responseHttp: okhttp3.Response
                ) {
                    responseHttp.use {

                        val resultado = it.body?.string() ?: ""

                        runOnUiThread {

                            button.isEnabled = true

                            if (it.isSuccessful) {

                                try {

                                    val jsonResposta =
                                        JSONObject(resultado)

                                    val resposta =
                                        jsonResposta.optString(
                                            "response",
                                            ""
                                        )

                                    if (resposta.isNotBlank()) {

                                        response.text = resposta

                                    } else {

                                        response.text =
                                            "O MimetistaAI não retornou uma resposta."
                                    }

                                } catch (e: Exception) {

                                    response.text =
                                        "Recebi uma resposta, mas não consegui interpretá-la."
                                }

                            } else {

                                response.text =
                                    "Erro do MimetistaAI (${it.code}).\n\n$resultado"
                            }
                        }
                    }
                }
            })
        }
    }
}