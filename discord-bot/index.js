// index.js
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

// 初始化 Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 初始化 Discord Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Bot 上線
client.once("ready", () => {
  console.log(`${client.user.tag} 已上線！`);
});

// 監聽訊息
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // 忽略其他 Bot

  const userId = message.author.id;
  const today = new Date().toISOString().split("T")[0];

  // --- !簽到 ---
  if (message.content.trim().toLowerCase() === "!簽到") {
    try {
      // 檢查今天是否已簽到
      const { data: existingCheckin } = await supabase
        .from("checkins")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if (existingCheckin) return message.reply("你今天已經簽到過了！");

      // 檢查是否為新用戶
      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!user) {
        // 新用戶加入 users 表
        await supabase
          .from("users")
          .insert([{ user_id: userId, join_date: today }]);
      }

      // 檢查昨天是否有簽到，計算連續天數
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const { data: yesterdayCheckin } = await supabase
        .from("checkins")
        .select("streak")
        .eq("user_id", userId)
        .eq("date", yesterdayStr)
        .single();

      const streak = yesterdayCheckin ? yesterdayCheckin.streak + 1 : 1;

      // 新增今天簽到
      await supabase
        .from("checkins")
        .insert([{ user_id: userId, date: today, streak }]);

      message.reply(`簽到成功！🎉\n你已連續簽到 ${streak} 天。`);
    } catch (err) {
      console.error(err);
      message.reply("簽到時發生錯誤！");
    }
  }

  // --- !加入日期 ---
  if (message.content.trim().toLowerCase() === "!加入日期") {
    try {
      const { data: user } = await supabase
        .from("users")
        .select("join_date")
        .eq("user_id", userId)
        .single();

      if (user) {
        message.reply(`你加入伺服器的日期是：${user.join_date}`);
      } else {
        message.reply("找不到你的加入日期紀錄。");
      }
    } catch (err) {
      console.error(err);
      message.reply("查詢加入日期時發生錯誤！");
    }
  }

  // --- !排行 ---
  if (message.content.trim().toLowerCase() === "!排行") {
    try {
      // 取最新簽到 streak，排序前 50 名
      const { data: checkins, error } = await supabase
        .from("checkins")
        .select("user_id, streak")
        .order("streak", { ascending: false })
        .limit(50);

      if (error) {
        console.error(error);
        return message.reply("查詢排行榜時發生錯誤！");
      }

      if (!checkins || checkins.length === 0) {
        return message.reply("目前沒有任何簽到紀錄。");
      }

      let reply = "🏆 簽到排行榜（前 50 名） 🏆\n";
      for (let i = 0; i < checkins.length; i++) {
        const { user_id, streak } = checkins[i];
        let user;
        try {
          user = await client.users.fetch(user_id);
        } catch {
          user = { tag: "未知用戶" };
        }
        reply += `${i + 1}. ${user.tag} - ${streak} 天\n`;
      }

      message.reply(reply);
    } catch (err) {
      console.error(err);
      message.reply("排行榜查詢發生錯誤！");
    }
  }
});

// 登入 Discord
client.login(process.env.DISCORD_TOKEN);
