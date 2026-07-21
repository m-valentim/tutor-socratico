from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from google import genai
from google.genai import types
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Tutor Socrático - Projeto de Banco de Dados")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
ai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@app.get("/")
def home():
    return {"status": "API do Tutor Socrático está online!"}

@app.post("/tutor/perguntar")
async def perguntar_tutor(
    duvida: str = Form(...), 
    historico: str = Form(default="[]"), 
    imagem: UploadFile = File(None)
):
    try:
        duvida_limpa = duvida.strip()

        # Se enviou imagem, mas o texto está vazio ou é apenas a mensagem padrão do front-end:
        if imagem and (not duvida_limpa or duvida_limpa.lower() == "analise a imagem enviada."):
            return {
                "resposta_socratica": "Por favor, insira um texto junto com a imagem explicando qual é a sua dúvida, o que você tentou fazer ou o que deseja que analisemos no diagrama. Preciso entender seu raciocínio para guiar nossa resolução!",
                "fontes_utilizadas": ["Orientação do Sistema"]
            }

        # Converte o histórico recebido do Frontend (JSON string -> Lista Python)
        historico_mensagens = json.loads(historico)

        # Embedding da dúvida atual para busca vetorial no Supabase
        resposta_embedding = ai_client.models.embed_content(
            model="gemini-embedding-001",
            contents=duvida_limpa,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        vetor_duvida = resposta_embedding.embeddings[0].values

        # Busca Vetorial (RAG) no banco de dados
        busca_bd = supabase.rpc(
            "match_documentos",
            {
                "query_embedding": vetor_duvida,
                "match_threshold": 0.30,
                "match_count": 3  # Aumentado para 3 para capturar melhor contexto
            }
        ).execute()

        # Trata o caso de não haver resultados (evitando tipo None)
        trechos_recuperados = busca_bd.data if busca_bd.data else []
        contexto_professor = ""
        fontes = []
        for item in trechos_recuperados:
            contexto_professor += f"\n--- Trecho ---\n{item['texto_chunk']}\n"
            fonte_str = f"pág. {item['numero_pagina']} de {item['nome_documento']}"
            if fonte_str not in fontes:
                fontes.append(fonte_str)

        # Se o banco não achar textos, definimos um contexto padrão para não quebrar a regra socrática
        if not fontes:
            fontes = ["Conceitos fundamentais da disciplina"]
            contexto_professor = "Nenhum trecho específico do material base foi recuperado. Utilize o conhecimento geral e estrito de modelagem de dados para aplicar as regras socráticas."

        # Engenharia de Prompt (Unificada para aplicar as diretrizes sempre)
        prompt_sistema = f"""
        Você é um Tutor Acadêmico de Projeto de Banco de Dados, especialista na metodologia e obra do professor Carlos Alberto Heuser. 

        REGRA DE ESCOPO (MUITO IMPORTANTE):
        Se a dúvida do aluno NÃO tiver NENHUMA relação com Banco de Dados, Modelagem de Dados, Normalização ou SQL (exemplo: perguntas sobre história do Brasil, matemática, culinária, etc.), IGNORE TODAS AS OUTRAS REGRAS e responda ESTRITAMENTE com a seguinte frase:
        "Não tenho capacidade de responder essa pergunta pois está fora do escopo da matéria."

        Sua função é guiar o aluno até a resolução correta utilizando um Método Socrático estrito e o conceito de Adaptive Scaffolding.

        DIRETRIZES DE ESTILO E PROFUNDIDADE:
        - ZERO PROLIXIDADE SOCIAL: Elimine saudações ("Olá"), elogios e encerramentos genéricos.
        - TEXTO NATURAL: NUNCA utilize rótulos como "[Diagnóstico]", "[Dica]" ou "[Pergunta Socrática]" no texto final. Escreva de forma fluida e natural.
        - PROFUNDIDADE TÉCNICA: Explique a regra de modelagem violada ou aplicada com máxima precisão técnica, usando os termos corretos de banco de dados.
        - INTERVENÇÃO SOCRÁTICA CURTA: A sua Pergunta Socrática final deve ser curta, objetiva e estimular o próximo passo lógico na modelagem.

        REGRAS DE OPERAÇÃO SOCRÁTICA:
        1. PROIBIÇÃO DE RESPOSTA DIRETA: NUNCA forneça o esquema final resolvido, a tabela normalizada ou o código SQL pronto.
        2. INDICAÇÃO DE MATERIAL: Sempre que o aluno errar, direcione-o para a regra teórica.
        3. ANÁLISE DE IMAGENS E DIAGRAMAS: Ao analisar diagramas, aponte exatamente onde está a falha (ex: cardinalidade errada) e proponha qual correção deve ser pensada, mas NÃO dê a solução final.
        4. DICAS PROGRESSIVAS: Forneça dicas que reduzam a complexidade do problema se o aluno estiver travado.

        MATERIAL DIDÁTICO DE APOIO (GROUNDING EXCLUSIVO):
        <MATERIAL_DIDATICO>
        {contexto_professor}
        </MATERIAL_DIDATICO>

        Ao final da sua resposta, pule uma linha e adicione estritamente esta frase (substituindo as variáveis):
        "Para corrigir ou aprofundar seu conhecimento, estude: {', '.join(fontes)}."
        """

        # MMemória de Contexto
        conteudos_gemini = []
        
        for msg in historico_mensagens:
            # Ignora mensagens de boas-vindas ou de erro do sistema para não poluir o contexto da IA
            if msg.get("isWelcome") or "Por favor, insira um texto" in msg.get("text", ""): 
                continue 
            
            role = "user" if msg["sender"] == "user" else "model"
            conteudos_gemini.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg["text"])])
            )

        # Adiciona a mensagem ATUAL do aluno (com imagem do diagrama, se houver)
        partes_atuais = [types.Part.from_text(text=f"Dúvida do Aluno: {duvida_limpa}")]
        if imagem:
            bytes_imagem = await imagem.read()
            partes_atuais.append(
                types.Part.from_bytes(data=bytes_imagem, mime_type=imagem.content_type)
            )
        conteudos_gemini.append(types.Content(role="user", parts=partes_atuais))

        # Executa a geração com o modelo Gemini
        resposta_tutor = ai_client.models.generate_content(
            model="gemini-flash-latest", # Modelo ajustado para a versão mais estável no seguimento de regras
            contents=conteudos_gemini,
            config=types.GenerateContentConfig(
                system_instruction=prompt_sistema,
                temperature=0.3  # Temperatura baixa para maior fidelidade técnica às regras de Heuser
            )
        )

        return {
            "resposta_socratica": resposta_tutor.text,
            "fontes_utilizadas": fontes
        }

    except Exception as e:
        print(f"\nERRO: {str(e)}\n")
        
        raise HTTPException(status_code=500, detail=f"Erro interno no processamento: {str(e)}")