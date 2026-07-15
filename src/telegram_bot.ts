import TelegramBot from 'node-telegram-bot-api';
import { exec, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ⚙️ ตั้งค่าระบบควบคุมส่วนตัว
const API_TOKEN = '8631364707:AAENt559QFdBssEW0Vh4GmzAb_e2ou6qmuQ'; // Token ของท่าน
const ALLOWED_USER_ID = 1846691123; // Chat ID ของท่านล็อกไว้คนเดียว

const bot = new TelegramBot(API_TOKEN, { polling: true });
const activeProcesses: { [key: string]: ChildProcess } = {};

// 📱 โครงสร้างปุ่มเมนูด้านล่าง (เหมือนบอท TikRec)
const mainInterface = {
    reply_markup: {
        keyboard: [
            [{ text: '📋 Watchlist' }, { text: '🔴 Record' }],
            [{ text: '🔴 Status' }]
        ],
        resize_keyboard: true
    }
};

// ตรวจสอบสิทธิ์ผู้ใช้งาน
const isAuthorized = (msg: TelegramBot.Message) => msg.chat.id === ALLOWED_USER_ID;

// คำสั่งเริ่มต้น
bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, "👋 ยินดีต้อนรับสู่ระบบควบคุมบอทอัด TikTok ส่วนตัว\nเลือกเมนูด้านล่างเพื่อสั่งงานได้เลยครับ", mainInterface);
});

// 📱 1. ระบบปุ่ม 🔴 Record
bot.on('message', async (msg) => {
    if (!isAuthorized(msg)) return;
    if (msg.text === '🔴 Record') {
        const prompt = await bot.sendMessage(msg.chat.id, "📌 กรุณาส่งชื่อ TikTok Username หรือลิงก์ช่องที่ต้องการให้อัดตอนนี้เลยครับ:", {
            reply_markup: { force_reply: true }
        });
        
        bot.onReplyToMessage(msg.chat.id, prompt.message_id, (replyMsg) => {
            const username = replyMsg.text?.trim().replace('@', '');
            if (!username) return;

            if (activeProcesses[username]) {
                bot.sendMessage(msg.chat.id, `⚠️ ช่อง @${username} กำลังถูกเฝ้าจอหรืออัดอยู่แล้วครับ`);
                return;
            }

            bot.sendMessage(msg.chat.id, `⏳ กำลังเริ่มระบบเฝ้าจอช่อง @${username}...`);

            // สั่งรันคำสั่งภายในโปรเจกต์ TypeScript (สั่งรัน index.ts หรือ cli.ts ของท่าน)
            // หมายเหตุ: ปรับแก้คำสั่ง npm run หรือ ts-node ตามคำสั่งรันหลักของโปรเจกต์ท่านได้เลย
            const process = exec(`npx ts-node ${path.join(__dirname, 'index.ts')} -user ${username}`);
            
            activeProcesses[username] = process;
            bot.sendMessage(msg.chat.id, `✅ เริ่มต้นเฝ้าจอ @${username} สำเร็จ! ระบบจะทำการอัดอัตโนมัติเมื่อมีการไลฟ์`);
        });
    }
});

// 📱 2. ระบบปุ่ม 🔴 Status
bot.on('message', (msg) => {
    if (!isAuthorized(msg)) return;
    if (msg.text === '🔴 Status') {
        const keys = Object.keys(activeProcesses);
        if (keys.length === 0) {
            bot.sendMessage(msg.chat.id, "📭 ปัจจุบันไม่มีช่องไหนที่กำลังเปิดระบบอัดอยู่ครับ");
            return;
        }

        let statusText = "📊 รายการช่องที่กำลังเปิดระบบเฝ้าจอ/อัดอยู่:\n";
        keys.forEach((user) => {
            const proc = activeProcesses[user];
            // เช็กว่า Process ยังไม่ตาย (exitCode เป็น null)
            if (proc.exitCode === null) {
                statusText += `• @${user} (🟢 กำลังทำงาน)\n`;
            } else {
                statusText += `• @${user} (🔴 หยุดทำงานแล้ว)\n`;
                delete activeProcesses[user];
            }
        });
        bot.sendMessage(msg.chat.id, statusText);
    }
});

// 📱 3. ระบบปุ่ม 📋 Watchlist (อ่านรายชื่อจากไฟล์ config.json ในรูป)
bot.on('message', (msg) => {
    if (!isAuthorized(msg)) return;
    if (msg.text === '📋 Watchlist') {
        try {
            const configPath = path.join(__dirname, 'config.json');
            if (fs.existsSync(configPath)) {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                // ดึงรายชื่อจากใน config.json ออกมาโชว์ (สมมติว่าในไฟล์เก็บอาเรย์ชื่อ users หรือตามโครงสร้างจริง)
                const users = configData.users || []; 
                if (users.length === 0) {
                    bot.sendMessage(msg.chat.id, "📋 Watchlist ว่างเปล่า ไม่มีรายชื่อช่องที่บันทึกไว้");
                } else {
                    bot.sendMessage(msg.chat.id, `📋 รายชื่อช่องใน Watchlist ปัจจุบัน:\n${users.map((u: string) => `• ${u}`).join('\n')}`);
                }
            } else {
                bot.sendMessage(msg.chat.id, "❌ ไม่พบไฟล์ config.json ในระบบ");
            }
        } catch (error) {
            bot.sendMessage(msg.chat.id, "❌ เกิดข้อผิดพลาดในการดึงข้อมูล Watchlist");
        }
    }
});
