export function AddressTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="addressTab" data-tab-panel hidden={!active}>
      <h2 className="section-title">Address</h2>
      <label className="field-label" htmlFor="placeSearchBox">
        Search address or place
      </label>
      <div className="search-box-shell" id="placeSearchBox" />
      <div className="address-list" id="addressList" />
    </section>
  );
}

export function createAddressController({ onAddressClick } = {}) {
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
      item.className = `address-item${onAddressClick ? " is-clickable" : ""}`;

      if (onAddressClick) {
        item.addEventListener("click", () => onAddressClick(address));
      }

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
