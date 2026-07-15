import os
import subprocess
import telebot
from telebot import types

# ⚙️ ตั้งค่ารหัสผ่านและข้อมูลระบบ
API_TOKEN = '8631364707:AAENt559QFdBssEW0Vh4GmzAb_e2ou6qmuQ' # Token ของท่าน
ALLOWED_USER_ID = 1846691123  # Chat ID ของท่าน (ล็อกไว้ให้ใช้ได้แค่คนเดียว คนอื่นสั่งไม่ได้)

bot = telebot.TeleBot(API_TOKEN)
active_processes = {} # ไว้เก็บสถานะการอัดที่กำลังทำงานอยู่

# 📱 ฟังก์ชันสร้างปุ่มเมนูด้านล่าง (เหมือนในรูปภาพ)
def main_menu():
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    btn_watchlist = types.KeyboardButton('📋 Watchlist')
    btn_record = types.KeyboardButton('🔴 Record')
    btn_status = types.KeyboardButton('🔴 Status')
    markup.row(btn_watchlist, btn_record)
    markup.row(btn_status)
    return markup

# 🔓 ตรวจสอบสิทธิ์ผู้ใช้งาน
def is_authorized(message):
    return message.chat.id == ALLOWED_USER_ID

@bot.message_handler(commands=['start', 'menu'])
def send_welcome(message):
    if not is_authorized(message): return
    bot.send_message(message.chat.id, "👋 ยินดีต้อนรับสู่ระบบควบคุมบอทอัด TikTok ส่วนตัว\nเลือกเมนูด้านล่างเพื่อสั่งงานได้เลยครับ", reply_markup=main_menu())

# 1️⃣ เมื่อกดปุ่ม 🔴 Record
@bot.message_handler(func=lambda message: message.text == '🔴 Record')
def ask_username(message):
    if not is_authorized(message): return
    sent_msg = bot.send_message(message.chat.id, "📌 กรุณาส่งชื่อ TikTok Username หรือลิงก์ช่องที่ต้องการให้อัดตอนนี้เลยครับ:")
    bot.register_next_step_handler(sent_msg, start_recording)

def start_recording(message):
    username = message.text.strip().replace('@', '')
    
    if username in active_processes:
        bot.send_message(message.chat.id, f"⚠️ ช่อง @{username} กำลังถูกเฝ้าจอหรืออัดอยู่แล้วครับ")
        return

    bot.send_message(message.chat.id, f"⏳ กำลังเริ่มระบบเฝ้าจอช่อง @{username} ผ่านสะพานเชื่อม Vercel...")
    
    # สั่งรันสคริปต์อัดหลักในเบื้องหลัง (Background Process)
    cmd = f"python src/main.py -mode automatic -user @{username}"
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    active_processes[username] = process
    bot.send_message(message.chat.id, f"✅ เริ่มต้นเฝ้าจอ @{username} สำเร็จ! ระบบจะทำการอัดและแจ้งเตือนอัตโนมัติเมื่อมีการไลฟ์")

# 2️⃣ เมื่อกดปุ่ม 🔴 Status
@bot.message_handler(func=lambda message: message.text == '🔴 Status')
def check_status(message):
    if not is_authorized(message): return
    if not active_processes:
        bot.send_message(message.chat.id, "📭 ปัจจุบันไม่มีช่องไหนที่กำลังเปิดระบบอัดอยู่ครับ")
        return
    
    status_text = "📊 รายการช่องที่กำลังเปิดระบบเฝ้าจอ/อัดอยู่:\n"
    for user in list(active_processes.keys()):
        # เช็กว่ากระบวนการยังรันอยู่ไหม
        if active_processes[user].poll() is None:
            status_text += f"• @{user} (🟢 กำลังทำงาน)\n"
        else:
            status_text += f"• @{user} (🔴 หยุดทำงานแล้ว)\n"
            del active_processes[user]
            
    bot.send_message(message.chat.id, status_text)

# 3️⃣ เมื่อกดปุ่ม 📋 Watchlist (ดูรายการเบื้องต้น)
@bot.message_handler(func=lambda message: message.text == '📋 Watchlist')
def show_watchlist(message):
    if not is_authorized(message): return
    # ส่วนนี้สามารถเขียนให้ไปอ่านรายชื่อช่องจากไฟล์ watchlist.txt เพิ่มเติมได้ในอนาคต
    bot.send_message(message.chat.id, "📋 ฟังก์ชัน Watchlist: ระบบนี้กำลังผูกกับสคริปต์หลักเพื่อดึงรายชื่อช่องโปรดของท่านครับ")

bot.infinity_polling()

