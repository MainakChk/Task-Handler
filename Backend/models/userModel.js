const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'data', 'users.json');

function ensureDataFile(){
  if(!fs.existsSync(dataFile)){
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify([]));
  }
}

function readUsers(){
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, 'utf8');
  return JSON.parse(raw);
}

function writeUsers(users){
  fs.writeFileSync(dataFile, JSON.stringify(users, null, 2));
}

module.exports = { readUsers, writeUsers };
