// utils.js
const utils = {
     isAdmin: (msg) => config.ADMIN_NUMBERS.includes(msg.from),
     formatNumber: (number) => `${number.replace(/[^0-9]/g, '')}@c.us`,
     createMediaFromUrl: async (url) => {
         const response = await axios.get(url, { responseType: 'arraybuffer' });
         const buffer = Buffer.from(response.data, 'utf-8');
         return new MessageMedia('image/jpeg', buffer.toString('base64'));
     }
 };
 
 module.exports = utils;