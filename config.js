module.exports = {
    startTime: Math.floor(+new Date() / 1000) + 1,
    endTime: Math.floor(+new Date() / 1000) + 600, //10 minutes into the future
    rate: 1, //tokens per wei
    goal: 300000000 * Math.pow(10, 18), //300M tokens
    cap: 500000000 * Math.pow(10, 18), //500M tokens
    initialSupply: 1000000000 * Math.pow(10, 18),//1B tokens

    team: {
        amount: 250000000 * Math.pow(10, 18)
    }, // Receives Vested SGT

    foundation: {
        amount: 250000000 * Math.pow(10, 18)
    } // Receives SGT
};