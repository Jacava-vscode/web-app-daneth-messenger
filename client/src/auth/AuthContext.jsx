import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('dm_token'))
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dm_user'))
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (token) {
      localStorage.setItem('dm_token', token)
      api.setToken(token)
    } else {
      localStorage.removeItem('dm_token')
      api.setToken(null)
    }
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('dm_user', JSON.stringify(user))
    else localStorage.removeItem('dm_user')
  }, [user])

  const login = (tokenVal, userVal) => {
    setToken(tokenVal)
    // ensure userVal includes id when provided by server
    setUser(userVal)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
