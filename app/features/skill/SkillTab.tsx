import { useEffect, useMemo, useState } from "react";
import { withBasePath } from "../../../lib/basePath";
import { FeatureSourceTab } from "../../components/workspace/FeatureSourceTab";
import { SidebarCard } from "../../components/workspace/SidebarCard";

interface SkillItem {
  id: string;
  name: string;
  source: string;
  path: string;
  description: string;
}

interface SkillSource {
  id: string;
  label: string;
  costly?: boolean;
}

export function SkillTab({ active, onOpenPage }: { active: boolean; onOpenPage?: (id: string, label: string) => void }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [sources, setSources] = useState<SkillSource[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(withBasePath("/data/features/skill.json"))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]));

    fetch(withBasePath("/api/search?feature=skill"))
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

  return (
    <FeatureSourceTab
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
    >
      <div className="skill-list">
        {filteredSkills.map((skill) => (
          <SidebarCard
            key={skill.id}
            className="skill-item tool-card"
            ariaLabel={skill.name}
            openLabel={`Open ${skill.name}`}
            onOpen={() => onOpenPage?.(`skill-${skill.id}`, skill.name)}
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
    </FeatureSourceTab>
  );
}

function normalizeSource(source: any): SkillSource {
  return {
    id: source.id || "project-skills",
    label: source.label || source.name || "Project Skills",
    costly: Boolean(source.costly)
  };
}
