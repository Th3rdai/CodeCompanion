/**
 * Build Project Registry for Code Companion
 *
 * Tracks Build-mode projects across sessions via a JSON registry file.
 * Uses atomic writes (temp file + rename) to prevent corruption.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = '.cc-build-projects.json';

// Reuse slugify from icm-scaffolder pattern
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

function _registryPath(dataRoot) {
  return path.join(dataRoot, REGISTRY_FILE);
}

function loadRegistry(dataRoot) {
  const file = _registryPath(dataRoot);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return []; }
}

function saveRegistry(dataRoot, projects) {
  const file = _registryPath(dataRoot);
  const tmp = file + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(projects, null, 2));
  fs.renameSync(tmp, file);
}

function addProject(dataRoot, { name, projectPath }) {
  const projects = loadRegistry(dataRoot);
  // Check for duplicate path
  if (projects.some(p => p.path === projectPath)) {
    const existing = projects.find(p => p.path === projectPath);
    existing.lastActivity = new Date().toISOString();
    saveRegistry(dataRoot, projects);
    return existing.id;
  }
  const id = slugify(name) + '-' + Date.now().toString(36);
  projects.push({
    id, name, path: projectPath,
    created: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  });
  saveRegistry(dataRoot, projects);
  return id;
}

function removeProject(dataRoot, id) {
  const projects = loadRegistry(dataRoot);
  const filtered = projects.filter(p => p.id !== id);
  if (filtered.length === projects.length) return false;
  saveRegistry(dataRoot, filtered);
  return true;
}

function getProject(dataRoot, id) {
  return loadRegistry(dataRoot).find(p => p.id === id) || null;
}

function updateActivity(dataRoot, id) {
  const projects = loadRegistry(dataRoot);
  const project = projects.find(p => p.id === id);
  if (!project) return false;
  project.lastActivity = new Date().toISOString();
  saveRegistry(dataRoot, projects);
  return true;
}

function validateProjects(dataRoot) {
  return loadRegistry(dataRoot).map(p => ({
    ...p,
    exists: fs.existsSync(p.path),
    hasPlanning: fs.existsSync(path.join(p.path, '.planning')),
  }));
}

module.exports = {
  loadRegistry,
  saveRegistry,
  addProject,
  removeProject,
  getProject,
  updateActivity,
  validateProjects,
};
