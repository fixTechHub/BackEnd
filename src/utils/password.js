const bcrypt = require("bcrypt");

const hashingPassword = async (password) => {
    return await bcrypt.hash(password,10)
}

const comparePassword = async (inputPassword, password) => {
    return await bcrypt.compare(inputPassword,password)
}
module.exports = {hashingPassword, comparePassword}