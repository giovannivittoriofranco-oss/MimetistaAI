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
            val pergunta = input.text.toString()

            if (pergunta.isNotBlank()) {
                response.text = "Vou pesquisar:\n\n$pergunta"
            }
        }
    }
}