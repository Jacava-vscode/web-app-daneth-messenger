import React, { useState } from 'react'
import api from '../lib/api'

export default function Admin() {
  const [adminKey, setAdminKey] = useState('')
  const [createUserRes, setCreateUserRes] = useState(null)
  const [resetRes, setResetRes] = useState(null)

  async function createUser(e) {
    e.preventDefault()
    const username = e.target.username.value
    const password = e.target.password.value
    const isAdmin = e.target.isAdmin.checked
    try {
      const res = await api.post('/api/admin/create-user', { username, password, isAdmin }, { headers: { 'x-admin-key': adminKey } })
      setCreateUserRes({ ok: true, data: res })
    } catch (err) {
      setCreateUserRes({ ok: false, error: err?.response?.data || err.message })
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    const username = e.target.username.value
    const newPassword = e.target.newPassword.value
    try {
      const res = await api.post('/api/admin/reset-password', { username, newPassword }, { headers: { 'x-admin-key': adminKey } })
      setResetRes({ ok: true, data: res })
    } catch (err) {
      setResetRes({ ok: false, error: err?.response?.data || err.message })
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Admin Panel</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Admin Key: <input value={adminKey} onChange={e => setAdminKey(e.target.value)} style={{ width: 360 }} /></label>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h3>Create User</h3>
        <form onSubmit={createUser}>
          <input name="username" placeholder="username" />
          <input name="password" placeholder="password" />
          <label style={{ marginLeft: 8 }}><input type="checkbox" name="isAdmin" /> isAdmin</label>
          <button type="submit">Create</button>
        </form>
        <pre>{createUserRes ? JSON.stringify(createUserRes, null, 2) : ''}</pre>
      </section>

      <section>
        <h3>Reset Password</h3>
        <form onSubmit={resetPassword}>
          <input name="username" placeholder="username" />
          <input name="newPassword" placeholder="new password" />
          <button type="submit">Reset</button>
        </form>
        <pre>{resetRes ? JSON.stringify(resetRes, null, 2) : ''}</pre>
      </section>
    </div>
  )
}
