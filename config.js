module.exports = {
    startTime: Math.floor(+new Date() / 1000) + 1,
    endTime: Math.floor(+new Date() / 1000) + 600, //10 minutes into the future
    rate: 5000, //token units per ETH unit
    goal: 60000 * Math.pow(10, 18), //300M tokens, 60k ETH
    cap: 100000 * Math.pow(10, 18), //500M tokens, 100k ETH
    initialSupply: 1000000000 * Math.pow(10, 18),//1B tokens

    team: {
        amount: 250000000 * Math.pow(10, 18)
    }, // Receives Vested SGT

    foundation: {
        amount: 250000000 * Math.pow(10, 18)
    }, // Receives SGT

    individualCap: 10 * Math.pow(10, 18) //10 ETH
};