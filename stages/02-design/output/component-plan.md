# Component Plan — Code Companion

## Component Tree
```
App
├── Header
│   ├── Logo + Title
│   ├── ModelSelector (dropdown)
│   └── ConnectionStatus (green/red dot)
├── Sidebar
│   ├── NewChat button
│   ├── HistoryList
│   │   └── HistoryItem (title, mode badge, date)
│   └── SidebarToggle
├── MainArea
│   ├── ModeSelector (4 tab buttons)
│   │   ├── Explain tab
│   │   ├── Bug Hunter tab
│   │   ├── Refactor tab
│   │   └── Translate tab
│   ├── ChatMessages
│   │   └── MessageBubble (user or assistant)
│   │       ├── CodeBlock (syntax-highlighted)
│   │       └── Markdown rendering
│   ├── InputArea
│   │   ├── CodeTextarea (monospace, large)
│   │   ├── TranslateToggle (Tech→Biz / Biz→Tech, only in Translate mode)
│   │   └── SendButton
│   └── StreamingIndicator (typing dots)
└── StatusBar (model name, token count, response time)
```

## Layout
- Sidebar (280px, collapsible) | Main area (fluid)
- Mobile: sidebar hidden, hamburger toggle
- Header sticky at top
- Input area sticky at bottom
- Messages scroll in middle
