import { makeDerivedValue, makeLiveValue, useEffect, useState } from "../src";
import https from "https";

interface WikiEvent {
  user: string;
  bot: boolean;
  minor: boolean;
}

const wiki = makeLiveValue<WikiEvent, []>((send) => () => {
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
  const action = wiki();
  const [mostActiveUsers, setMostActiveUsers] = useState<
    Record<string, number>
  >({});
  useEffect(() => {
    setMostActiveUsers((old) => ({
      ...old,
      [action.user]: (old[action.user] ?? 0) + 1,
    }));
  }, [action, setMostActiveUsers]);
  return mostActiveUsers;
}, "mostActiveUsers");

const top10ActiveUsers = makeDerivedValue(() => {
  return Object.entries(mostActiveUsers())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([username]) => username);
}, "top10ActiveUsers");

const numberOfBotEdits = makeDerivedValue(() => {
  const action = wiki();
  const [numberOfBotEdits, setNumberOfBotEdits] = useState(0);
  useEffect(() => {
    if (action.bot) {
      setNumberOfBotEdits((old) => old + 1);
    }
  }, [action, setNumberOfBotEdits]);
  return numberOfBotEdits;
}, "numberOfBotEdits");

const numberOfHumanEdits = makeDerivedValue(() => {
  const action = wiki();
  const [numberOfHumanEdits, setNumberOfHumanEdits] = useState(0);
  useEffect(() => {
    if (!action.bot) {
      setNumberOfHumanEdits((old) => old + 1);
    }
  }, [action, setNumberOfHumanEdits]);
  return numberOfHumanEdits;
}, "numberOfHumanEdits");

const botsVsHumans = makeDerivedValue(() => {
  const human = numberOfHumanEdits();
  const bots = numberOfBotEdits();

  return bots / (human + bots);
}, "botsVsHumans");

botsVsHumans.subscribe([], (value) => {
  console.log(value);
});
