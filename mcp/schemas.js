const { z } = require('zod');

// Shared parameter schemas
const modelParam = z.string().optional().describe('Ollama model name (defaults to first available model)');
const contentParam = z.string().min(1).describe('The code, text, or question to process');
const contextParam = z.string().optional().describe('Additional context (e.g., "this is from our payments service")');

// Mode tool schema (shared by all 6 mode tools)
const modeToolSchema = {
  content: contentParam,
  model: modelParam,
  context: contextParam
};

// Utility tool schemas
const browseFilesSchema = {
  path: z.string().optional().describe('Subfolder path to list (defaults to project root)'),
  depth: z.number().optional().describe('Max directory depth (default 3)')
};

const readFileSchema = {
  path: z.string().describe('Relative file path within the project folder')
};

const listModelsSchema = {};  // no params

const getStatusSchema = {};   // no params

const listConversationsSchema = {};  // no params

module.exports = {
  modeToolSchema,
  browseFilesSchema,
  readFileSchema,
  listModelsSchema,
  getStatusSchema,
  listConversationsSchema
};
