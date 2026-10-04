import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Paperclip, X, BookOpen, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function App() {
  const [messages, setMessages] = useState(() => {
    const historicoSalvo = localStorage.getItem('@tutorSocratico:historico');
    if (historicoSalvo) {
      return JSON.parse(historicoSalvo);
    }
    return [
      { sender: 'tutor', text: 'Sou seu tutor em Projeto de Banco de Dados. Envie suas dúvidas.', isWelcome: true }
    ];
  });

  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // NOVO ESTADO: Controla a imagem que está ampliada em tela cheia
  const [zoomedImage, setZoomedImage] = useState(null);
  
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('@tutorSocratico:historico', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const limparHistorico = () => {
    localStorage.removeItem('@tutorSocratico:historico');
    setMessages([{ sender: 'tutor', text: 'Sou seu tutor em Projeto de Banco de Dados. Envie suas dúvidas.', isWelcome: true }]);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto'; 
    e.target.style.height = `${e.target.scrollHeight}px`; 
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      handleSend(e);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !image) return;

    const userMessage = {
      sender: 'user',
      text: input,
      image: imagePreview
    };

    const historicoParaEnvio = messages.map(msg => ({
      sender: msg.sender,
      text: msg.text,
      isWelcome: msg.isWelcome || msg.text.includes('Sou seu tutor')
    }));

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const currentInput = input;
    const currentImage = image;
    
    setInput('');
    removeImage();
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const formData = new FormData();
    formData.append('duvida', currentInput || 'Analise a imagem enviada.');
    formData.append('historico', JSON.stringify(historicoParaEnvio));

    if (currentImage) {
      formData.append('imagem', currentImage);
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

      const response = await axios.post(`${API_URL}/tutor/perguntar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessages((prev) => [
        ...prev,
        { sender: 'tutor', text: response.data.resposta_socratica, fontes: response.data.fontes_utilizadas }
      ]);

    } catch (error) {
      let mensagemErro = 'Erro ao conectar com o servidor do tutor.';
      setMessages((prev) => [...prev, { sender: 'tutor', text: mensagemErro }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans antialiased selection:bg-indigo-900/50 relative">
      
      {/* MODAL DE IMAGEM AMPLIADA (LIGHTBOX) */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setZoomedImage(null)} // Clicar fora fecha a imagem
        >
          <div className="relative max-w-5xl max-h-full flex items-center justify-center">
            {/* Botão flutuante de fechar */}
            <button 
              className="absolute -top-4 -right-4 md:-top-6 md:-right-6 p-2 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 hover:text-white transition-colors border border-slate-600 shadow-lg"
              onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
              title="Fechar visualização"
            >
              <X size={20} />
            </button>
            
            <img 
              src={zoomedImage} 
              alt="Imagem ampliada" 
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain border border-slate-700/50" 
              onClick={(e) => e.stopPropagation()} // Evita fechar se clicar direto na imagem
            />
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <header className="flex items-center justify-between px-8 py-4 bg-slate-950 border-b border-slate-800 shrink-0 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-serif font-bold text-sm shadow-sm">
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
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium">Conectado</span>
          </div>
          <button onClick={limparHistorico} title="Limpar histórico da aula" className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-950/30">
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
              <div key={index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1.5 px-1">
                  {isUser ? 'Sua Dúvida' : 'Tutor'}
                </span>

                <div className={`w-full max-w-2xl rounded-2xl p-6 transition-all ${
                    isUser
                      ? 'bg-slate-800 border border-slate-700 text-slate-100 shadow-md'
                      : 'bg-slate-900 border border-slate-800/80 shadow-md text-slate-300'
                  }`}
                >
                  {/* IMAGENS NO HISTÓRICO (Agora também ampliam ao clicar) */}
                  {msg.image && (
                    <div 
                      className="mb-5 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 flex justify-center cursor-zoom-in hover:opacity-90 transition-opacity group relative"
                      onClick={() => setZoomedImage(msg.image)}
                      title="Clique para ampliar"
                    >
                      <img src={msg.image} alt="Diagrama enviado" className="max-w-full max-h-72 object-contain rounded-lg shadow-sm" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"></div>
                    </div>
                  )}

                  <div className="text-[15px] leading-relaxed font-normal">
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-indigo-300" {...props} />,
                        em: ({node, ...props}) => <em className="italic text-slate-400" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {!isUser && msg.fontes && msg.fontes.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-start space-x-2 text-xs text-slate-400 bg-slate-950/50 -mx-6 -mb-6 p-4 rounded-b-2xl">
                      <BookOpen className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-slate-300">Fonte utilizada para basear a resposta:</span>{' '}
                        {msg.fontes.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex flex-col items-start animate-fade-in">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1.5 px-1">
                Tutor
              </span>
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-md flex items-center space-x-3 text-xs text-slate-400">
                <div className="flex space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="font-medium">Processando dúvida</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* ÁREA DE ENTRADA (COM PREVIEW MELHORADO) */}
      <footer className="p-6 bg-slate-950 border-t border-slate-800 shrink-0 relative">
        <div className="max-w-3xl mx-auto">
          
          {/* PREVIEW DA IMAGEM ANEXADA */}
          {imagePreview && (
            <div className="mb-3 inline-flex items-center gap-3 bg-slate-900 border border-slate-700 p-1.5 pr-3 rounded-lg text-xs text-slate-300 shadow-sm animate-fade-in max-w-full">
              
              {/* Miniatura clicável */}
              <button 
                type="button" 
                onClick={() => setZoomedImage(imagePreview)}
                className="relative shrink-0 group rounded-md overflow-hidden border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-zoom-in"
                title="Clique para ampliar"
              >
                <img src={imagePreview} alt="Miniatura" className="w-10 h-10 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              </button>
              
              {/* Nome do arquivo clicável (trunca se for muito grande) */}
              <span 
                className="font-medium truncate max-w-[180px] md:max-w-[350px] cursor-zoom-in hover:text-indigo-300 transition-colors" 
                onClick={() => setZoomedImage(imagePreview)}
                title={image?.name}
              >
                {image ? image.name : 'Imagem anexada'}
              </span>
              
              {/* Botão de remover (separado) */}
              <button 
                type="button"
                onClick={removeImage} 
                className="text-slate-500 hover:text-red-400 transition p-1.5 rounded-md hover:bg-slate-800 ml-1 shrink-0"
                title="Remover imagem"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="relative flex items-end shadow-lg rounded-xl bg-slate-900 border border-slate-800 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-700/50 transition-all">
            
            <label title="Anexar diagrama ou cálculo" className="p-4 text-slate-500 hover:text-slate-300 cursor-pointer rounded-l-xl hover:bg-slate-800/50 transition-colors h-14 flex items-center">
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
              placeholder={imagePreview ? "Descreva a sua dúvida sobre esta imagem..." : "Digite sua dúvida..."}
              className="w-full py-4 bg-transparent border-none focus:ring-0 resize-none outline-none text-[15px] placeholder-slate-500 text-slate-200 max-h-48 overflow-y-auto"
              style={{ minHeight: '56px' }}
            />

            <button
              type="submit"
              disabled={loading || (!input.trim() && !image)}
              className="p-4 text-indigo-500 hover:text-indigo-400 disabled:text-slate-600 transition-colors h-14 flex items-center"
            >
              <Send size={20} />
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-500 mt-4 font-medium">
            Pressione <strong>Enter</strong> para enviar e <strong>Shift + Enter</strong> para pular linha.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;