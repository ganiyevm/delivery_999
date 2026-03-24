const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ImportService = require('../../backend/src/services/import.service');

module.exports = (bot) => {
    // /import buyrug'i
    bot.command('import', async (ctx) => {
        if (!ctx.isAdmin) {
            return ctx.reply('⛔ Sizda bu buyruqqa ruxsat yo\'q');
        }
        ctx.session.awaitingImport = true;
        await ctx.reply(
            '📤 <b>Excel import</b>\n\n' +
            'Excel faylni yuboring (.xlsx)\n\n' +
            '📋 Ustunlar tartibi:\n' +
            'A: Филиал | B: Наименование\n' +
            'C: Производитель | D: Цена | E: Кол-во',
            { parse_mode: 'HTML' }
        );
    });

    // Fayl kelganda
    bot.on('message:document', async (ctx) => {
        if (!ctx.isAdmin) return;
        if (!ctx.session.awaitingImport) return;

        const doc = ctx.message.document;
        const ext = path.extname(doc.file_name || '').toLowerCase();

        if (!['.xlsx', '.xls'].includes(ext)) {
            return ctx.reply('❌ Faqat Excel fayllar (.xlsx) qabul qilinadi');
        }

        await ctx.reply('⏳ Import boshlanmoqda...');

        try {
            // Faylni yuklab olish
            const file = await ctx.getFile();
            const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

            // Vaqtinchalik fayl saqlash
            const tmpDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const tmpPath = path.join(tmpDir, `import_${Date.now()}.xlsx`);
            fs.writeFileSync(tmpPath, response.data);

            // Import
            const result = await ImportService.importExcel(tmpPath, ctx.from.id);

            // Natija
            let text = `✅ <b>Import tugadi!</b>\n─────────────────\n` +
                `📊 Jami qatorlar: <b>${result.totalRows.toLocaleString()}</b>\n` +
                `✅ Muvaffaqiyatli: <b>${result.successRows.toLocaleString()}</b>\n` +
                `❌ Xatolar: <b>${result.errorRows}</b>\n`;

            if (result.errors.length > 0) {
                text += `─────────────────\n<b>Xatolar:</b>\n`;
                result.errors.slice(0, 10).forEach(e => {
                    text += `• Qator ${e.row}: ${e.message}\n`;
                });
                if (result.errors.length > 10) {
                    text += `... va yana ${result.errors.length - 10} ta\n`;
                }
            }

            await ctx.reply(text, { parse_mode: 'HTML' });

            // Temp fayl o'chirish
            fs.unlink(tmpPath, () => { });
            ctx.session.awaitingImport = false;
        } catch (error) {
            console.error('Import xatosi:', error);
            await ctx.reply(`❌ Import xatosi: ${error.message}`);
        }
    });
};
