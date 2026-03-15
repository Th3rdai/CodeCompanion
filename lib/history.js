const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let _historyDir = null;

function initHistory(appRoot) {
  _historyDir = path.join(appRoot, 'history');
  if (!fs.existsSync(_historyDir)) {
    fs.mkdirSync(_historyDir, { recursive: true });
  }
}

function listConversations() {
  if (!_historyDir) throw new Error('History not initialized. Call initHistory(appRoot) first.');
  
  try {
    const files = fs.readdirSync(_historyDir).filter(f => f.endsWith('.json'));
    const conversations = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(_historyDir, f), 'utf8'));
      return {
        id: data.id,
        title: data.title,
        mode: data.mode,
        model: data.model,
        createdAt: data.createdAt,
        archived: data.archived || false,
        overallGrade: data.mode === 'review' && data.reviewData?.reportData?.overallGrade
          ? data.reviewData.reportData.overallGrade
          : data.builderData?.scoreData?.overallGrade
          ? data.builderData.scoreData.overallGrade : undefined
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return conversations;
  } catch (err) {
    return [];
  }
}

function getConversation(id) {
  if (!_historyDir) throw new Error('History not initialized. Call initHistory(appRoot) first.');
  
  const filePath = path.join(_historyDir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error('Conversation not found');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveConversation(data) {
  if (!_historyDir) throw new Error('History not initialized. Call initHistory(appRoot) first.');
  
  if (!data.id) {
    data.id = uuidv4();
  }
  fs.writeFileSync(path.join(_historyDir, `${data.id}.json`), JSON.stringify(data, null, 2));
  return data.id;
}

function deleteConversation(id) {
  if (!_historyDir) throw new Error('History not initialized. Call initHistory(appRoot) first.');
  
  const filePath = path.join(_historyDir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  initHistory,
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation
};
