let StentorCrowdsale = artifacts.require('./StentorCrowdsale.sol');
let StentorToken = artifacts.require('./StentorToken.sol');
let RefundVault = artifacts.require('./RefundVault.sol');

module.exports = async function(deployer, network, accounts) {

    const startTime = Math.floor(+ new Date() / 1000);
    const endTime = Math.floor(+ new Date() /1000) + 600; //10 minutes into the future
    const rate = 1; //tokens per wei
    const goal = 300000000 * Math.pow(10, 18); //300M tokens
    const cap = 500000000 * Math.pow(10, 18); //500M tokens
    const initalSupply = 1000000000 * Math.pow(10, 18);//1B tokens

    const crowdsale = {
        address: accounts[0],
        amount: cap
    }; // Receives ETH from contribution

    const team = {
        address: accounts[1],
        amount: 250000000 * Math.pow(10, 18)
    }; // Receives Vested SGT

    const foundation = {
        address: accounts[2],
        amount: 250000000 * Math.pow(10, 18)
    }; // Receives SGT

    await deployer.deploy(StentorToken, initalSupply);
    await deployer.deploy(RefundVault, crowdsale.address);
    await deployer.deploy(StentorCrowdsale, startTime, endTime, rate, goal, cap, RefundVault.address, StentorToken.address, {gas: 999999});

    //allocate SGT for the crowdsale, team, and foundation

    await StentorToken.deployed().then(async (token) => {
        await token.transfer(crowdsale.address, crowdsale.amount);
        await token.transfer(team.address, team.amount);
        await token.transfer(foundation.address, foundation.amount);
    });

};
