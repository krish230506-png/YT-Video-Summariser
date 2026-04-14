'use client';
import { useState, useRef, useEffect } from 'react';

function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function parseMarkdownToHTML(text) {
  if (!text) return "";
  let html = text
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  html = html.replace(/(?:\[)?\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b(?:\])?/g, (match, p1, p2, p3) => {
    let sec = 0;
    if (p3) sec = parseInt(p1) * 3600 + parseInt(p2) * 60 + parseInt(p3);
    else sec = parseInt(p1) * 60 + parseInt(p2);
    const display = p3 ? `[${p1}:${p2}:${p3}]` : `[${p1}:${p2}]`;
    return `<button class="time-link" data-sec="${sec}">${display}</button>`;
  });

  return html;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  
  // Tabs and Chat State
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'history'
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef(null);
  const [historyList, setHistoryList] = useState([]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('ytHistory');
    if (saved) {
      try { setHistoryList(JSON.parse(saved)); } catch (e) {}
    }
  }, []);
  
  const videoId = typeof window !== "undefined" && url ? extractVideoID(url) : null;
  const iframeRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  useEffect(() => {
    const handleTimestampClick = (e) => {
      if (e.target && e.target.classList.contains('time-link')) {
        const seconds = e.target.getAttribute('data-sec');
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [parseFloat(seconds), true] }), '*'
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
          );
        }
      }
    };
    document.addEventListener('click', handleTimestampClick);
    return () => document.removeEventListener('click', handleTimestampClick);
  }, []);

  const handleSummarize = async () => {
    if (!url || !extractVideoID(url)) {
      setError("Please paste a valid YouTube URL first.");
      return;
    }
    setError('');
    setResult('');
    setLoading(true);
    setActiveTab('summary');

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, language })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data.summary);

      // Save to history
      const vId = extractVideoID(url);
      if (vId) {
        const newItem = { url, videoId: vId, summary: data.summary, date: new Date().toLocaleString() };
        setHistoryList(prev => {
          const newHistory = [newItem, ...prev.filter(item => item.videoId !== vId)].slice(0, 20);
          localStorage.setItem('ytHistory', JSON.stringify(newHistory));
          return newHistory;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !url) return;

    const newMessage = { role: 'user', content: chatInput };
    const updatedMessages = [...chatMessages, newMessage];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, messages: updatedMessages })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setChatMessages([...updatedMessages, { role: 'model', content: data.reply }]);
    } catch (err) {
      setChatMessages([...updatedMessages, { role: 'model', content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="container">
      <div className="hero">
        <h1>YouTube AI Platform</h1>
        <p>Your interactive learning hub. Summarize, visualize, chat, and navigate videos magically.</p>
      </div>

      <div className="input-section">
        <div className="input-wrapper">
          <input
            type="text"
            className="url-input"
            placeholder="Paste YouTube URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <select 
            className="lang-select" 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi / हिंदी</option>
            <option value="Spanish">Spanish / Español</option>
            <option value="French">French / Français</option>
            <option value="Japanese">Japanese / 日本語</option>
          </select>
          <button className="submit-btn" onClick={handleSummarize} disabled={loading}>
            {loading ? <><span className="spinner"></span> Analyzing...</> : 'Summarize & Visualize'}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>

      {(result || videoId) && (
        <div className="dashboard">
          <div className="video-container">
            <div className="iframe-wrapper">
              {videoId ? (
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`}
                  title="Video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Awaiting URL...</div>
              )}
            </div>
            {result && <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>💡 Tip: Click timestamps to jump!</p>}
          </div>

          <div className="results-section">
            {/* Tabs Header */}
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                Summary & Mindmap
              </button>
              <button 
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
            </div>

            {/* Tab Body */}
            <div className="tab-body">
              {activeTab === 'summary' && (
                loading && !result ? (
                  <div style={{ textAlign: 'center', color: '#6366f1', padding: '3rem' }}>
                    <span className="spinner" style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1', display: 'inline-block', marginBottom: '1rem' }}></span>
                    <p>Building mindmap, detecting chapters, and translating...</p>
                  </div>
                ) : (
                  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(result) }} />
                )
              )}

              {activeTab === 'history' && (
                <div className="history-list">
                  {historyList.length === 0 ? (
                    <div className="chat-empty"><p>No history yet.</p></div>
                  ) : (
                    historyList.map((item, idx) => (
                      <div key={idx} className="history-card" onClick={() => {
                        setUrl(item.url);
                        setResult(item.summary);
                        setActiveTab('summary');
                      }}>
                        <div className="history-thumb"><img src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`} alt="thumb"/></div>
                        <div className="history-details">
                          <strong>{item.url}</strong>
                          <small>{item.date}</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Interface */}
      {videoId && (
        <>
          <button className="floating-chat-btn" onClick={() => setIsChatOpen(!isChatOpen)}>
            ✨
          </button>
          
          {isChatOpen && (
            <div className="floating-chat-panel">
              <div className="floating-chat-header">
                <h3>Chat with Video</h3>
                <button onClick={() => setIsChatOpen(false)}>×</button>
              </div>
              <div className="chat-interface">
                <div className="chat-history">
                  {chatMessages.length === 0 && (
                    <div className="chat-empty">
                      <p>Ask me anything about this video!</p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      {msg.role === 'model' && <div className="chat-avatar ai">✨</div>}
                      <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(msg.content) }}></div>
                      {msg.role === 'user' && <div className="chat-avatar user">👤</div>}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="chat-message model">
                      <div className="chat-avatar ai">✨</div>
                      <div className="chat-bubble"><span className="spinner small"></span> Thinking...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    placeholder="Ask a question..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button type="submit" disabled={!chatInput.trim() || chatLoading}>Send</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
