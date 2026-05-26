function createAgentController(recordStore) {
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
