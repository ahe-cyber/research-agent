import { Fragment, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorActionsMenu } from "@/components/editor/EditorActionsMenu";
import { getSkillSearchSources, saveSkillSearchSources } from "../skill.api";

export function createSkillSourceEditorPanel(onSaved?: () => void) {
  const panel = document.createElement("div");
  panel.className = "editor-raw-panel";
  createRoot(panel).render(<SkillSourceEditor onSaved={onSaved} />);
  return panel;
}

function SkillSourceEditor({ onSaved }: { onSaved?: () => void }) {
  const [rawText, setRawText] = useState("[]");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getSkillSearchSources()
      .then((response) => (response.ok ? response.json() : []))
      .then((sources) => setRawText(JSON.stringify(Array.isArray(sources) ? sources : [], null, 2)))
      .catch(() => setRawText("[]"));
  }, []);

  async function save() {
    let sources: unknown;
    try {
      sources = JSON.parse(rawText);
    } catch {
      setStatus("Raw JSON is invalid.");
      return;
    }

    if (!Array.isArray(sources)) {
      setStatus("Sources must be an array.");
      return;
    }

    try {
      setStatus("Saving...");
      const response = await saveSkillSearchSources(sources);
      if (!response.ok) {
        throw new Error(`Skill source save failed with status ${response.status}`);
      }
      setStatus("Saved");
      onSaved?.();
    } catch (error) {
      console.error("[SkillSourceEditor] Save failed", error);
      setStatus("Save failed");
    }
  }

  return (
    <div className="page-view editor-rich-view">
      <EditorActionsMenu
        right={(
          <Fragment>
            <button className="record-action" type="button" onClick={save}>
              Save
            </button>
            <span className="editor-rich-status">{status}</span>
          </Fragment>
        )}
      />
      <textarea
        className="editor-rich-raw"
        value={rawText}
        spellCheck={false}
        onChange={(event) => setRawText(event.target.value)}
      />
    </div>
  );
}
