require("dotenv").config();
const mongoose = require("./database");
const User = require("./models/User");

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionsBitField,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ================= START DB =================
mongoose();

// ================= COMMANDS =================

const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),

    new SlashCommandBuilder().setName("level").setDescription("XP check"),

    new SlashCommandBuilder().setName("balance").setDescription("Check coins"),

    new SlashCommandBuilder().setName("daily").setDescription("Claim daily coins"),

    new SlashCommandBuilder().setName("leaderboard").setDescription("Top XP"),

    new SlashCommandBuilder().setName("ticket").setDescription("Create ticket"),

    new SlashCommandBuilder().setName("ban")
        .setDescription("Ban user")
        .addUserOption(o => o.setName("user").setRequired(true)),

    new SlashCommandBuilder().setName("kick")
        .setDescription("Kick user")
        .addUserOption(o => o.setName("user").setRequired(true))

].map(c => c.toJSON());

// ================= REGISTER =================

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
    );
    console.log("⚡ Commands registered");
})();

// ================= READY =================

client.once("ready", () => {
    console.log(`🟢 Logged in as ${client.user.tag}`);
});

// ================= MESSAGE SYSTEM (XP + COINS) =================

client.on("messageCreate", async message => {
    if (message.author.bot) return;

    let user = await User.findOne({ userId: message.author.id });

    if (!user) {
        user = await User.create({ userId: message.author.id });
    }

    user.xp += 5;
    user.coins += 2;

    await user.save();
});

// ================= INTERACTIONS =================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;

    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) user = await User.create({ userId: interaction.user.id });

    const { commandName } = interaction;

    try {

        // PING
        if (commandName === "ping") {
            return interaction.reply(`🏓 ${client.ws.ping}ms`);
        }

        // LEVEL
        if (commandName === "level") {
            return interaction.reply(`⭐ XP: ${user.xp}`);
        }

        // BALANCE
        if (commandName === "balance") {
            return interaction.reply(`💰 Coins: ${user.coins}`);
        }

        // DAILY
        if (commandName === "daily") {

            const now = Date.now();
            if (user.lastDaily && now - user.lastDaily < 86400000) {
                return interaction.reply("⏳ Already claimed daily");
            }

            user.coins += 100;
            user.lastDaily = now;
            await user.save();

            return interaction.reply("💸 +100 coins claimed!");
        }

        // LEADERBOARD
        if (commandName === "leaderboard") {

            const top = await User.find().sort({ xp: -1 }).limit(5);

            const text = top.map((u, i) =>
                `${i + 1}. <@${u.userId}> - ${u.xp} XP`
            ).join("\n");

            return interaction.reply("🏆 **Top Users**\n" + text);
        }

        // TICKET
        if (commandName === "ticket") {

            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: ["ViewChannel"]
                    },
                    {
                        id: interaction.user.id,
                        allow: ["ViewChannel", "SendMessages"]
                    }
                ]
            });

            return interaction.reply({ content: `Ticket created ${channel}`, ephemeral: true });
        }

        // BAN
        if (commandName === "ban") {

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
                return interaction.reply("No permission");

            const member = interaction.options.getUser("user");
            const target = await interaction.guild.members.fetch(member.id);

            await target.ban();
            return interaction.reply("Banned user");
        }

        // KICK
        if (commandName === "kick") {

            const member = interaction.options.getUser("user");
            const target = await interaction.guild.members.fetch(member.id);

            await target.kick();
            return interaction.reply("Kicked user");
        }

    } catch (err) {
        console.error(err);
        return interaction.reply("Error occurred");
    }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);