const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'tasks.json');

function ensureDataFile(){
  if(!fs.existsSync(dataFile)){
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify([]));
  }
}

function readTasks(){
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, 'utf8');
  return JSON.parse(raw);
}

function writeTasks(tasks){
  fs.writeFileSync(dataFile, JSON.stringify(tasks, null, 2));
}

module.exports = { readTasks, writeTasks };
