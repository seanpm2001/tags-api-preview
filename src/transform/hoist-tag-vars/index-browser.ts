import patchLifecycle from "../../util/patch-lifecycle";

let rendering = false;
const hoistsKey = Symbol();
const hoistIndexKey = Symbol();
const hoistedSettersKey = Symbol();
const lifecycleMethods = {
  onRender: onRender,
  onDestroy: onDestroy,
};

type Hoister = (val: unknown) => void;
type anyFn = (...args: unknown[]) => unknown;
declare class Component {
  [x: string]: unknown;
  [hoistsKey]?: ReturnType<typeof createHoist>[];
  [hoistIndexKey]?: number;
  [hoistedSettersKey]?: Set<ReturnType<typeof createHoist>>;
  onRender?: anyFn;
  onDestroy?: anyFn;
  forceUpdate(): void;
}

export = function hoist(owner: Component, name: string, hoister: Hoister) {
  const hoists = owner[hoistsKey];
  const index = owner[hoistIndexKey];
  let result;

  if (hoists) {
    if (index === undefined) {
      hoists.push((result = createHoist(owner, name, hoister)));
    } else {
      result = hoists[index];
    }
  } else {
    onRender();
    patchLifecycle(owner, lifecycleMethods);
    owner[hoistsKey] = [(result = createHoist(owner, name, hoister))];
  }

  return result;
};

function createHoist(owner: Component, name: string, hoister: Hoister) {
  let initialized = false;
  let val: unknown;

  return function setOrCheckDefined(
    child?: Component | true,
    newVal?: unknown
  ) {
    if (child) {
      if (initialized || child === true) {
        if (val !== (val = newVal)) {
          hoister(val);
          owner.forceUpdate();
        }
      } else {
        val = newVal;
        hoister(val);
        initialized = true;
        if (child[hoistedSettersKey]) {
          child[hoistedSettersKey]!.add(setOrCheckDefined);
        } else {
          patchLifecycle(child, lifecycleMethods);
          child[hoistedSettersKey] = new Set([setOrCheckDefined]);
        }
      }
    } else if (rendering) {
      throw new ReferenceError(`Cannot access '${name}' before initialization`);
    }
  };
}

function onRender() {
  if (!rendering) {
    rendering = true;
    queueMicrotask(endRender);
  }
}

function endRender() {
  rendering = false;
}

function onDestroy(this: Component) {
  if (this[hoistedSettersKey]) {
    for (const set of this[hoistedSettersKey]!) {
      set(true);
    }
  }
}
