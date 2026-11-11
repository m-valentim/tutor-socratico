import os
import time

import fitz
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client


load_dotenv()

ARQUIVO_PDF = os.getenv("RAG_PDF", "Carlos Alberto Heuser - Projeto de Banco de Dados.pdf")
MODELO_EMBEDDING = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
TAMANHO_TRECHO = int(os.getenv("CHUNK_SIZE", "500"))
SOBREPOSICAO = int(os.getenv("CHUNK_OVERLAP", "100"))
TAMANHO_LOTE = int(os.getenv("EMBED_BATCH_SIZE", "20"))
INTERVALO_LOTES = int(os.getenv("EMBED_BATCH_DELAY", "15"))
DIMENSAO_EMBEDDING = 768


def extrair_documento(caminho_pdf):
    partes = []
    intervalos_paginas = []
    posicao = 0

    with fitz.open(caminho_pdf) as documento:
        for numero_pagina, pagina in enumerate(documento, start=1):
            texto = pagina.get_text("text").strip()
            if not texto:
                continue

            if partes:
                partes.append("\n")
                posicao += 1

            inicio = posicao
            partes.append(texto)
            posicao += len(texto)
            intervalos_paginas.append((inicio, posicao, numero_pagina))

    return "".join(partes), intervalos_paginas


def pagina_da_posicao(posicao, intervalos_paginas):
    for inicio, fim, pagina in intervalos_paginas:
        if inicio <= posicao < fim:
            return pagina
    return intervalos_paginas[-1][2] if intervalos_paginas else 1


def extrair_trechos(caminho_pdf):
    texto, intervalos_paginas = extrair_documento(caminho_pdf)
    if not texto:
        return []

    passo = TAMANHO_TRECHO - SOBREPOSICAO
    if passo <= 0:
        raise ValueError("CHUNK_OVERLAP deve ser menor que CHUNK_SIZE.")

    trechos = []
    nome_documento = os.path.basename(caminho_pdf)

    for inicio in range(0, len(texto), passo):
        trecho = texto[inicio:inicio + TAMANHO_TRECHO].strip()
        if len(trecho) < 50:
            continue

        trechos.append(
            {
                "texto_chunk": trecho,
                "numero_pagina": pagina_da_posicao(inicio, intervalos_paginas),
                "nome_documento": nome_documento,
            }
        )

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
                model=MODELO_EMBEDDING,
                contents=textos,
                config=types.EmbedContentConfig(output_dimensionality=DIMENSAO_EMBEDDING),
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

        if inicio + TAMANHO_LOTE < len(trechos):
            time.sleep(INTERVALO_LOTES)

    if falhas:
        print(f"Processamento finalizado com {falhas} lote(s) não salvo(s).")
    else:
        print("Ingestão concluída.")


if __name__ == "__main__":
    processar_pdf()
