export type FeatureName = string;

export const getFeatureLabel = (feature: FeatureName) => {
  return feature
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};
