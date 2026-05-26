export function AgentPanel() {
  return (
    <aside className="agent-panel" aria-label="Agent chat">
      <header className="panel-header">
        <span className="panel-kicker">Agent</span>
        <strong className="panel-title">Gemini</strong>
      </header>
      <div className="agent-thread" id="agentThread">
        <div className="agent-message agent-message-system">
          Ask the agent to interpret selected places, records, and datasets.
        </div>
      </div>
      <form className="agent-composer" id="agentComposer">
        <button className="context-button" type="button" id="attachContextButton" aria-pressed="false">
          Attach context
        </button>
        <textarea
          className="agent-input"
          id="agentInput"
          rows="4"
          placeholder="Ask about this place or dataset trail"
        />
        <button className="agent-send" type="submit">
          Send
        </button>
      </form>
    </aside>
  );
}

export function createAgentController(recordStore) {
  const thread = document.getElementById("agentThread");
  const form = document.getElementById("agentComposer");
  const input = document.getElementById("agentInput");
  const attachButton = document.getElementById("attachContextButton");
  let shouldAttachContext = false;

  attachButton.addEventListener("click", () => {
    shouldAttachContext = !shouldAttachContext;
    attachButton.classList.toggle("is-active", shouldAttachContext);
    attachButton.setAttribute("aria-pressed", String(shouldAttachContext));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) {
      return;
    }

    addMessage(text, "user");

    if (shouldAttachContext) {
      addMessage(`Context attached: ${recordStore.all().length} query record(s).`, "system");
    }

    input.value = "";
  });

  function addMessage(text, type) {
    const message = document.createElement("div");
    message.className = `agent-message agent-message-${type}`;
    message.textContent = text;
    thread.appendChild(message);
    thread.scrollTop = thread.scrollHeight;
  }

  return { addMessage };
}
