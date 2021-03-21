export interface LiveValue<Arguments extends any[], Result> {
  (...args: Arguments): Result;
  subscribe(args: Arguments, onValue: (v: Result) => void): void;
}

type SetStateAction<T> = T | ((oldValue: T) => T);

interface State<T> {
  value: T;
  setValue(value: SetStateAction<T>): void;
}

interface Effect {
  dependencies: any[];
}

interface Stream<Result> {
  // template: Template<Arguments, Result>;
  // arguments: Arguments;
  hasValue: boolean;
  lastValue: Result;
  notify(): void;
  dependents: Set<Stream<any>>;
  derive: Function;
  args: any[];
  name: string;
  states: any[];
  effects: Effect[];
}

function arrShallowEqual(a: any[], b: any[]) {
  return a.length === b.length && a.every((value, index) => b[index] === value);
}

let currentlyEvaluatingStream: Stream<any> | null = null;
let stateCounter = 0;
let effectCounter = 0;
let needsToNotify = false;

function withStream(stream: Stream<any>, doIt: () => void) {
  const oldEvaluatingStream = currentlyEvaluatingStream;
  stateCounter = 0;
  effectCounter = 0;
  needsToNotify = false;
  currentlyEvaluatingStream = stream;
  doIt();
  currentlyEvaluatingStream = oldEvaluatingStream;
}

export function makeDerivedValue<Arguments extends any[], Result>(
  derive: (...args: Arguments) => Result,
  name: string
): LiveValue<Arguments, Result> {
  const wrapper: LiveValue<Arguments, Result> = (...args) => {
    const stream = findOrMakeStream({
      args,
      name,
      notify() {
        const oldValue = stream.lastValue;
        withStream(stream, () => {
          stream.lastValue = derive(...args);
          stream.hasValue = true;
        });

        if (oldValue !== stream.lastValue || needsToNotify) {
          stream.dependents.forEach((dependent) => dependent.notify());
        }
      },
    });

    if (currentlyEvaluatingStream) {
      stream.dependents.add(currentlyEvaluatingStream);
    } else {
      throw new Error("halp");
    }

    if (!stream.hasValue) {
      withStream(stream, () => {
        stream.lastValue = derive(...args);
        stream.hasValue = true;
      });
    }

    return stream.lastValue;
  };

  const streams: Stream<Result>[] = [];
  function findOrMakeStream({
    args,
    name,
    notify,
  }: Pick<Stream<Result>, "args" | "name" | "notify">): Stream<Result> {
    const foundStream = streams.find((s) => {
      return arrShallowEqual(args, s.args);
    });

    if (foundStream) {
      return foundStream;
    }

    const stream: Stream<Result> = {
      name,
      dependents: new Set(),
      derive,
      args,
      notify,
      hasValue: false,
      lastValue: null as any,
      states: [],
      effects: [],
    };
    streams.push(stream);
    return stream;
  }
  wrapper.subscribe = (args, onValue) => {
    const stream = findOrMakeStream({
      args,
      name,
      notify() {
        const oldValue = stream.lastValue;
        withStream(stream, () => {
          stream.lastValue = derive(...args);
          stream.hasValue = true;
        });

        if (oldValue !== stream.lastValue || needsToNotify) {
          onValue(stream.lastValue);
        }
      },
    });

    try {
      stream.notify();
    } catch (error) {
      if (!error.then) {
        throw error;
      }
    }
  };

  return wrapper;
}

export function useState<T>(_initial: T): [T, (v: T) => void] {
  if (!currentlyEvaluatingStream) {
    throw new Error("halp");
  }

  const stream = currentlyEvaluatingStream;
  if (stateCounter < currentlyEvaluatingStream.states.length) {
    const state = stream.states[stateCounter];
    stateCounter++;

    return [state.value, state.setValue];
  } else if (stateCounter === currentlyEvaluatingStream.states.length) {
    const state: State<T> = {
      value: _initial,
      setValue(action: SetStateAction<T>) {
        const oldValue = state.value;
        if (typeof action === "function") {
          state.value = (action as any)(state.value);
        } else {
          state.value = action;
        }

        if (oldValue !== state.value) {
          needsToNotify = true;
        }
      },
    };
    stream.states.push(state);
    stateCounter++;
    return [state.value, state.setValue];
  } else {
    throw new Error(
      "Broke the rules of hooks" +
        JSON.stringify({
          statesLength: currentlyEvaluatingStream.states.length,
          stateCounter,
          states: currentlyEvaluatingStream.states,
        })
    );
  }
}

export function makeLiveValue<T, Arguments extends any[]>(
  connect: (send: (v: T) => void) => (...args: Arguments) => void
): (...args: Arguments) => T {
  let lastValue: T | null = null;
  let hasValue = false;
  let resolve: (() => void) | null = null;

  let dependents = new Set<Stream<any>>();

  let isConnected = false;

  return function input(...args: Arguments) {
    if (!isConnected) {
      connect((v) => {
        hasValue = true;
        lastValue = v;

        dependents.forEach((dependent) => {
          dependent.notify();
        });

        resolve?.();
        resolve = null;
      })(...args);

      isConnected = true;
      if (currentlyEvaluatingStream) {
        dependents.add(currentlyEvaluatingStream);
      } else {
        throw new Error("halp");
      }
    }

    if (!hasValue) {
      throw new Promise<void>((_resolve) => {
        resolve = _resolve;
      });
    }

    return lastValue!;
  };
}
