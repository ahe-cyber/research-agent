import { useEffect, useMemo, useState } from "react";
import { SidebarPanel } from "@/components/sidebar/SidebarPanel";
import { SidebarCard } from "@/components/sidebar/SidebarCard";
import { skillEditorFields } from "../skill.schema";
import type { SkillItem, SkillSearchSource } from "../skill.schema";
import { getSkillSearchSources, getSkills, saveSkill } from "../skill.api";

interface SkillSidebarPanelProps {
  active: boolean;
  onOpenRichPage?: (id: string, label: string, value: SkillItem, options: unknown) => void;
}

export function SkillSidebarPanel({ active, onOpenRichPage }: SkillSidebarPanelProps) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [sources, setSources] = useState<SkillSearchSource[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getSkills()
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));

    getSkillSearchSources()
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSources(Array.isArray(data) ? data.map(normalizeSource) : []))
      .catch(() => setSources([{ id: "project-skills", label: "Project Skills" }]));
  }, []);

  const filteredSkills = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return skills;
    return skills.filter((skill) => [
      skill.name,
      skill.source,
      skill.description,
      skill.path
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [query, skills]);

  async function saveSkillRecord(skill: SkillItem) {
    const response = await saveSkill(skill);
    if (!response.ok) {
      throw new Error(`Skill save failed with status ${response.status}`);
    }
    const savedSkill = await response.json();
    setSkills((current) => current.map((item) => (item.id === savedSkill.id ? savedSkill : item)));
    return savedSkill;
  }

  return (
    <SidebarPanel
      active={active}
      featureId="skill"
      featureLabel="Skill"
      dropdownClassName="skill-source-dropdown"
      dropdownOptions={sources}
      selectedSourceId={sources[0]?.id}
      editSourcesLabel="Edit skill sources"
      searchClassName="skill-search-widget"
      searchId="skillSidebarSearch"
      searchPlaceholder="Search skills"
      searchInputName="skill-query"
      onSearchQuery={(value) => setQuery(value)}
      onEditSources={() => window.dispatchEvent(new CustomEvent("research-agent:edit-skill-sources"))}
    >
      <div className="skill-list">
        {filteredSkills.map((skill) => (
          <SidebarCard
            key={skill.id}
            className="skill-item tool-card"
            ariaLabel={skill.name}
            openLabel={`Open ${skill.name}`}
            onOpen={() => onOpenRichPage?.(`skill-${skill.id}`, skill.name, skill, {
              rich: true,
              fields: skillEditorFields,
              onSave: saveSkillRecord
            })}
          >
            <div className="tool-signature">
              <code className="tool-name">{skill.name}</code>
            </div>
            <p className="tool-card-description">{skill.description}</p>
            <p className="skill-card-meta">{skill.source}</p>
          </SidebarCard>
        ))}
        {filteredSkills.length === 0 && (
          <p className="map-empty-note">No matching skills.</p>
        )}
      </div>
    </SidebarPanel>
  );
}

function normalizeSource(source: any): SkillSearchSource {
  return {
    id: source.id || "project-skills",
    label: source.label || source.name || "Project Skills",
    costly: Boolean(source.costly)
  };
}
