const MAP_APP_ENV = {};

async function loadMapAppEnv() {
  if (Object.keys(MAP_APP_ENV).length > 0) {
    return MAP_APP_ENV;
  }

  try {
    const response = await fetch(".env", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`.env failed with status ${response.status}`);
    }

    parseEnv(await response.text(), MAP_APP_ENV);
  } catch (error) {
    console.error("Could not load .env", error);
  }

  return MAP_APP_ENV;
}

function parseEnv(text, target) {
  text.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const equalsIndex = trimmedLine.indexOf("=");

    if (equalsIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    const value = trimmedLine.slice(equalsIndex + 1).trim();
    target[key] = stripEnvQuotes(value);
  });
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getEnvValue(key) {
  return MAP_APP_ENV[key] || "";
}
