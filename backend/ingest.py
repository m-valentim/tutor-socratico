import os
import time

import fitz
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client


load_dotenv()

ARQUIVO_PDF = "Carlos Alberto Heuser - Projeto de Banco de Dados.pdf"
TAMANHO_TRECHO = 500
SOBREPOSICAO = 100
TAMANHO_LOTE = 20
INTERVALO_LOTES = 15


def extrair_trechos(caminho_pdf):
    trechos = []
    passo = TAMANHO_TRECHO - SOBREPOSICAO

    with fitz.open(caminho_pdf) as documento:
        for numero_pagina, pagina in enumerate(documento, start=1):
            texto = pagina.get_text("text").strip()
            if not texto:
                continue

            for inicio in range(0, len(texto), passo):
                trecho = texto[inicio:inicio + TAMANHO_TRECHO]
                if len(trecho) < 50:
                    continue

                trechos.append({
                    "texto_chunk": trecho,
                    "numero_pagina": numero_pagina,
                    "nome_documento": os.path.basename(caminho_pdf),
                })

    return trechos


def processar_pdf():
    try:
        trechos = extrair_trechos(ARQUIVO_PDF)
    except Exception as erro:
        print(f"Não foi possível ler o PDF: {erro}")
        return

    if not trechos:
        print("Nenhum texto foi encontrado no arquivo.")
        return

    print(f"Foram extraídos {len(trechos)} trechos do PDF.")

    supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    falhas = 0
    for inicio in range(0, len(trechos), TAMANHO_LOTE):
        lote = trechos[inicio:inicio + TAMANHO_LOTE]
        textos = [item["texto_chunk"] for item in lote]
        numero_lote = inicio // TAMANHO_LOTE + 1

        try:
            resposta = gemini.models.embed_content(
                model="gemini-embedding-001",
                contents=textos,
                config=types.EmbedContentConfig(output_dimensionality=768),
            )

            embeddings = resposta.embeddings or []
            if len(embeddings) != len(lote):
                raise ValueError("O Gemini retornou uma quantidade inesperada de embeddings.")

            registros = []
            for trecho, embedding in zip(lote, embeddings):
                registros.append({**trecho, "vetor": embedding.values})

            supabase.table("documentos").insert(registros).execute()
            print(f"Lote {numero_lote}: {len(registros)} trechos salvos.")
        except Exception as erro:
            falhas += 1
            print(f"Falha no lote {numero_lote}: {erro}")

        # A pausa evita consumir rapidamente a cota da API de embeddings.
        if inicio + TAMANHO_LOTE < len(trechos):
            time.sleep(INTERVALO_LOTES)

    if falhas:
        print(f"Processamento finalizado com {falhas} lote(s) não salvo(s).")
    else:
        print("Ingestão concluída.")


if __name__ == "__main__":
    processar_pdf()
