require("dotenv").config();
const discord = require("discord.js");
const api = require("yahoo-finance");
const fetch = require("node-fetch");
const INTERVAL = 60; // seconds
const TOKEN = process.env.UCORN;
const SYMBOLS = ["GME", "AMC", "BB", "NOK", "TSLA", "AMD"];
const PINNED_MSG_ID = "804441725455826985";
// const EMOTE_UP = "<:evergreen_tree:804447513830227978>";
const EMOTE_UP = "<:GME:804455827427426385>";
const EMOTE_DOWN = "<:small_red_triangle_down:804448114232131637>";

let getCryptoData = async () => {
  let res = await fetch(
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=doge",
    {
      headers: {
        "X-CMC_PRO_API_KEY": process.env.CMK,
      },
    }
  ).then((res) => res.json());
  let { price, percent_change_24h } = res.data.DOGE.quote.USD;
  return ["DOGE", price, percent_change_24h / 100];
};
let getData = (symbol) =>
  new Promise((resolve, reject) => {
    api.quote({ symbol, modules: ["price"] }, (err, quotes) => {
      if (err != null) return reject();
      let { postMarketPrice, postMarketChangePercent } = quotes.price;
      resolve([symbol, postMarketPrice, postMarketChangePercent]);
    });
  });

let cachedTopicString = "";
let cachedResults = [];
let generateTopicString = async () => {
  try {
    let promises = SYMBOLS.map((symbol) => getData(symbol));
    let results = await Promise.all(promises);
    results.push(await getCryptoData());
    let str = "";
    let i = 0;
    for ([symbol, price, change] of results) {
      let cachedPrice = cachedResults.length > 0 ? cachedResults[i][1] : 0;
      let emote = price > cachedPrice ? EMOTE_UP : EMOTE_DOWN;
      if (price == cachedPrice) emote = "";
      let pct = (change * 100).toFixed(symbol == "DOGE" ? 4 : 2);
      str += `${emote} ${symbol}: ${price.toFixed(2)} (${pct}%) | `;
      i++;
    }
    cachedResults = results;

    str = str.slice(0, -2); // Remove trailing pipe
    return str;
  } catch (err) {
    console.log("FAILURE", err);
    return "Temporary error. Whoops!";
  }
};

let ping = async () => {
  console.log("Ping!");
  try {
    let topic = await generateTopicString();
    cachedTopicString = topic;
    let channel = bot.guilds.first().channels.find((x) => x.name == "stonks");
    let msg = await channel.fetchMessage(PINNED_MSG_ID);
    msg.edit(topic);
    console.log(topic);
  } catch (err) {
    cachedTopicString = "Temporary failure!";
    console.log("FAILURE", err);
  }
};

let bot = new discord.Client();
bot.login(TOKEN);

bot.on("ready", () => {
  ping();
  setInterval(ping, INTERVAL * 1000);
});

bot.on("message", (msg) => {
  if (msg.channel.name != "stonks") return;
  if (msg.content.toLowerCase().includes("down")) {
    let channel = msg.channel;
    channel.send("📈📈📈 STONKS ONLY GO UP! 📈📈📈");
  }
  if (msg.content.toLowerCase().includes("hodl")) {
    msg.react("💎");
    msg.react("👐");
  }
  if (!msg.content.startsWith("🚀")) return;
  let channel = msg.channel;
  channel.send(cachedTopicString).then((msg) => {
    msg.react("💎");
    msg.react("👐");
  });
});

bot.on("error", (err) => {
  console.log("FAILURE", err);
});
