// ZledgerCraft - conservative three-way merge for workspace snapshots.
// Arrays with stable ids merge by id; arrays without ids (such as voucher
// lines) are atomic. Anything that cannot be proved non-overlapping conflicts.
function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]))
  );
}

function idKey(arrays) {
  for (const array of arrays) {
    const seen = new Set();
    for (const item of array) {
      if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) return null;
      seen.add(item.id);
    }
  }
  return 'id';
}

function conflict(path) {
  return { ok: false, reason: `Conflicting changes at ${path.join('.') || 'the workspace root'}.` };
}

function mergeValue(base, local, current, path) {
  if (deepEqual(local, base)) return { ok: true, value: current };
  if (deepEqual(current, base)) return { ok: true, value: local };
  if (deepEqual(local, current)) return { ok: true, value: local };

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(current)) {
    const key = idKey([base, local, current]);
    if (!key) return conflict(path);
    return mergeArray(base, local, current, path, key);
  }
  if (isPlainObject(base) && isPlainObject(local) && isPlainObject(current)) {
    return mergeObject(base, local, current, path);
  }
  // A view selection is local presentation state, not shared book data.
  if (['activeCompanyId', 'currentUserId'].includes(path[path.length - 1])) {
    return { ok: true, value: local };
  }
  return conflict(path);
}

function mergeObject(base, local, current, path) {
  const result = Object.create(null);
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(current)]);
  for (const key of keys) {
    const hasBase = Object.prototype.hasOwnProperty.call(base, key);
    const hasLocal = Object.prototype.hasOwnProperty.call(local, key);
    const hasCurrent = Object.prototype.hasOwnProperty.call(current, key);
    const baseValue = hasBase ? base[key] : undefined;
    const localValue = hasLocal ? local[key] : undefined;
    const currentValue = hasCurrent ? current[key] : undefined;

    if (!hasLocal && !hasCurrent) continue;
    if (!hasLocal) {
      if (!hasBase) {
        result[key] = currentValue;
        continue;
      }
      if (deepEqual(currentValue, baseValue)) continue;
      return conflict([...path, key]);
    }
    if (!hasCurrent) {
      if (!hasBase) {
        result[key] = localValue;
        continue;
      }
      if (deepEqual(localValue, baseValue)) continue;
      return conflict([...path, key]);
    }
    if (!hasBase) {
      if (!deepEqual(localValue, currentValue)) return conflict([...path, key]);
      result[key] = localValue;
      continue;
    }
    const merged = mergeValue(baseValue, localValue, currentValue, [...path, key]);
    if (!merged.ok) return merged;
    result[key] = merged.value;
  }
  return { ok: true, value: result };
}

function mergeArray(base, local, current, path, key) {
  const baseMap = new Map(base.map((item) => [item[key], item]));
  const localMap = new Map(local.map((item) => [item[key], item]));
  const currentMap = new Map(current.map((item) => [item[key], item]));
  const merged = [];
  const included = new Set();

  for (const currentItem of current) {
    const id = currentItem[key];
    const hasBase = baseMap.has(id);
    const hasLocal = localMap.has(id);
    if (!hasLocal) {
      if (!hasBase) {
        merged.push(currentItem);
        included.add(id);
        continue;
      }
      if (!deepEqual(currentItem, baseMap.get(id))) return conflict([...path, id]);
      continue;
    }
    const localItem = localMap.get(id);
    if (!hasBase) {
      if (!deepEqual(localItem, currentItem)) return conflict([...path, id]);
      merged.push(localItem);
      included.add(id);
      continue;
    }
    const item = mergeValue(baseMap.get(id), localItem, currentItem, [...path, id]);
    if (!item.ok) return item;
    merged.push(item.value);
    included.add(id);
  }

  for (const localItem of local) {
    const id = localItem[key];
    if (included.has(id)) continue;
    if (!baseMap.has(id)) {
      merged.push(localItem);
      included.add(id);
      continue;
    }
    if (!deepEqual(localItem, baseMap.get(id))) return conflict([...path, id]);
  }
  return { ok: true, value: merged };
}

export function repairVoucherNumbers(state) {
  if (!isPlainObject(state) || !Array.isArray(state.companies)) return 0;
  let renumbered = 0;
  for (const company of state.companies) {
    if (!isPlainObject(company) || !Array.isArray(company.vouchers)) continue;
    const counters = isPlainObject(company.counters) ? company.counters : {};
    let changed = false;
    const maxByType = new Map();
    for (const voucher of company.vouchers) {
      const type = String(voucher?.type ?? '');
      maxByType.set(type, Math.max(maxByType.get(type) ?? 0, number(voucher?.no)));
    }
    const seenByType = new Map();
    for (const voucher of company.vouchers) {
      const type = String(voucher?.type ?? '');
      const seen = seenByType.get(type) ?? new Set();
      seenByType.set(type, seen);
      let no = number(voucher?.no);
      if (!seen.has(no)) {
        seen.add(no);
        continue;
      }
      let next = maxByType.get(type) ?? 0;
      do {
        next += 1;
      } while (seen.has(next));
      voucher.no = next;
      seen.add(next);
      maxByType.set(type, next);
      counters[type] = Math.max(number(counters[type]), next);
      renumbered += 1;
      changed = true;
    }
    if (changed && !isPlainObject(company.counters)) company.counters = counters;
  }
  return renumbered;
}

export function mergeWorkspaceStates(base, local, current) {
  if (!isPlainObject(base) || !isPlainObject(local) || !isPlainObject(current)) {
    return { ok: false, reason: 'Workspace states must be objects.' };
  }
  const merged = mergeValue(base, local, current, []);
  return merged.ok ? { ok: true, state: merged.value } : merged;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export { deepEqual };
