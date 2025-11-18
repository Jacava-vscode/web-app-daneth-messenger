#!/usr/bin/env node
const mongoose = require('mongoose')
require('dotenv').config()
const bcrypt = require('bcryptjs')
const User = require('../models/User')

async function run() {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI not set in .env')
    await mongoose.connect(uri)
    console.log('Connected to MongoDB')

    const users = [
      { username: 'alice', password: 'alice_pass', isAdmin: false },
      { username: 'bob', password: 'bob_pass', isAdmin: false }
    ]

    for (const u of users) {
      const exists = await User.findOne({ username: u.username })
      if (exists) {
        console.log(`User ${u.username} already exists`)
        continue
      }
      const hash = await bcrypt.hash(u.password, 10)
      const user = new User({ username: u.username, passwordHash: hash, isAdmin: !!u.isAdmin })
      await user.save()
      console.log(`Created user ${u.username}`)
    }

    const all = await User.find({}).select('username isAdmin')
    console.log('Users in DB:', all)
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
