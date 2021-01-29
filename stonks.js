require("dotenv").config();
const discord = require("discord.js");
const api = require("yahoo-finance");
const sqlite3 = require("sqlite3").verbose();

const INTERVAL = 60; // seconds
const TOKEN = process.env.UCORN;
const DB = new sqlite3.Database("./stonks.db");
const SYMBOLS = [
  "GME",
  "AMC",
  "BB",
  "NOK",
  "TSLA",
  "AMD",
  "BTC-USD",
  "DOGE-USD",
];
const PINNED_MSG_ID = "804441725455826985";
// const EMOTE_UP = "<:evergreen_tree:804447513830227978>";
const EMOTE_UP = "<:GME:804455827427426385>";
const EMOTE_DOWN = "<:small_red_triangle_down:804448114232131637>";

// bot.on("message", msg => console.log(msg.author.name, bot.fetchUser(msg.author.id)))

// Main functionality

let getData = (symbol) =>
  new Promise((resolve, reject) => {
    api.quote({ symbol, modules: ["price"] }, (err, quotes) => {
      if (err != null) return reject();
      let { regularMarketPrice, regularMarketChangePercent } = quotes.price;
      resolve([symbol, regularMarketPrice, regularMarketChangePercent]);
    });
  });

let cachedTopicString = "";
let cachedResults = [];
// Get new prices and update cache
let generateTopicString = async () => {
  try {
    let promises = SYMBOLS.map((symbol) => getData(symbol));
    let results = await Promise.all(promises);
    let str = "";
    let i = 0;
    for ([symbol, price, change] of results) {
      let cachedPrice = cachedResults.length > 0 ? cachedResults[i][1] : 0;
      let emote = price > cachedPrice ? EMOTE_UP : EMOTE_DOWN;
      if (price == cachedPrice) emote = "";
      let pct = (change * 100).toFixed(2);
      str += `${emote} ${symbol}: ${price.toFixed(
        symbol == "DOGE-USD" ? 4 : 2
      )} (${pct}%) | `;
      i++;
    }
    cachedResults = results;
    DB.run("UPDATE key_value SET value = ? WHERE key = 'cache'", [
      JSON.stringify(results),
    ]);

    str = str.slice(0, -2); // Remove trailing pipe
    return str;
  } catch (err) {
    console.log("FAILURE", err);
    return "Temporary error. Whoops!";
  }
};

let refresh = async () => {
  console.log("Refresh!");
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

// Supplemental functions

let help = async (msg) => {
  msg.channel.send(
    "🚀 yolo <ticker> <shares (fractional supported)> <buy in price>"
  );
};

let yolo = async (msg) => {
  let channel = msg.channel;
  try {
    let userId = msg.author.id;
    let parts = text.split(" ");
    let { yolo, ticker, shares, buyInPrice } = parts;
    ticker = ticker.toUpperCase();
    shares = parseFloat(shares);
    buyInPrice = parseFloat(buyInPrice);
    if (!SYMBOLS.includes(ticker))
      return channel.send(
        `🚫 ${ticker} not supported yet. Wake me up when it flys past the moon 🌕 🚀`
      );
    DB.run(
      "INSERT INTO holds (user_id, ticker, shares, buy_price) VALUES (?, ?, ?, ?)",
      [userId, ticker, shares, buyInPrice],
      (rows, err) => {
        if (err)
          return channel.send("🚫 Database error! I can't write either! 🚫");
        return channel.send(`✅ YOLO: ${shares} ${ticker} @ ${buyInPrice}`);
      }
    );
  } catch (err) {
    channel.send("🚫 I can't read! Try again! 🚫");
  }
};

let rocket = (msg) =>
  msg.channel.send(cachedTopicString).then((msg) => {
    msg.react("💎");
    msg.react("👐");
  });

let bot = new discord.Client();
bot.login(TOKEN);
DB.get("SELECT value FROM key_value WHERE key = 'cache'", (err, row) => {
  if (!err) {
    console.log("Fetched from cache: ", row);
    cachedResults = JSON.parse(row.value);
  } else {
    console.log("FAILURE: ", err);
  }
});

bot.on("ready", () => {
  refresh();
  setInterval(refresh, INTERVAL * 1000);
});

bot.on("message", (msg) => {
  if (msg.channel.name != "stonks") return;
  let channel = msg.channel;
  let text = msg.content.toLowerCase();
  if (text.includes("down")) channel.send("📈📈📈 STONKS ONLY GO UP! 📈📈📈");
  if (text.includes("hodl")) {
    msg.react("💎");
    msg.react("👐");
  }
  if (text.startsWith("🚀 help")) return help(msg);
  if (text.startsWith("🚀 yolo")) return yolo(msg);
  if (text.startsWith("🚀")) return rocket(msg);
});

bot.on("error", (err) => console.log("FAILURE", err));

process.on("SIGINT", () => {
  DB.close();
});
