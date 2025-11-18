import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import io from 'socket.io-client'
import api from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import TypingIndicator from '../components/TypingIndicator'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [users, setUsers] = useState([])
  const socketRef = useRef(null)
  const pickerRef = useRef(null)
  const observerRef = useRef(null)
  const readEmitted = useRef(new Set())
  const [isTypingDemo, setIsTypingDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/api/messages').then(data => { if (!cancelled) setMessages(data) }).catch(() => {})

    // load user list for recipient selection
    api.get('/api/users').then(list => { if (!cancelled) setUsers(list) }).catch(() => {})

    socketRef.current = io(SERVER_URL, { auth: { token: localStorage.getItem('dm_token') } })

      const socket = socketRef.current
    const onNew = (msg) => setMessages((m) => [...m, msg])
    const onStatus = (evt) => {
      // evt: { messageId, status }
      setMessages((prev) => prev.map(msg => {
        if (!msg._id) return msg
        if (String(msg._id) === String(evt.messageId)) {
          return { ...msg, status: evt.status }
        }
        return msg
      }))
    }

    socket.on('new_message', onNew)
    socket.on('message_status', onStatus)

    return () => {
      cancelled = true
      socket.off('new_message', onNew)
      socket.off('message_status', onStatus)
      socket.disconnect()
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [])



  useEffect(() => {
    // Observe message elements and emit message_read when visible to the recipient
    if (!('IntersectionObserver' in window)) return

    // clean previous observer
    if (observerRef.current) observerRef.current.disconnect()

    const socket = socketRef.current
    const options = { root: null, rootMargin: '0px', threshold: 0.6 }
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const el = entry.target
        const messageId = el.getAttribute('data-id')
        if (!messageId) return
        // find message
        const msg = messages.find(m => String(m._id) === String(messageId))
        if (!msg) return
        // If the current user is the recipient and message not yet read, emit message_read
        const myUsername = user?.username
        if (msg.recipient === myUsername || (msg.recipientId && String(msg.recipientId) === String(user?.id))) {
          if (msg.status !== 'read' && !readEmitted.current.has(String(messageId))) {
            readEmitted.current.add(String(messageId))
            try {
              socket && socket.emit('message_read', { messageId })
            } catch (e) {
              // ignore
            }
          }
        }
      })
    }, options)

    // attach to current message elements
    const nodes = Array.from(document.querySelectorAll('.messages .message[data-id]'))
    nodes.forEach(n => observerRef.current.observe(n))

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [messages, user])

  function sendMessage() {
    if (!text.trim()) return
    // resolve recipient username from users list when sending
    const recipientObj = users.find(u => String(u.id) === String(recipientId))
    const payload = {
      sender: user?.username || 'You',
      senderId: user?.id || null,
      recipient: recipientObj ? recipientObj.username : null,
      recipientId: recipientId || null,
      content: text.trim()
    }
    socketRef.current && socketRef.current.emit('send_message', payload)
    setText('')
    setPickerQuery('')
    setPickerOpen(false)
  }

  const filteredUsers = users.filter(u => u.username && u.username.toLowerCase().includes(pickerQuery.toLowerCase()))
  function chooseUser(u) { setRecipientId(u.id); setPickerOpen(false); setPickerQuery('') }

  // keyboard navigation for picker
  useEffect(() => {
    if (!pickerOpen) { setSelectedIndex(-1); return }
    // default to first selectable item (Everyone is index 0)
    setSelectedIndex(0)
  }, [pickerOpen])

  useEffect(() => {
    // clamp selectedIndex if filteredUsers length changes
    if (selectedIndex > filteredUsers.length) {
      setSelectedIndex(Math.max(0, filteredUsers.length - 1))
    }
  }, [filteredUsers, selectedIndex])

  function onPickerKeyDown(e) {
    if (!pickerOpen) return
    const listLen = 1 + filteredUsers.filter(u => u.username !== user?.username).length // Everyone + users
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % listLen)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + listLen) % listLen)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // index 0 => Everyone
      if (selectedIndex === 0) {
        chooseUser({ id: '', username: 'Everyone' })
        return
      }
      // map selectedIndex to filteredUsers (skip the ones equal to current user)
      const list = filteredUsers.filter(u => u.username !== user?.username)
      const pick = list[selectedIndex - 1]
      if (pick) chooseUser(pick)
      return
    }
  }

  // close picker on outside click or Escape
  useEffect(() => {
    function onDocClick(e) {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(e.target)) setPickerOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const messageVariants = {
    initial: { y: 10, opacity: 0, scale: 0.98 },
    enter: { y: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } },
    exit: { y: 6, opacity: 0, scale: 0.98, transition: { duration: 0.18 } }
  }

  return (
    <div className="app-root">
      <div className="chat-container">
        <header className="chat-header">
          <h1>Daneth Messenger</h1>
          <div className="username-input">
            <div style={{ color: '#cbd5e1' }}>{user?.username || 'You'}</div>
          </div>
        </header>

        <main className="messages">
          {messages.map((m, i) => {
            const mine = String(m.senderId || m.sender) === String(user?.id) || m.sender === user?.username
            return (
              <div key={m._id || i} data-id={m._id} className={`message ${mine ? 'mine' : 'theirs'}`}>
                <div className="sender">{m.sender}{m.recipient ? ` → ${m.recipient}` : ''}</div>
                <div className="content">{m.content}</div>
                {(() => {
                  const status = m.status || 'sent'
                  const singleVisible = status === 'sent' || status === 'delivered' || status === 'read'
                  const doubleVisible = status === 'delivered' || status === 'read'
                  return (
                    <motion.div className="message-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{/* timestamp or extra */}</div>
                      <div className={`status-icon ${status}`}>{/* animated SVG icons */}
                        <motion.svg className="icon single" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                          initial={{ opacity: 0.24, scale: 0.96 }}
                          animate={{ opacity: singleVisible ? 1 : 0.18, scale: status === 'read' ? 1.08 : (status === 'delivered' ? 1.04 : 1) }}
                          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        >
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>

                        <motion.svg className="icon double" width="18" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                          initial={{ opacity: 0.18, scale: 0.96 }}
                          animate={{ opacity: doubleVisible ? 1 : 0.18, scale: status === 'read' ? 1.12 : (status === 'delivered' ? 1.04 : 1) }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        >
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M22 6L11 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                        <AnimatePresence>
                          {status === 'read' && (
                            <motion.span className="read-heart pulse" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.1 20.6c-.4-.3-4.6-3.6-6.7-6.1C2.4 11 3.1 7.7 6 6.1c1.5-.8 3.4-.6 4.7.4l1.3 1.1 1.3-1.1c1.3-1 3.2-1.2 4.7-.4 2.9 1.6 3.6 4.9.6 8.4-2.1 2.5-6.3 5.8-6.3 5.8z"/></svg>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )
                })()}
              </div>
            )
          })}
        </main>

        <main className="messages">
          <AnimatePresence>
            {messages.map((m, i) => {
              const mine = String(m.senderId || m.sender) === String(user?.id) || m.sender === user?.username
              return (
                <motion.div key={m._id || i} data-id={m._id} className={`message ${mine ? 'mine' : 'theirs'}`} initial="initial" animate="enter" exit="exit" variants={messageVariants} layout>
                  <div className="sender">{m.sender}{m.recipient ? ` → ${m.recipient}` : ''}</div>
                  <div className="content">{m.content}</div>
                  {(() => {
                    const status = m.status || 'sent'
                    const singleVisible = status === 'sent' || status === 'delivered' || status === 'read'
                    const doubleVisible = status === 'delivered' || status === 'read'
                    return (
                      <motion.div className="message-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{/* timestamp or extra */}</div>
                        <div className={`status-icon ${status}`}>{/* animated SVG icons */}
                          <motion.svg className="icon single" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                            initial={{ opacity: 0.24, scale: 0.96 }}
                            animate={{ opacity: singleVisible ? 1 : 0.18, scale: status === 'read' ? 1.08 : (status === 'delivered' ? 1.04 : 1) }}
                            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                          >
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>

                          <motion.svg className="icon double" width="18" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                            initial={{ opacity: 0.18, scale: 0.96 }}
                            animate={{ opacity: doubleVisible ? 1 : 0.18, scale: status === 'read' ? 1.12 : (status === 'delivered' ? 1.04 : 1) }}
                            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                          >
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M22 6L11 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                          <AnimatePresence>
                            {status === 'read' && (
                              <motion.span className="read-heart pulse" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
                                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.1 20.6c-.4-.3-4.6-3.6-6.7-6.1C2.4 11 3.1 7.7 6 6.1c1.5-.8 3.4-.6 4.7.4l1.3 1.1 1.3-1.1c1.3-1 3.2-1.2 4.7-.4 2.9 1.6 3.6 4.9.6 8.4-2.1 2.5-6.3 5.8-6.3 5.8z"/></svg>
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )
                  })()}
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Typing demo indicator (shows at bottom of messages) */}
          {isTypingDemo && <div style={{padding: '8px 20px'}}><TypingIndicator /></div>}
        </main>
