const chatLog = document.getElementById("chatLog");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const statusMessage = document.getElementById("statusMessage");
const systemTrace = document.getElementById("systemTrace");
const systemStatus = document.getElementById("systemStatus");

const state = {
  history: [],
  pending: null
};

const stopWords = new Set(
  "a an and are as at be can do for from how i in is it me my of on or please the this that these those to was what when with you your explain make simple simply simpler words about tell more could".split(" ")
);

const topicPatterns = [
  { name: "photosynthesis", phrases: ["photosynthesis"] },
  { name: "cellular respiration", phrases: ["cellular respiration", "cell respiration", "respiration"] },
  { name: "cells", phrases: ["cells", "cell"] }
];

function tokens(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(word => word.length > 2 && !stopWords.has(word));
}

function findTopic(text) {
  const lower = text.toLowerCase();
  const match = topicPatterns.find(topic =>
    topic.phrases.some(phrase => lower.includes(phrase))
  );

  return match ? match.name : null;
}

function isUnclear(text) {
  const vagueReference =
    /\b(it|this|that|these|those|the same|the other one|the second one|the first one)\b/i.test(text);

  const genericRequest =
    /^(help|help me|i need help|explain|describe|tell me more|do this|write this)[.!?]*$/i.test(text);

  const vagueAssignmentRequest =
    /^(help me|help|explain|describe)\b.*\b(this|that|it)\b/i.test(text);

  return vagueReference || genericRequest || vagueAssignmentRequest;
}

function updateTrace(items, status) {
  systemTrace.replaceChildren();

  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    systemTrace.appendChild(li);
  });

  systemStatus.textContent = status;
}

function addMessage(role, text, actions = []) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Assistant";

  const content = document.createElement("div");
  content.textContent = text;

  bubble.append(label, content);

  if (actions.length > 0) {
    const controls = document.createElement("div");
    controls.className = "message-controls";

    actions.forEach(action => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      controls.appendChild(button);
    });

    bubble.appendChild(controls);
  }

  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function record(role, text) {
  state.history.push({ role, text });
  addMessage(role, text);
}

function showWelcome() {
  chatLog.replaceChildren();

  const welcome = document.createElement("p");
  welcome.className = "welcome-message";
  welcome.textContent = "Try an example or type a study question below.";

  chatLog.appendChild(welcome);
}

function newChat() {
  state.history = [];
  state.pending = null;
  statusMessage.textContent = "Started a new chat.";

  showWelcome();

  updateTrace(
    ["Waiting for a message."],
    "Context scope: earlier user messages in this chat only."
  );
}

function findBestContext(query, earlierMessages) {
  const userMessages = earlierMessages.filter(message =>
    message.role === "user" &&
    !/^(yes|no|okay|ok|thanks|right|correct)\b/i.test(message.text)
  );

  const usefulMessages = userMessages.filter(message =>
    tokens(message.text).length > 0
  );

  if (usefulMessages.length === 0) return null;

  const queryTerms = tokens(query);
  const vagueReference =
    /\b(it|this|that|these|those|the same|the other one|the second one|the first one)\b/i.test(query);

  if (queryTerms.length === 0) {
    return vagueReference ? usefulMessages[usefulMessages.length - 1] : null;
  }

  const ranked = usefulMessages
    .map((message, index) => {
      const messageTerms = new Set(tokens(message.text));
      const overlap = queryTerms.filter(term => messageTerms.has(term)).length;

      return {
        message,
        index,
        score: overlap / queryTerms.length
      };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index);

  if (ranked.length === 0) {
    return vagueReference ? usefulMessages[usefulMessages.length - 1] : null;
  }

  const best = ranked[0];

  if (best.score < 0.25 && !vagueReference) return null;
  return best.message;
}

function askFollowUp(originalMessage) {
  state.pending = { type: "missing", originalMessage };

  addMessage(
    "assistant",
    "I checked earlier messages in this chat but did not find enough relevant detail. What topic or text do you mean, and what would you like to know about it?"
  );

  statusMessage.textContent = "Waiting for you to supply the missing detail.";

  updateTrace(
    [
      "Received the user's message.",
      "Detected an unclear reference or missing detail.",
      "Checked earlier user messages in this chat automatically.",
      "Found no suitable context.",
      "Asked a focused follow-up question and am waiting."
    ],
    "The assistant will wait for the missing detail before responding."
  );
}

function askForConfirmation(originalMessage, contextText) {
  state.pending = { type: "confirm", originalMessage, contextText };

  const topic = findTopic(contextText);
  const inferredMeaning = topic
    ? `I think you mean “${topic}.”`
    : "This earlier message may be relevant.";

  addMessage(
    "assistant",
    `I checked earlier messages automatically.\nEarlier message: “${contextText}”\n${inferredMeaning}\nIs that what you mean?`,
    [
      { label: "Yes, continue", onClick: confirmContext },
      { label: "Correct it", onClick: askForCorrection }
    ]
  );

  statusMessage.textContent =
    "Please confirm or correct the context before the assistant answers.";

  updateTrace(
    [
      "Received the user's message.",
      "Detected an unclear reference or missing detail.",
      "Searched earlier user messages in this chat automatically.",
      `Selected a likely match: “${contextText}”`,
      "Asked the user to confirm or correct it before answering."
    ],
    "Waiting for the user's confirmation or correction."
  );
}

function confirmContext() {
  if (!state.pending || state.pending.type !== "confirm") return;

  const { originalMessage, contextText } = state.pending;
  addMessage("user", "Yes, continue.");
  state.history.push({ role: "user", text: "Yes, continue." });

  answerAfterClarification(originalMessage, contextText, "confirmed");
}

function askForCorrection() {
  if (!state.pending || state.pending.type !== "confirm") return;

  const originalMessage = state.pending.originalMessage;
  state.pending = { type: "correction", originalMessage };

  addMessage("assistant", "What topic or detail did you mean instead?");
  statusMessage.textContent = "Waiting for your correction.";

  updateTrace(
    [
      "The user chose to correct the suggested interpretation.",
      "Asked the user to provide the intended topic or detail.",
      "Waiting for the correction before answering."
    ],
    "The user's correction will replace the suggested context."
  );

  messageInput.focus();
}

function sampleResponse(originalMessage, contextText = "") {
  const topic = findTopic(contextText) || findTopic(originalMessage);

  if (topic === "photosynthesis") {
    return "Photosynthesis is how plants use light to make sugar from water and carbon dioxide. Oxygen is released in the process.";
  }

  if (topic === "cellular respiration") {
    return "Cellular respiration is how cells release usable energy from glucose. It usually uses oxygen and produces carbon dioxide and water.";
  }

  if (topic === "cells") {
    return "A cell is the basic unit of living things. Cells carry out processes that help an organism live and function.";
  }

  return `The request has been clarified as: “${originalMessage}”${
    contextText ? `\nClarified detail: “${contextText}”` : ""
  }\n\nThis prototype has captured the clarified request. Its answer is simulated; it is not connected to a live AI model.`;
}

function answerAfterClarification(
  originalMessage,
  contextText = "",
  source = "direct"
) {
  state.pending = null;
  addMessage("assistant", sampleResponse(originalMessage, contextText));

  if (source === "direct") {
    updateTrace(
      [
        "Received the user's message.",
        "The rule-based check found enough detail to continue.",
        "No history lookup was needed.",
        "Showed a sample response."
      ],
      "The interaction is implemented; answer generation is simulated."
    );
  } else {
    const firstStep = {
      confirmed: "The user confirmed the suggested earlier context.",
      supplied: "The user supplied the missing detail.",
      corrected: "The user corrected the suggested interpretation."
    }[source];

    const secondStep = {
      confirmed: `Used the confirmed earlier context: “${contextText}”`,
      supplied: `Used the detail supplied by the user: “${contextText}”`,
      corrected: `Used the user's correction: “${contextText}”`
    }[source];

    updateTrace(
      [
        firstStep,
        secondStep,
        "Showed a sample response using the clarified request."
      ],
      "Clarification is implemented; answer generation is simulated."
    );
  }

  statusMessage.textContent =
    "Sample response shown. No live AI model is connected.";
}

function handlePendingMessage(message, pending) {
  if (pending.type === "confirm") {
    if (/^(yes|yeah|correct|that's right|that is right)\b/i.test(message)) {
      answerAfterClarification(
        pending.originalMessage,
        pending.contextText,
        "confirmed"
      );
      return;
    }

    if (/^(no|nope|not that|not exactly)[.! ]*$/i.test(message)) {
      askForCorrection();
      return;
    }

    answerAfterClarification(
      pending.originalMessage,
      message,
      "corrected"
    );
    return;
  }

  if (pending.type === "missing" || pending.type === "correction") {
    if (isUnclear(message) && !findTopic(message)) {
      addMessage(
        "assistant",
        "I still need the topic or detail. Please name it directly."
      );

      statusMessage.textContent = "Still waiting for a clear topic or detail.";

      updateTrace(
        [
          "Received the user's follow-up.",
          "The topic or detail is still unclear.",
          "Asked again for the missing information."
        ],
        "The assistant is waiting for a clearer detail."
      );

      return;
    }

    const source = pending.type === "missing" ? "supplied" : "corrected";
    answerAfterClarification(pending.originalMessage, message, source);
  }
}

function handleUserMessage(rawText) {
  const message = rawText.trim();
  if (!message) return;

  addMessage("user", message);

  const earlierMessages = [...state.history];
  state.history.push({ role: "user", text: message });

  if (state.pending) {
    handlePendingMessage(message, state.pending);
    return;
  }

  const namedTopic = findTopic(message);
  const unclear = isUnclear(message) && !namedTopic;

  if (!unclear) {
    answerAfterClarification(message, "", "direct");
    return;
  }

  const context = findBestContext(message, earlierMessages);

  if (context) {
    askForConfirmation(message, context.text);
  } else {
    askFollowUp(message);
  }
}

function runDemo(kind) {
  newChat();

  if (kind === "context") {
    record("user", "I am studying photosynthesis for biology.");
    record("assistant", "I can help you study that topic.");
    handleUserMessage("Explain it in simple words.");
    return;
  }

  if (kind === "missing") {
    handleUserMessage("Explain this for my assignment.");
    return;
  }

  if (kind === "correction") {
    record("user", "I am revising photosynthesis.");
    record("assistant", "We can also compare it with cellular respiration.");
    record("user", "I also need to review cellular respiration.");
    handleUserMessage("Can you make that simpler?");
  }
}

messageForm.addEventListener("submit", event => {
  event.preventDefault();
  handleUserMessage(messageInput.value);
  messageInput.value = "";
  messageInput.focus();
});

document.getElementById("newChatButton")
  .addEventListener("click", newChat);

document.getElementById("contextDemoButton")
  .addEventListener("click", () => runDemo("context"));

document.getElementById("missingDemoButton")
  .addEventListener("click", () => runDemo("missing"));

document.getElementById("correctionDemoButton")
  .addEventListener("click", () => runDemo("correction"));

updateTrace(
  ["Waiting for a message. If it is unclear, earlier user messages will be checked automatically."],
  "Context scope: earlier user messages in this chat only."
);