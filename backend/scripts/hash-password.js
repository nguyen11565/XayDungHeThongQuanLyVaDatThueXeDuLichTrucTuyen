// Băm mật khẩu bcrypt để chèn tay vào SQL: npm run hash -- matkhau
const bcrypt = require('bcryptjs');
const pw = process.argv[2] || '123456';
console.log(bcrypt.hashSync(pw, 10));
