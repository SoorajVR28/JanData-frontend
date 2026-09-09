import { useState } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const sendMessage = (text = input) => {
    if (!text.trim()) return;
  
    setMessages([
      ...messages,
      { role: "user", text: text },
    ]);
  
    setInput("");
    setIsThinking(true);
  
    setTimeout(() => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          text: "I received your request. Once the backend is connected, I’ll fetch the relevant government data for you.",
        },
      ]);
  
      setIsThinking(false);
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>JanData Nexus</h1>
          <p>Government Data Access & AI Chatbot</p>
        </div>
      </header>

      <main className="chat-container">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-icon">🇮🇳</div>

            <h2>How can I help you today?</h2>

            <p>
              Ask JanData Nexus for government data, statistics, reports,
              comparisons, or insights.
            </p>

            <div className="suggestions">
              <button
                onClick={() =>
                  sendMessage(
                    "What is the paddy production in Dakshina Kannada in 2026?"
                  )
                }
              >
                🌾 Paddy production in Dakshina Kannada
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "Compare school enrollment and unemployment across districts."
                  )
                }
              >
                📊 Compare district statistics
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "Give me the latest government report on agriculture."
                  )
                }
              >
                📄 Find an agriculture report
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "Give me the requested government data in Excel format."
                  )
                }
              >
                📥 Get data in Excel
              </button>
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${
                  message.role === "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
              >
                <div className="message-label">
                  {message.role === "user" ? "You" : "JanData Nexus"}
                </div>

                <div className="message-text">{message.text}</div>
              </div>
            ))}
          </div>
        )}
        {isThinking && (
          <div className="message assistant-message">
            <div className="message-label">JanData Nexus</div>
            <div className="message-text">I'm fetching the data for you...</div>
          </div>
        )}
        <div className="input-area">
          <input
            type="text"
            placeholder="Ask for government data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button onClick={() => sendMessage()}>Send</button>
        </div>
      </main>
    </div>
  );
}

export default App;