import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BookOpen, Paperclip, Send, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CHAVE_HISTORICO = '@tutorSocratico:historico';
const BOAS_VINDAS = {
  sender: 'tutor',
  text: 'Sou seu tutor em Projeto de Banco de Dados. Envie suas dúvidas.',
  isWelcome: true,
};

function carregarMensagens() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_HISTORICO));
    if (Array.isArray(salvo)) return salvo;
  } catch (erro) {
    console.error('Erro ao recuperar a conversa:', erro);
  }

  return [{ ...BOAS_VINDAS }];
}

// Algumas respostas chegam com as células de uma tabela na mesma linha.
function normalizarMarkdown(texto) {
  if (typeof texto !== 'string') return '';

  const linhas = texto
    .replace(/\r\n?/g, '\n')
    .replace(/&nbsp;|&#x20;|&#32;/gi, ' ')
    .replace(/\\\|/g, '|')
    .split('\n');

  const resultado = [];
  for (const linha of linhas) {
    if (!linha.trim().startsWith('|')) {
      resultado.push(linha);
      continue;
    }

    const celulas = linha.trim().replace(/^\|/, '').replace(/\|$/, '')
      .split('|').map((celula) => celula.trim());

    let colunas = 0;
    for (let n = 2; n <= 8; n++) {
      const separadores = celulas.slice(n, n * 2);
      if (celulas.length >= n * 2 &&
          separadores.every((celula) => /^:?-{3,}:?$/.test(celula))) {
        colunas = n;
        break;
      }
    }

    if (!colunas || (celulas.length - 2 * colunas) % colunas !== 0) {
      resultado.push(linha);
      continue;
    }

    resultado.push('');
    for (let i = 0; i < celulas.length; i += colunas) {
      resultado.push(`| ${celulas.slice(i, i + colunas).join(' | ')} |`);
    }
    resultado.push('');
  }

  return resultado.join('\n');
}

const componentesMarkdown = {
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
    <h1 className="text-xl font-semibold text-slate-100 mt-6 mb-3 first:mt-0" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-lg font-semibold text-slate-100 mt-5 mb-3 first:mt-0" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-base font-semibold text-slate-100 mt-4 mb-2 first:mt-0" {...props} />
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
    <blockquote className="border-l-2 border-cyan-700 pl-4 my-4 text-slate-400 italic" {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr className="border-neutral-700 my-5" {...props} />
  ),
  code: ({ node, className, children, ...props }) => {
    const codigo = String(children).replace(/\n$/, '');
    if (className || codigo.includes('\n')) {
      return (
        <code className={`font-mono text-sm text-cyan-200 ${className || ''}`} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code className="bg-neutral-800 text-cyan-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono break-words" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ node, ...props }) => (
    <pre className="bg-neutral-950 border border-neutral-700 rounded-lg p-4 my-4 overflow-x-auto text-sm" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="w-full overflow-x-auto my-5 rounded-xl border border-neutral-700">
      <table className="w-full min-w-[520px] border-collapse text-sm text-left" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-neutral-800 text-slate-100" {...props} />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="bg-neutral-900 divide-y divide-neutral-800" {...props} />
  ),
  tr: ({ node, ...props }) => (
    <tr className="hover:bg-neutral-800/50 transition-colors" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-4 py-3 font-semibold text-cyan-300 border-b border-neutral-700 align-top whitespace-normal" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-4 py-3 text-slate-300 align-top leading-relaxed" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition-colors"
      target="_blank" rel="noopener noreferrer" {...props} />
  ),
};

function Mensagem({ mensagem, onAbrirImagem }) {
  const doAluno = mensagem.sender === 'user';

  return (
    <div className={`flex flex-col ${doAluno ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1.5 px-1">
        {doAluno ? 'Sua Dúvida' : 'Tutor'}
      </span>

      <div className={`w-full max-w-2xl rounded-2xl p-6 transition-all ${
        doAluno
          ? 'bg-neutral-800 border border-neutral-700 text-slate-100 shadow-md'
          : 'bg-neutral-900 border border-neutral-800/80 shadow-md text-slate-300'
      }`}>
        {mensagem.image && (
          <div className="mb-5 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 flex justify-center cursor-zoom-in hover:opacity-90 transition-opacity group relative"
            onClick={() => onAbrirImagem(mensagem.image)} title="Clique para ampliar">
            <img src={mensagem.image} alt="Diagrama enviado"
              className="max-w-full max-h-72 object-contain rounded-lg shadow-sm" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>
        )}

        <div className="text-[15px] leading-relaxed font-normal break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentesMarkdown}>
            {normalizarMarkdown(mensagem.text)}
          </ReactMarkdown>
        </div>

        {!doAluno && mensagem.fontes?.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-800 flex items-start space-x-2 text-xs text-slate-400 bg-neutral-950/50 -mx-6 -mb-6 p-4 rounded-b-2xl">
            <BookOpen className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-300">
                Fonte utilizada para basear a resposta:
              </span>{' '}
              {mensagem.fontes.join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VisualizadorImagem({ imagem, onFechar }) {
  if (!imagem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onFechar}>
      <div className="relative max-w-5xl max-h-full flex items-center justify-center">
        <button type="button" title="Fechar visualização"
          className="absolute -top-4 -right-4 md:-top-6 md:-right-6 p-2 bg-neutral-800 text-slate-300 rounded-full hover:bg-neutral-700 hover:text-white transition-colors border border-neutral-600 shadow-lg"
          onClick={(evento) => { evento.stopPropagation(); onFechar(); }}>
          <X size={20} />
        </button>
        <img src={imagem} alt="Imagem ampliada"
          className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain border border-neutral-700/50"
          onClick={(evento) => evento.stopPropagation()} />
      </div>
    </div>
  );
}

function App() {
  const [mensagens, setMensagens] = useState(carregarMensagens);
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState(null);
  const [preview, setPreview] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [servidor, setServidor] = useState('checking');
  const [imagemAmpliada, setImagemAmpliada] = useState(null);

  const inputArquivoRef = useRef(null);
  const fimConversaRef = useRef(null);
  const campoTextoRef = useRef(null);

  useEffect(() => {
    try {
      const paraSalvar = mensagens.map((mensagem) => ({
        ...mensagem,
        image: mensagem.image?.startsWith('blob:') ? null : mensagem.image,
      }));
      localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(paraSalvar));
    } catch (erro) {
      console.error('Erro ao salvar a conversa:', erro);
    }

    fimConversaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  useEffect(() => {
    let ativo = true;

    async function verificarServidor() {
      try {
        const resposta = await axios.get(`${API_URL}/`, { timeout: 5000 });
        if (ativo) setServidor(resposta.data?.status === 'ok' ? 'online' : 'offline');
      } catch {
        if (ativo) setServidor('offline');
      }
    }

    verificarServidor();
    const intervalo = setInterval(verificarServidor, 30000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, []);

  function limparHistorico() {
    localStorage.removeItem(CHAVE_HISTORICO);
    setMensagens([{ ...BOAS_VINDAS }]);
  }

  function selecionarImagem(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setImagem(arquivo);
    setPreview(URL.createObjectURL(arquivo));
  }

  function removerImagem() {
    setImagem(null);
    setPreview(null);
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
  }

  function alterarTexto(evento) {
    setTexto(evento.target.value);
    evento.target.style.height = 'auto';
    evento.target.style.height = `${Math.min(evento.target.scrollHeight, 192)}px`;
  }

  function pressionarTecla(evento) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviarMensagem(evento);
    }
  }

  async function enviarMensagem(evento) {
    evento.preventDefault();
    if (carregando || (!texto.trim() && !imagem)) return;

    const pergunta = texto;
    const arquivo = imagem;
    const historico = mensagens.map((mensagem) => ({
      sender: mensagem.sender,
      text: mensagem.text,
      isWelcome: mensagem.isWelcome || false,
    }));

    setMensagens((atual) => [...atual, {
      sender: 'user', text: pergunta, image: preview,
    }]);
    setCarregando(true);
    setTexto('');
    removerImagem();
    if (campoTextoRef.current) campoTextoRef.current.style.height = 'auto';

    const dados = new FormData();
    dados.append('duvida', pergunta || 'Analise a imagem enviada.');
    dados.append('historico', JSON.stringify(historico));
    if (arquivo) dados.append('imagem', arquivo);

    try {
      const resposta = await axios.post(`${API_URL}/tutor/perguntar`, dados);
      setMensagens((atual) => [...atual, {
        sender: 'tutor',
        text: resposta.data.resposta_socratica || '',
        fontes: resposta.data.fontes_utilizadas || [],
      }]);
    } catch (erro) {
      console.error('Erro ao consultar o tutor:', erro);
      setMensagens((atual) => [...atual, {
        sender: 'tutor',
        text: 'Não foi possível processar sua dúvida. Verifique a conexão com o servidor e tente novamente.',
      }]);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-slate-200 font-sans antialiased selection:bg-cyan-900/40 relative">
      <VisualizadorImagem imagem={imagemAmpliada} onFechar={() => setImagemAmpliada(null)} />

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
        <div className="flex items-center gap-3">
          <span title={servidor === 'checking' ? 'Verificando servidor' : `Servidor ${servidor}`}
            className={`w-2 h-2 rounded-full ${
              servidor === 'online' ? 'bg-emerald-500' :
              servidor === 'offline' ? 'bg-red-500' : 'bg-neutral-600'
            }`} />
          <button type="button" onClick={limparHistorico} title="Limpar histórico da aula"
            className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-950/30">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-0">
        <div className="max-w-3xl mx-auto space-y-8">
          {mensagens.map((mensagem, indice) => (
            <Mensagem key={indice} mensagem={mensagem} onAbrirImagem={setImagemAmpliada} />
          ))}

          {carregando && (
            <div className="flex flex-col items-start animate-fade-in">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1.5 px-1">
                Tutor
              </span>
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 shadow-md flex items-center space-x-3 text-xs text-slate-400">
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }} />
                </div>
                <span className="font-medium">Processando dúvida</span>
              </div>
            </div>
          )}
          <div ref={fimConversaRef} />
        </div>
      </main>

      <footer className="p-6 bg-neutral-950 border-t border-neutral-800 shrink-0 relative">
        <div className="max-w-3xl mx-auto">
          {preview && (
            <div className="mb-3 inline-flex items-center gap-3 bg-neutral-900 border border-neutral-700 p-1.5 pr-3 rounded-lg text-xs text-slate-300 shadow-sm animate-fade-in max-w-full">
              <button type="button" onClick={() => setImagemAmpliada(preview)}
                className="relative shrink-0 group rounded-md overflow-hidden border border-neutral-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-zoom-in"
                title="Clique para ampliar">
                <img src={preview} alt="Miniatura"
                  className="w-10 h-10 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              </button>
              <span className="font-medium truncate max-w-[180px] md:max-w-[350px] cursor-zoom-in hover:text-cyan-300 transition-colors"
                onClick={() => setImagemAmpliada(preview)} title={imagem?.name}>
                {imagem?.name || 'Imagem anexada'}
              </span>
              <button type="button" onClick={removerImagem} title="Remover imagem"
                className="text-slate-500 hover:text-red-400 transition p-1.5 rounded-md hover:bg-neutral-800 ml-1 shrink-0">
                <X size={16} />
              </button>
            </div>
          )}

          <form onSubmit={enviarMensagem}
            className="relative flex items-end shadow-lg rounded-xl bg-neutral-900 border border-neutral-800 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-700/50 transition-all">
            <label title="Anexar diagrama ou cálculo"
              className="p-4 text-slate-500 hover:text-slate-300 cursor-pointer rounded-l-xl hover:bg-neutral-800/50 transition-colors h-14 flex items-center">
              <Paperclip size={20} />
              <input type="file" accept="image/*" onChange={selecionarImagem}
                className="hidden" ref={inputArquivoRef} />
            </label>

            <textarea ref={campoTextoRef} value={texto} rows={1}
              onChange={alterarTexto} onKeyDown={pressionarTecla}
              placeholder={preview ? 'Descreva a sua dúvida sobre esta imagem...' : 'Digite sua dúvida...'}
              className="w-full py-4 bg-transparent border-none focus:ring-0 resize-none outline-none text-[15px] placeholder-slate-500 text-slate-200 max-h-48 overflow-y-auto"
              style={{ minHeight: '56px' }} />

            <button type="submit" disabled={carregando || (!texto.trim() && !imagem)}
              className="p-4 text-cyan-500 hover:text-cyan-400 disabled:text-slate-600 transition-colors h-14 flex items-center"
              title="Enviar mensagem">
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
