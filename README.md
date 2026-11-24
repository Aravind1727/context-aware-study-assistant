# Context-Aware Study Assistant
README prose word count: 175
## Project status
This is a browser-based prototype for clarifying unclear study questions. It checks earlier user messages in the current chat, asks for confirmation or correction when it finds likely context, and asks a follow-up question when context is missing. The clarification flow uses JavaScript rules. Sample answers are scripted; no live AI model is connected.

## Technology
The prototype uses HTML, CSS and JavaScript. It has no external packages or API keys.

## Run and inspect
Open the project folder in VS Code. Right-click `index.html` and choose **Open with Live Server**. Try the Relevant context, Missing context and Correct a guess examples.

## Development record
I tested the three example interactions in the browser. During development, I adjusted the script loading and clarification flow so the context-confirmation question and controls appear in the chat. I also updated the process panel to distinguish confirmed, supplied and corrected details.

## AI assistance
I used ChatGPT to discuss the project scope, review the interaction flow, suggest code and help debug the prototype. I checked the suggestions in the browser and changed the code and report descriptions to match the observed behaviour.

## Project files
- `index.html` — chat interface
- `style.css` — page styling
- `app.js` — clarification rules and simulated responses
- `1.png` — relevant-context example
- `2.png` — missing-context example
- `3.png` — correction example
- `Flowchart.png` — system flow diagram
