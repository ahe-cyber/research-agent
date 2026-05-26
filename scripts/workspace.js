function setupWorkspaceTabs() {
  const buttons = document.querySelectorAll("[data-tab-target]");
  const panels = document.querySelectorAll("[data-tab-panel]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.tabTarget;

      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      panels.forEach((panel) => {
        const isActive = panel.id === targetId;
        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
      });
    });
  });
}

function createAddressController() {
  const addressList = document.getElementById("addressList");
  const addresses = [];

  function add(searchResult) {
    const feature = searchResult.features && searchResult.features[0];
    const properties = feature && feature.properties ? feature.properties : {};
    const title = properties.full_address || properties.name || properties.address || "Selected place";
    const subtitle = properties.place_formatted || properties.context?.place?.name || "Search result";

    addresses.unshift({ title, subtitle });
    render();
  }

  function render() {
    addressList.replaceChildren();

    if (addresses.length === 0) {
      return;
    }

    addresses.forEach((address) => {
      const item = document.createElement("article");
      item.className = "address-item";

      const text = document.createElement("div");
      const title = document.createElement("strong");
      const subtitle = document.createElement("span");

      title.textContent = address.title;
      subtitle.textContent = address.subtitle;
      text.append(title, subtitle);
      item.appendChild(text);
      addressList.appendChild(item);
    });
  }

  render();

  return { add };
}
