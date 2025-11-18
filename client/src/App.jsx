import React, { useEffect, useState, useRef } from 'react'
import io from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [username, setUsername] = useState('You')
  const [recipient, setRecipient] = useState('')
  const socketRef = useRef(null)

  useEffect(() => {
    fetch(`${SERVER_URL}/api/messages`).then(r => r.json()).then(data => setMessages(data)).catch(() => {});

    socketRef.current = io(SERVER_URL)
    socketRef.current.on('new_message', (msg) => {
      setMessages((m) => [...m, msg])
    })

    return () => socketRef.current && socketRef.current.disconnect()
  }, [])

  function sendMessage() {
    if (!text.trim()) return
    const payload = { sender: username, recipient: recipient || null, content: text.trim() }
    socketRef.current.emit('send_message', payload)
    setText('')
  }

  return (
    <div className="app-root">
      <div className="chat-container">
        <header className="chat-header">
          <h1>Daneth Messenger</h1>
          <div className="username-input">
            <input value={username} onChange={e => setUsername(e.target.value)} />
          </div>
        </header>

        <main className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.sender === username ? 'mine' : 'theirs'}`}>
              <div className="sender">{m.sender}{m.recipient ? ` → ${m.recipient}` : ''}</div>
              <div className="content">{m.content}</div>
            </div>
          ))}
        </main>

        <footer className="composer">
          <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Recipient (username, optional)" style={{width:200}} />
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." onKeyDown={e => e.key === 'Enter' && sendMessage()} />
          <button onClick={sendMessage}>Send</button>
        </footer>
      </div>
    </div>
  )
}
