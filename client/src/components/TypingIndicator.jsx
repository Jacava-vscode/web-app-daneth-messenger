import React from 'react'
import { motion } from 'framer-motion'

export default function TypingIndicator({ className }){
  const dot = {
    animate: { y: [0, -6, 0], opacity: [0.6, 1, 0.6], transition: { duration: 0.9, repeat: Infinity } }
  }
  return (
    <div className={className || 'typing-indicator'} style={{display:'flex',gap:6,alignItems:'center'}}>
      <motion.span className="dot" style={{width:8,height:8,borderRadius:8,background:'#ffd6e0'}} variants={dot} animate="animate" />
      <motion.span className="dot" style={{width:8,height:8,borderRadius:8,background:'#ff9dbf'}} variants={dot} animate="animate" transition={{ delay: 0.15, duration:0.9, repeat: Infinity }} />
      <motion.span className="dot" style={{width:8,height:8,borderRadius:8,background:'#ff6b9a'}} variants={dot} animate="animate" transition={{ delay: 0.28, duration:0.9, repeat: Infinity }} />
    </div>
  )
}
