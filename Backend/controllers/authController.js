const { readUsers, writeUsers } = require('../models/userModel');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function register(req, res){
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });

  const users = readUsers();
  if(users.find(u => u.username.toLowerCase() === username.toLowerCase())){
    return res.status(409).json({ error: 'User already exists' });
  }

  try{
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = { id: Date.now().toString(), username, passwordHash: hash, createdAt: new Date().toISOString() };
    users.push(newUser);
    writeUsers(users);
    const safe = { id: newUser.id, username: newUser.username, createdAt: newUser.createdAt };
    res.status(201).json({ user: safe });
  }catch(err){
    console.error('register error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function login(req, res){
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'username and password required' });

  const users = readUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if(!user) return res.status(401).json({ error: 'Invalid credentials' });

  try{
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const safe = { id: user.id, username: user.username, createdAt: user.createdAt };
    res.json({ user: safe });
  }catch(err){
    console.error('login error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { register, login };
