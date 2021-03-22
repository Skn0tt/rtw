export interface LiveValue<Arguments extends any[], Result> {
  (...args: Arguments): Result;
  subscribe(args: Arguments, onValue: (v: Result) => void): { close(): void };
}

interface Evaluatable {
  evaluate(): void;
}

interface EvaluatableContainer {
  children: Set<Evaluatable>;
  removeChild(child: Evaluatable): void;
}

interface Stream<Result> extends Evaluatable, EvaluatableContainer {
  hasValue: boolean;
  lastValue: Result;
  parents: Set<EvaluatableContainer>;
  derive(): Result;
  args: any[];
}

function arrShallowEqual(a: any[], b: any[]) {
  return a.length === b.length && a.every((value, index) => b[index] === value);
}

let currentlyEvaluatingStream: Stream<any> | null = null;

function deriveStream(stream: Stream<any>) {
  const oldEvaluatingStream = currentlyEvaluatingStream;
  currentlyEvaluatingStream = stream;

  stream.lastValue = stream.derive();
  stream.hasValue = true;

  currentlyEvaluatingStream = oldEvaluatingStream;
}

interface DerivedValueOptions<Result> {
  propagate?(oldValue: Result, newValue: Result): boolean;
}

export function makeDerivedValue<Result, Arguments extends any[]>(
  makeDerive: (...args: Arguments) => () => Result,
  options?: DerivedValueOptions<Result>
): LiveValue<Arguments, Result> {
  const streams: Stream<Result>[] = [];
  function findOrMakeStream(args: Stream<any>["args"]): Stream<Result> {
    const foundStream = streams.find((s) => {
      return arrShallowEqual(args, s.args);
    });

    if (foundStream) {
      return foundStream;
    }

    const stream: Stream<Result> = {
      parents: new Set(),
      children: new Set(),
      removeChild(child) {
        this.children.delete(child);

        if (this.children.size === 0) {
          this.parents.forEach((parent) => {
            parent.removeChild(this);
          });

          streams.splice(streams.indexOf(this), 1);
        }
      },
      derive: makeDerive(...(args as any)),
      args,
      evaluate() {
        try {
          const oldValue = stream.lastValue;
          const isFirstValue = !stream.hasValue;
          deriveStream(stream);

          let shouldPropagate = true;
          if (!isFirstValue && options?.propagate) {
            shouldPropagate = options.propagate(oldValue, stream.lastValue);
          }

          if (shouldPropagate) {
            stream.children.forEach((dependent) => dependent.evaluate());
          }
        } catch (error) {
          if (!error.then) {
            throw error;
          }
        }
      },
      hasValue: false,
      lastValue: null as any,
    };
    streams.push(stream);
    return stream;
  }

  const wrapper: LiveValue<Arguments, Result> = (...args) => {
    if (!currentlyEvaluatingStream) {
      throw new Error("halp");
    }

    const stream = findOrMakeStream(args);
    stream.children.add(currentlyEvaluatingStream);
    currentlyEvaluatingStream.parents.add(stream);

    if (!stream.hasValue) {
      deriveStream(stream);
    }

    return stream.lastValue;
  };

  wrapper.subscribe = (args, onValue) => {
    const stream = findOrMakeStream(args);

    const child = {
      evaluate() {
        onValue(stream.lastValue);
      },
    };

    stream.children.add(child);

    stream.evaluate();

    return {
      close() {
        stream.removeChild(child);
      },
    };
  };

  return wrapper;
}

interface LiveValueInstance<Result, Arguments> extends EvaluatableContainer {
  args: Arguments;
  lastValue: Result;
  hasValue: boolean;
  resolve?: () => void;
  close(): void;
}

export function makeLiveValue<Result, Arguments extends any[]>(
  connect: (...args: Arguments) => (send: (v: Result) => void) => () => void
): LiveValue<Arguments, Result> {
  const instances: LiveValueInstance<Result, Arguments>[] = [];
  function findOrMakeInstance(
    args: Arguments
  ): LiveValueInstance<Result, Arguments> {
    const found = instances.find((i) => {
      return arrShallowEqual(args, i.args);
    });

    if (found) {
      return found;
    }

    const instance: LiveValueInstance<Result, Arguments> = {
      children: new Set(),
      removeChild(child) {
        this.children.delete(child);

        if (this.children.size === 0) {
          this.close();
          instances.splice(instances.indexOf(this), 1);
        }
      },
      args,
      hasValue: false,
      lastValue: null as any,
      close: null as any,
    };
    instances.push(instance);

    function send(value: Result) {
      instance.hasValue = true;
      instance.lastValue = value;

      instance.children.forEach((dependent) => {
        dependent.evaluate();
      });

      instance.resolve?.();
      instance.resolve = undefined;
    }

    instance.close = connect(...args)(send);

    return instance;
  }

  const input: LiveValue<Arguments, Result> = (...args) => {
    if (!currentlyEvaluatingStream) {
      throw new Error("halp");
    }

    const instance = findOrMakeInstance(args);
    instance.children.add(currentlyEvaluatingStream);
    currentlyEvaluatingStream.parents.add(instance);

    if (!instance.hasValue) {
      throw new Promise<void>((_resolve) => {
        instance.resolve = _resolve;
      });
    }

    return instance.lastValue;
  };

  input.subscribe = (args, onValue) => {
    const instance = findOrMakeInstance(args);

    const child: Evaluatable = {
      evaluate() {
        onValue(instance.lastValue);
      },
    };

    instance.children.add(child);

    return {
      close() {
        instance.removeChild(child);
      },
    };
  };

  return input;
}
