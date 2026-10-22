
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Paperclip, X, BookOpen, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function App() {
  const [messages, setMessages] = useState(() => {
    try {
      const historicoSalvo = localStorage.getItem('@tutorSocratico:historico');
      if (historicoSalvo) {
        const historico = JSON.parse(historicoSalvo);
        if (Array.isArray(historico)) return historico;
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }

    return [
      {
        sender: 'tutor',
        text: 'Sou seu tutor em Projeto de Banco de Dados. Envie suas dúvidas.',
        isWelcome: true
      }
    ];
  });

  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [zoomedImage, setZoomedImage] = useState(null);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    try {
      const historicoPersistente = messages.map((msg) => ({
        ...msg,
        image: msg.image?.startsWith('blob:') ? null : msg.image
      }));

      localStorage.setItem(
        '@tutorSocratico:historico',
        JSON.stringify(historicoPersistente)
      );
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }

    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    let ativo = true;

    const verificarServidor = async () => {
      try {
        const resposta = await axios.get(`${API_URL}/`, {
          timeout: 5000
        });

        if (ativo) {
          setServerStatus(
            resposta.data?.status === 'ok' ? 'online' : 'offline'
          );
        }
      } catch {
        if (ativo) setServerStatus('offline');
      }
    };

    verificarServidor();

    const intervalo = setInterval(verificarServidor, 30000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [API_URL]);

  const limparHistorico = () => {
    localStorage.removeItem('@tutorSocratico:historico');

    setMessages([
      {
        sender: 'tutor',
        text: 'Sou seu tutor em Projeto de Banco de Dados. Envie suas dúvidas.',
        isWelcome: true
      }
    ]);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);

      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);

    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 192)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (loading || (!input.trim() && !image)) return;

    const currentInput = input;
    const currentImage = image;
    const currentImagePreview = imagePreview;

    const userMessage = {
      sender: 'user',
      text: currentInput,
      image: currentImagePreview
    };

    const historicoParaEnvio = messages.map((msg) => ({
      sender: msg.sender,
      text: msg.text,
      isWelcome: msg.isWelcome || false
    }));

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setInput('');
    removeImage();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const formData = new FormData();

    formData.append(
      'duvida',
      currentInput || 'Analise a imagem enviada.'
    );

    formData.append(
      'historico',
      JSON.stringify(historicoParaEnvio)
    );

    if (currentImage) {
      formData.append('imagem', currentImage);
    }

    try {
      const response = await axios.post(
        `${API_URL}/tutor/perguntar`,
        formData
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: response.data.resposta_socratica || '',
          fontes: response.data.fontes_utilizadas || []
        }
      ]);
    } catch (error) {
      console.error('Erro ao consultar tutor:', error);

      setMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: 'Não foi possível processar sua dúvida. Verifique a conexão com o servidor e tente novamente.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Normalização de Markdown:
   *
   * O Gemini pode retornar tabelas Markdown em uma única linha,
   * especialmente quando há conversão de quebras de linha.
   *
   * Esta função identifica tabelas com linha separadora GFM,
   * mesmo quando chegam compactadas, e insere as quebras
   * necessárias para que sejam renderizadas corretamente.
   *
   * O remark-gfm é responsável pela renderização visual
   * das tabelas Markdown.
   */
  const normalizarMarkdown = (texto) => {
    if (typeof texto !== 'string') return '';

    let resultado = texto
      .replace(/\r\n?/g, '\n')
      .replace(/&nbsp;|&#x20;|&#32;/gi, ' ')
      .replace(/\\\|/g, '|');

    const linhas = resultado.split('\n');
    const novasLinhas = [];

    const ehSeparadorGfm = (celulas) =>
      celulas.length >= 2 &&
      celulas.every((celula) => /^:?-{3,}:?$/.test(celula.trim()));

    const dividirCelulas = (linha) => {
      const textoLimpo = linha.trim().replace(/^\|/, '').replace(/\|$/, '');

      return textoLimpo.split('|').map((celula) => celula.trim());
    };

    const processarLinha = (linha) => {
      const textoLinha = linha.trim();

      if (!textoLinha.startsWith('|')) {
        novasLinhas.push(linha);
        return;
      }

      // Se a linha já é uma linha Markdown normal,
      // permanece inalterada.
      const celulas = dividirCelulas(textoLinha);

      // Detecta o padrão de uma tabela compactada:
      // cabeçalho | separador | conteúdo...
      let indiceSeparador = -1;
      let quantidadeColunas = 0;

      for (let tamanho = 2; tamanho <= 8; tamanho++) {
        if (
          celulas.length >= tamanho * 2 &&
          ehSeparadorGfm(celulas.slice(tamanho, tamanho * 2))
        ) {
          indiceSeparador = tamanho;
          quantidadeColunas = tamanho;
          break;
        }
      }

      if (indiceSeparador === -1) {
        novasLinhas.push(linha);
        return;
      }

      const restantes = celulas.slice(indiceSeparador + quantidadeColunas);

      // Só converte quando as células formam linhas completas.
      if (restantes.length % quantidadeColunas !== 0) {
        novasLinhas.push(linha);
        return;
      }

      novasLinhas.push('');
      novasLinhas.push(
        '| ' + celulas.slice(0, quantidadeColunas).join(' | ') + ' |'
      );

      novasLinhas.push(
        '| ' +
        celulas
          .slice(indiceSeparador, indiceSeparador + quantidadeColunas)
          .join(' | ') +
        ' |'
      );

      for (let i = 0; i < restantes.length; i += quantidadeColunas) {
        novasLinhas.push(
          '| ' +
          restantes.slice(i, i + quantidadeColunas).join(' | ') +
          ' |'
        );
      }

      novasLinhas.push('');
    };

    for (const linha of linhas) {
      processarLinha(linha);
    }

    return novasLinhas.join('\n');
  };

  const markdownComponents = {
    p: ({ node, ...props }) => (
      <p className="mb-4 last:mb-0 leading-relaxed" {...props} />
    ),

    strong: ({ node, ...props }) => (
      <strong className="font-semibold text-cyan-300" {...props} />
    ),

    em: ({ node, ...props }) => (
      <em className="italic text-slate-400" {...props} />
    ),

    h1: ({ node, ...props }) => (
      <h1
        className="text-xl font-semibold text-slate-100 mt-6 mb-3 first:mt-0"
        {...props}
      />
    ),

    h2: ({ node, ...props }) => (
      <h2
        className="text-lg font-semibold text-slate-100 mt-5 mb-3 first:mt-0"
        {...props}
      />
    ),

    h3: ({ node, ...props }) => (
      <h3
        className="text-base font-semibold text-slate-100 mt-4 mb-2 first:mt-0"
        {...props}
      />
    ),

    ul: ({ node, ...props }) => (
      <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />
    ),

    ol: ({ node, ...props }) => (
      <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />
    ),

    li: ({ node, ...props }) => (
      <li className="pl-1 leading-relaxed" {...props} />
    ),

    blockquote: ({ node, ...props }) => (
      <blockquote
        className="border-l-2 border-cyan-700 pl-4 my-4 text-slate-400 italic"
        {...props}
      />
    ),

    hr: ({ node, ...props }) => (
      <hr className="border-neutral-700 my-5" {...props} />
    ),

    code: ({ node, className, children, ...props }) => {
      const codigo = String(children).replace(/\n$/, '');
      const isBlock =
        Boolean(className) ||
        codigo.includes('\n');

      if (isBlock) {
        return (
          <code
            className={`font-mono text-sm text-cyan-200 ${className || ''}`}
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <code
          className="bg-neutral-800 text-cyan-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono break-words"
          {...props}
        >
          {children}
        </code>
      );
    },

    pre: ({ node, ...props }) => (
      <pre
        className="bg-neutral-950 border border-neutral-700 rounded-lg p-4 my-4 overflow-x-auto text-sm"
        {...props}
      />
    ),

    // Renderização de tabelas Markdown com suporte a GFM.
    table: ({ node, ...props }) => (
      <div className="w-full overflow-x-auto my-5 rounded-xl border border-neutral-700">
        <table
          className="w-full min-w-[520px] border-collapse text-sm text-left"
          {...props}
        />
      </div>
    ),

    thead: ({ node, ...props }) => (
      <thead
        className="bg-neutral-800 text-slate-100"
        {...props}
      />
    ),

    tbody: ({ node, ...props }) => (
      <tbody
        className="bg-neutral-900 divide-y divide-neutral-800"
        {...props}
      />
    ),

    tr: ({ node, ...props }) => (
      <tr
        className="hover:bg-neutral-800/50 transition-colors"
        {...props}
      />
    ),

    th: ({ node, ...props }) => (
      <th
        className="px-4 py-3 font-semibold text-cyan-300 border-b border-neutral-700 align-top whitespace-normal"
        {...props}
      />
    ),

    td: ({ node, ...props }) => (
      <td
        className="px-4 py-3 text-slate-300 align-top leading-relaxed"
        {...props}
      />
    ),

    a: ({ node, ...props }) => (
      <a
        className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    )
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-slate-200 font-sans antialiased selection:bg-cyan-900/40 relative">

      {/* MODAL DE IMAGEM AMPLIADA */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-5xl max-h-full flex items-center justify-center">
            <button
              className="absolute -top-4 -right-4 md:-top-6 md:-right-6 p-2 bg-neutral-800 text-slate-300 rounded-full hover:bg-neutral-700 hover:text-white transition-colors border border-neutral-600 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImage(null);
              }}
              title="Fechar visualização"
            >
              <X size={20} />
            </button>

            <img
              src={zoomedImage}
              alt="Imagem ampliada"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain border border-neutral-700/50"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <header className="flex items-center justify-between px-8 py-4 bg-neutral-950 border-b border-neutral-800 shrink-0 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-serif font-bold text-sm shadow-sm">
            H
          </div>

          <div>
            <h1 className="text-sm font-semibold text-slate-200 tracking-tight leading-none mb-1">
              Tutor Socrático
            </h1>
            <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">
              Método Carlos A. Heuser
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={limparHistorico}
            title="Limpar histórico da aula"
            className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-950/30"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* ÁREA DE CONVERSA */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-0">
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={index}
                className={`flex flex-col ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1.5 px-1">
                  {isUser ? 'Sua Dúvida' : 'Tutor'}
                </span>

                <div
                  className={`w-full max-w-2xl rounded-2xl p-6 transition-all ${
                    isUser
                      ? 'bg-neutral-800 border border-neutral-700 text-slate-100 shadow-md'
                      : 'bg-neutral-900 border border-neutral-800/80 shadow-md text-slate-300'
                  }`}
                >
                  {/* IMAGENS NO HISTÓRICO */}
                  {msg.image && (
                    <div
                      className="mb-5 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 flex justify-center cursor-zoom-in hover:opacity-90 transition-opacity group relative"
                      onClick={() => setZoomedImage(msg.image)}
                      title="Clique para ampliar"
                    >
                      <img
                        src={msg.image}
                        alt="Diagrama enviado"
                        className="max-w-full max-h-72 object-contain rounded-lg shadow-sm"
                      />

                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"></div>
                    </div>
                  )}

                  {/* MARKDOWN FORMATADO */}
                  <div className="text-[15px] leading-relaxed font-normal break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {normalizarMarkdown(msg.text)}
                    </ReactMarkdown>
                  </div>

                  {/* FONTES UTILIZADAS */}
                  {!isUser && msg.fontes && msg.fontes.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-neutral-800 flex items-start space-x-2 text-xs text-slate-400 bg-neutral-950/50 -mx-6 -mb-6 p-4 rounded-b-2xl">
                      <BookOpen className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />

                      <div className="leading-relaxed">
                        <span className="font-semibold text-slate-300">
                          Fonte utilizada para basear a resposta:
                        </span>{' '}
                        {msg.fontes.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* INDICADOR DE CARREGAMENTO */}
          {loading && (
            <div className="flex flex-col items-start animate-fade-in">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1.5 px-1">
                Tutor
              </span>

              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 shadow-md flex items-center space-x-3 text-xs text-slate-400">
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>

                <span className="font-medium">Processando dúvida</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* ÁREA DE ENTRADA */}
      <footer className="p-6 bg-neutral-950 border-t border-neutral-800 shrink-0 relative">
        <div className="max-w-3xl mx-auto">

          {/* PREVIEW DA IMAGEM ANEXADA */}
          {imagePreview && (
            <div className="mb-3 inline-flex items-center gap-3 bg-neutral-900 border border-neutral-700 p-1.5 pr-3 rounded-lg text-xs text-slate-300 shadow-sm animate-fade-in max-w-full">
              <button
                type="button"
                onClick={() => setZoomedImage(imagePreview)}
                className="relative shrink-0 group rounded-md overflow-hidden border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-zoom-in"
                title="Clique para ampliar"
              >
                <img
                  src={imagePreview}
                  alt="Miniatura"
                  className="w-10 h-10 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
              </button>

              <span
                className="font-medium truncate max-w-[180px] md:max-w-[350px] cursor-zoom-in hover:text-cyan-300 transition-colors"
                onClick={() => setZoomedImage(imagePreview)}
                title={image?.name}
              >
                {image ? image.name : 'Imagem anexada'}
              </span>

              <button
                type="button"
                onClick={removeImage}
                className="text-slate-500 hover:text-red-400 transition p-1.5 rounded-md hover:bg-neutral-800 ml-1 shrink-0"
                title="Remover imagem"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form
            onSubmit={handleSend}
            className="relative flex items-end shadow-lg rounded-xl bg-neutral-900 border border-neutral-800 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-700/50 transition-all"
          >
            <label
              title="Anexar diagrama ou cálculo"
              className="p-4 text-slate-500 hover:text-slate-300 cursor-pointer rounded-l-xl hover:bg-neutral-800/50 transition-colors h-14 flex items-center"
            >
              <Paperclip size={20} />

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                ref={fileInputRef}
              />
            </label>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                imagePreview
                  ? 'Descreva a sua dúvida sobre esta imagem...'
                  : 'Digite sua dúvida...'
              }
              className="w-full py-4 bg-transparent border-none focus:ring-0 resize-none outline-none text-[15px] placeholder-slate-500 text-slate-200 max-h-48 overflow-y-auto"
              style={{ minHeight: '56px' }}
            />

            <button
              type="submit"
              disabled={loading || (!input.trim() && !image)}
              className="p-4 text-cyan-500 hover:text-cyan-400 disabled:text-slate-600 transition-colors h-14 flex items-center"
              title="Enviar mensagem"
            >
              <Send size={20} />
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-500 mt-4 font-medium">
            Pressione <strong>Enter</strong> para enviar e{' '}
            <strong>Shift + Enter</strong> para pular linha.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
