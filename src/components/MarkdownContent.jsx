import { useRef, useEffect } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.min.css';

function renderMarkdown(text) {
  if (!text) return '';
  try { return marked.parse(text, { breaks: true }); }
  catch { return text; }
}

export default function MarkdownContent({ content }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
  }, [content]);
  return <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}
