import { makeDerivedValue, makeLiveValue } from "../src";
import https from "https";

interface WikiEvent {
  user: string;
  bot: boolean;
  minor: boolean;
}

const wiki = makeLiveValue<WikiEvent, []>(() => (send) => {
  https.get("https://stream.wikimedia.org/v2/stream/recentchange", (res) => {
    res.on("data", (buf: Buffer) => {
      const line = buf.toString();
      if (line.startsWith("data:")) {
        const json = line.slice("data: ".length);
        try {
          if (Math.random() < 0.05) {
            send(JSON.parse(json));
          }
        } catch (error) {
          // do nothing
        }
      }
    });
  });
});

const mostActiveUsers = makeDerivedValue(() => {
  const record: Record<string, number> = {};
  return () => {
    const action = wiki();
    record[action.user] = (record[action.user] ?? 0) + 1;
    return record;
  };
});

const top10ActiveUsers = makeDerivedValue(() => () => {
  return Object.entries(mostActiveUsers())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([username]) => username);
});

const numberOfBotEdits = makeDerivedValue(() => {
  let count = 0;
  return () => {
    const action = wiki();
    if (action.bot) {
      count++;
    }
    return count;
  };
});

const numberOfHumanEdits = makeDerivedValue(() => {
  let count = 0;
  return () => {
    const action = wiki();
    if (!action.bot) {
      count++;
    }
    return count;
  };
});

const botsVsHumans = makeDerivedValue(() => () => {
  const human = numberOfHumanEdits();
  const bots = numberOfBotEdits();

  return bots / (human + bots);
});

botsVsHumans.subscribe([], (value) => {
  console.log(value);
});
