import os
import time
import fitz  # PyMuPDF
from supabase import create_client, Client
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Conecta com Supabase e Gemini
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

NOME_ARQUIVO = "Carlos Alberto Heuser - Projeto de Banco de Dados.pdf"

def processar_pdf():
    print(f"Iniciando a leitura do livro: {NOME_ARQUIVO}...")
    
    try:
        doc = fitz.open(NOME_ARQUIVO)
    except Exception as e:
        print(f"Erro ao abrir o PDF: {e}")
        return

    tamanho_chunk = 500
    sobreposicao = 100
    
    todos_chunks = []
    paginas_dos_chunks = []

    print("Etapa 1: Extraindo e fatiando o texto do PDF")
    for num_pagina in range(len(doc)):
        pagina = doc.load_page(num_pagina)
        texto = pagina.get_text("text").strip()
        
        if not texto:
            continue

        inicio = 0
        while inicio < len(texto):
            fim = inicio + tamanho_chunk
            pedaco = texto[inicio:fim]
            if len(pedaco) >= 50:
                todos_chunks.append(pedaco)
                paginas_dos_chunks.append(num_pagina + 1)
            inicio += (tamanho_chunk - sobreposicao)

    total_pedacos = len(todos_chunks)
    print(f"Total de pedaços de texto gerados: {total_pedacos}")
    
    # Processamento batching (em lotes) de 20 em 20
    TAMANHO_LOTE = 20
    
    print("Etapa 2: Enviando lotes para a IA e salvando no banco")
    for i in range(0, total_pedacos, TAMANHO_LOTE):
        lote_textos = todos_chunks[i:i + TAMANHO_LOTE]
        lote_paginas = paginas_dos_chunks[i:i + TAMANHO_LOTE]
        
        print(f"Processando lote de {i} até {i + len(lote_textos)}...")
        
        try:
            # Envia a lista com 20 textos de uma vez para o Gemini
            resposta_embedding = ai_client.models.embed_content(
                model="gemini-embedding-001",
                contents=lote_textos,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            
            # Prepara a lista para inserir de uma vez no Supabase
            dados_insercao = []
            # O Gemini devolve uma lista de embeddings na mesma ordem enviada
            for j, embedding_obj in enumerate(resposta_embedding.embeddings):
                dados_insercao.append({
                    "nome_documento": NOME_ARQUIVO,
                    "numero_pagina": lote_paginas[j],
                    "texto_chunk": lote_textos[j],
                    "vetor": embedding_obj.values
                })
            
            # Insere o lote inteiro no banco de dados
            supabase.table("documentos").insert(dados_insercao).execute()
            
            time.sleep(15)  # Pausa entre os lotes para não sobrecarregar a API do Gemini
            
        except Exception as e:
            print(f"Erro ao processar o lote {i}: {e}")

    print("Ingestão concluída com sucesso")

if __name__ == "__main__":
    processar_pdf()