import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Upload, X, Bot, User, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

function App() {
  // Inicializa as mensagens lendo o localStorage ou usando a padrão
  const [messages, setMessages] = useState(() => {
    const historicoSalvo = localStorage.getItem('@tutorSocratico:historico');
    if (historicoSalvo) {
      return JSON.parse(historicoSalvo);
    }
    return [
      { sender: 'tutor', text: 'Olá! Sou seu tutor de Banco de Dados. Envie sua dúvida.', isWelcome: true }
    ];
  });

  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Salva no localStorage sempre que o array de mensagens mudar
  useEffect(() => {
    localStorage.setItem('@tutorSocratico:historico', JSON.stringify(messages));
  }, [messages]);

  // Função para limpar a conversa da tela e da memória
  const limparHistorico = () => {
    localStorage.removeItem('@tutorSocratico:historico');
    setMessages([{ sender: 'tutor', text: 'Olá, sou seu tutor de Banco de Dados. Envie sua dúvida.', isWelcome: true }]);
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !image) return;

    const userMessage = {
      sender: 'user',
      text: input,
      image: imagePreview
    };

    // Prepara o histórico antes de adicionar a mensagem atual, extraindo apenas o texto
    const historicoParaEnvio = messages.map(msg => ({
      sender: msg.sender,
      text: msg.text,
      isWelcome: msg.isWelcome || msg.text.includes('Olá! Sou seu tutor') || msg.text.includes('Histórico limpo')
    }));

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const currentInput = input;
    const currentImage = image;
    setInput('');
    removeImage();

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
      let mensagemErro = 'Erro ao conectar com o servidor do tutor. Certifique-se de que o backend está online.';

      // Verifica se o servidor do backend conseguiu responder e se enviou um status de erro
      if (error.response) {
        const status = error.response.status;

        if (status === 503 || status === 429) {
          mensagemErro = 'O servidor da IA está muito ocupado no momento. Por favor, aguarde alguns segundos e tente enviar novamente.';
        } else if (status === 500) {
          mensagemErro = 'Ocorreu um erro interno ao processar sua dúvida. Tente novamente ou reformule a pergunta.';
        }
      }

      setMessages((prev) => [
        ...prev,
        { sender: 'tutor', text: mensagemErro }
      ]);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">

      {/*LADO ESQUERDO: UPLOAD DE IMAGENS*/}
      <div className="w-1/3 border-r border-gray-800 bg-gray-950 p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-indigo-400">
            <FileText size={22} /> Imagens
          </h2>
          <p className="text-sm text-gray-400 mb-6">Suba aqui prints ou fotos de seus diagramas, tabelas ou cálculos.</p>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current.click()}
              className="border-2 border-dashed border-gray-800 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition bg-gray-900/50"
            >
              <Upload size={32} className="text-gray-500" />
              <span className="text-sm text-gray-400 font-medium">Clique para selecionar imagem</span>
            </div>
          ) : (
            <div className="relative border border-gray-800 rounded-xl overflow-hidden bg-gray-900">
              <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-96 object-contain" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-1.5 rounded-full text-white transition shadow-lg"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/*LADO DIREITO: CHAT*/}
      <div className="w-2/3 flex flex-col h-full bg-gray-900">

        {/*Header*/}
        <div className="p-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md shadow-indigo-900/20">
              <Bot size={20} />
            </div>
            <div>
              <h1 className="font-semibold text-gray-200 tracking-wide">Tutor Socrático</h1>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            </div>
          </div>

          <button
            onClick={limparHistorico}
            title="Limpar histórico de conversa"
            className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-gray-900 flex items-center gap-2"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/*Corpo de Mensagens*/}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`p-2 rounded-lg h-fit text-white shadow-sm flex-shrink-0 ${msg.sender === 'user' ? 'bg-indigo-600' : 'bg-gray-800'}`}>
                {msg.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`p-4 rounded-xl shadow-md ${msg.sender === 'user' ? 'bg-indigo-950 text-gray-100 border border-indigo-800/50 rounded-tr-none' : 'bg-gray-950 text-gray-300 border border-gray-800 rounded-tl-none'}`}>
                {msg.image && (
                  <img src={msg.image} alt="Enviada pelo aluno" className="rounded-lg max-h-48 mb-3 border border-gray-800 object-contain" />
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-3xl">
              <div className="p-2 rounded-lg h-fit bg-gray-800 text-white animate-pulse">
                <Bot size={18} />
              </div>
              <div className="p-4 rounded-xl rounded-tl-none bg-gray-950 text-gray-500 italic text-sm border border-gray-800 animate-pulse flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                Tutor analisando o material...
              </div>
            </div>
          )}
        </div>

        {/*Input de Envio*/}
        <form onSubmit={handleSend} className="p-4 bg-gray-950 border-t border-gray-800 flex gap-3 items-center">
          {imagePreview && (
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg text-xs text-gray-300 font-medium">
              <ImageIcon size={14} className="text-indigo-400" /> Imagem anexada
            </div>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={imagePreview ? "Digite uma dúvida sobre a imagem..." : "Faça uma pergunta sobre a matéria..."}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !image)}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-700 p-3 rounded-xl text-white transition-all shadow-md active:scale-95 flex items-center justify-center border border-indigo-500 disabled:shadow-none"
          >
            <Send size={18} />
          </button>
        </form>

      </div>
    </div>
  );
}

export default App;