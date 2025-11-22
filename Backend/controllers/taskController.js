const { readTasks, writeTasks } = require('../models/taskModel');
const { v4: uuidv4 } = require('uuid');

function listTasks(req, res){
  const tasks = readTasks();
  res.json(tasks);
}

function createTask(req, res){
  const { title, description, category, dueDate, status } = req.body;
  if(!title) return res.status(400).json({ error: 'Title is required' });

  const tasks = readTasks();
  const newTask = {
    id: uuidv4(),
    title,
    description: description || '',
    category: category || 'general',
    dueDate: dueDate || null,
    status: status || 'pending',
    createdAt: new Date().toISOString()
  };

  tasks.push(newTask);
  writeTasks(tasks);
  res.status(201).json(newTask);
}

function updateTask(req, res){
  const tasks = readTasks();
  const { id } = req.params;
  const task = tasks.find(t => t.id === id);
  if(!task) return res.status(404).json({ error: 'Not found' });

  const allowed = ['title','description','category','dueDate','status'];
  for(const k of allowed){
    if(req.body[k] !== undefined) task[k] = req.body[k];
  }

  writeTasks(tasks);
  res.json(task);
}

function deleteTask(req, res){
  let tasks = readTasks();
  const { id } = req.params;
  const newTasks = tasks.filter(t => t.id !== id);
  if(newTasks.length === tasks.length) return res.status(404).json({ error: 'Not found' });
  writeTasks(newTasks);
  res.json({ success: true });
}

module.exports = { listTasks, createTask, updateTask, deleteTask };
