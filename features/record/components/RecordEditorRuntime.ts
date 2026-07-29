export function createRecordStore() {
  let nextId = 1;
  const records = [];

  function add(record) {
    const storedRecord = {
      id: String(nextId),
      ...record
    };
    nextId += 1;
    records.unshift(storedRecord);
    window.dispatchEvent(new CustomEvent("research-agent:records-changed", { detail: { records: all() } }));
    return storedRecord;
  }

  function all() {
    return [...records];
  }

  function find(recordId) {
    return records.find((record) => record.id === recordId);
  }

  return { add, all, find };
}

export function createRecordController(recordStore, ..._args) {
  return {
    render() {},
    add(record) {
      return recordStore.add(record);
    },
    reload() {}
  };
}

export function renderJsonTree(value, ..._args) {
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(value, null, 2);
  return pre;
}
