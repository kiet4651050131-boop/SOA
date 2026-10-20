module.exports = function makeLogger(name) {
    return (...args) => {
        const t = new Date().toISOString().slice(11, 19);
        console.log(`[${t}] [${name}]`, ...args);
    };
};
